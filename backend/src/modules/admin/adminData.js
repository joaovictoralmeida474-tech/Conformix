import { ROLE_PERMISSION_MAP, ROLES, normalizeRole } from "../../shared/auth/permissions.js";
import { getSupabaseAdmin, throwIfSupabaseError } from "../../shared/database/supabaseStore.js";

const USER_ADMIN_COLUMNS = "id,name,email,role,active,companyId,departmentId,lastLoginAt,createdAt";
const PERMISSION_COLUMNS = "id,key,name,description,createdAt";
const DEPARTMENT_COLUMNS = "id,name,slug,description,active,companyId,createdAt,updatedAt";
const AUDIT_LOG_COLUMNS = "id,userId,action,entity,entityId,details,createdAt";
const ADMIN_CACHE_TTL_MS = Number(process.env.ADMIN_CACHE_TTL_MS || 60_000);

const adminDataCache = new Map();

function getAdminCacheScopeKey(currentUser) {
  return [
    normalizeRole(currentUser?.role),
    Number(currentUser?.companyId || 0),
    Number(currentUser?.departmentId || 0),
    Number(currentUser?.id || 0),
    Array.isArray(currentUser?.permissions) ? currentUser.permissions.join("|") : ""
  ].join(":");
}

async function withAdminCache(currentUser, name, loader) {
  if (ADMIN_CACHE_TTL_MS <= 0) {
    return loader();
  }

  const cacheKey = `${name}:${getAdminCacheScopeKey(currentUser)}`;
  const cached = adminDataCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const data = await loader();
  adminDataCache.set(cacheKey, {
    data,
    expiresAt: Date.now() + ADMIN_CACHE_TTL_MS
  });
  return data;
}

export function clearAdminDataCache() {
  adminDataCache.clear();
}

function getSystemCompanyName() {
  return String(process.env.SUPER_ADMIN_COMPANY || "Integraxx Platform").trim();
}

function isSystemCompany(company) {
  return Boolean(company && String(company.name || "").trim() === getSystemCompanyName());
}

function isSystemDepartment(department) {
  return Boolean(
    department &&
      String(department.slug || "").trim() === "administracao-global" &&
      isSystemCompany(department.company)
  );
}

function serializeDepartment(department, userCount = 0, adminCount = 0) {
  return {
    id: department.id,
    name: department.name,
    slug: department.slug,
    description: department.description,
    active: department.active,
    companyId: department.companyId,
    company: department.company
      ? {
          id: department.company.id,
          name: department.company.name
        }
      : null,
    userCount,
    adminCount,
    createdAt: department.createdAt,
    updatedAt: department.updatedAt
  };
}

function serializeAdminRecord(user, permissions = []) {
  const normalizedRole = normalizeRole(user.role);
  const resolvedPermissions =
    normalizedRole === ROLES.SUPER_ADMIN
      ? ROLE_PERMISSION_MAP[ROLES.SUPER_ADMIN] || []
      : permissions.length
      ? permissions
      : ROLE_PERMISSION_MAP[normalizedRole] || [];

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: normalizedRole,
    active: user.active,
    companyId: user.companyId,
    departmentId: user.departmentId,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    company: user.company || null,
    department: user.department || null,
    permissions: resolvedPermissions,
    permissionsSource:
      normalizedRole === ROLES.SUPER_ADMIN ? "role" : permissions.length ? "custom" : "role"
  };
}

function serializeLog(item) {
  return {
    id: item.id,
    action: item.action,
    entity: item.entity,
    entityId: item.entityId,
    details: item.details,
    createdAt: item.createdAt,
    user: item.user || null
  };
}

async function countByCompany(client, table, companyId) {
  const result = await client
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("companyId", companyId);

  if (result.error) {
    return 0;
  }

  return result.count || 0;
}

async function enrichCompanies(companies) {
  const client = getSupabaseAdmin();

  return Promise.all(
    companies.map(async (company) => {
      const [users, departments, suppliers, categories] = await Promise.all([
        countByCompany(client, "User", company.id),
        countByCompany(client, "Department", company.id),
        countByCompany(client, "Supplier", company.id),
        countByCompany(client, "Category", company.id)
      ]);

      return {
        ...company,
        _count: {
          users: users || 0,
          departments: departments || 0,
          suppliers: suppliers || 0,
          categories: categories || 0
        }
      };
    })
  );
}

async function loadPermissionKeysByUserIds(userIds = []) {
  if (!userIds.length) {
    return new Map();
  }

  const client = getSupabaseAdmin();
  const links = throwIfSupabaseError(
    await client.from("UserPermission").select("userId,permissionId").in("userId", userIds),
    "listar permissoes de usuario"
  );

  if (!links.length) {
    return new Map();
  }

  const permissionIds = [...new Set(links.map((item) => item.permissionId))];
  const permissions = throwIfSupabaseError(
    await client.from("Permission").select("id,key").in("id", permissionIds),
    "listar permissoes"
  );
  const permissionMap = new Map(permissions.map((item) => [item.id, item.key]));
  const result = new Map();

  for (const link of links) {
    const key = permissionMap.get(link.permissionId);
    if (!key) continue;
    if (!result.has(link.userId)) {
      result.set(link.userId, []);
    }
    result.get(link.userId).push(key);
  }

  return result;
}

async function loadUsersWithRelations(filter = {}) {
  const client = getSupabaseAdmin();
  let query = client.from("User").select(USER_ADMIN_COLUMNS);

  if (filter.role) {
    query = query.eq("role", filter.role);
  }

  if (filter.companyId) {
    query = query.eq("companyId", filter.companyId);
  }

  if (filter.departmentId) {
    query = query.eq("departmentId", filter.departmentId);
  }

  const users = throwIfSupabaseError(await query.order("name"), "listar usuarios");

  const companies = throwIfSupabaseError(
    await client.from("Company").select("id,name"),
    "listar empresas"
  );
  const departments = throwIfSupabaseError(
    await client.from("Department").select("id,name,slug,companyId"),
    "listar departamentos"
  );
  const permissionMap = await loadPermissionKeysByUserIds(users.map((user) => user.id));

  const companyMap = new Map(companies.map((item) => [item.id, item]));
  const departmentMap = new Map(departments.map((item) => [item.id, item]));

  return users.map((user) => ({
    ...user,
    company: companyMap.get(user.companyId) || null,
    department: departmentMap.get(user.departmentId) || null,
    permissionKeys: permissionMap.get(user.id) || []
  }));
}

async function buildSettings(currentUser) {
  const client = getSupabaseAdmin();
  const currentRole = normalizeRole(currentUser.role);
  const actorAllowedKeys =
    currentRole === ROLES.SUPER_ADMIN
      ? null
      : Array.isArray(currentUser.permissions)
      ? currentUser.permissions
      : [];

  let companiesQuery = client.from("Company").select("id,name").order("name");

  if (currentRole !== ROLES.SUPER_ADMIN) {
    companiesQuery = companiesQuery.eq("id", Number(currentUser.companyId));
  }

  const companies = throwIfSupabaseError(await companiesQuery, "listar empresas");

  let permissionsQuery = client.from("Permission").select(PERMISSION_COLUMNS).order("key");

  if (actorAllowedKeys?.length) {
    permissionsQuery = permissionsQuery.in("key", actorAllowedKeys);
  }

  const permissions = throwIfSupabaseError(await permissionsQuery, "listar permissoes");
  const enrichedCompanies = await enrichCompanies(companies);
  const visibleCompanies =
    currentRole === ROLES.SUPER_ADMIN
      ? enrichedCompanies.filter((item) => !isSystemCompany(item))
      : enrichedCompanies;

  return {
    companies: visibleCompanies,
    permissionCatalog: permissions.map((item) => ({
      ...item,
      enabledByDefaultFor: Object.entries(ROLE_PERMISSION_MAP)
        .filter(([, keys]) => keys.includes(item.key))
        .map(([role]) => role)
    })),
    rolePermissionTemplates: {
      admin: ROLE_PERMISSION_MAP[ROLES.ADMIN] || [],
      user: ROLE_PERMISSION_MAP[ROLES.USER] || []
    },
    adminRoutes: [
      "/admin",
      "/admin/usuarios",
      "/admin/admins",
      "/admin/departamentos",
      "/admin/configuracoes"
    ],
    featureFlags: {
      multiCompanyReady: currentRole === ROLES.SUPER_ADMIN,
      departmentScoping: true,
      rbacEnabled: true,
      customUserPermissions: true
    }
  };
}

async function buildOverview(currentUser) {
  const client = getSupabaseAdmin();
  const currentRole = normalizeRole(currentUser.role);

  if (currentRole === ROLES.SUPER_ADMIN) {
    const [companies, departments, users, admins, logs, allUsers] = await Promise.all([
      throwIfSupabaseError(await client.from("Company").select("id,name"), "listar empresas"),
      throwIfSupabaseError(
        await client.from("Department").select(DEPARTMENT_COLUMNS).order("companyId").order("name"),
        "listar departamentos"
      ),
      throwIfSupabaseError(
        await client.from("User").select("id", { count: "exact", head: true }),
        "contar usuarios"
      ),
      throwIfSupabaseError(
        await client
          .from("User")
          .select("id", { count: "exact", head: true })
          .eq("role", ROLES.ADMIN),
        "contar admins"
      ),
      throwIfSupabaseError(
        await client
          .from("AuditLog")
          .select(AUDIT_LOG_COLUMNS)
          .order("createdAt", { ascending: false })
          .limit(10),
        "listar logs"
      ),
      throwIfSupabaseError(await client.from("User").select("id,role,departmentId,name,email,companyId"), "listar usuarios")
    ]);

    const companyMap = new Map(companies.map((item) => [item.id, item]));
    const userMap = new Map(allUsers.map((item) => [item.id, item]));
    const visibleCompanies = companies.filter((item) => !isSystemCompany(item));
    const visibleDepartments = departments
      .filter((item) => !isSystemDepartment({ ...item, company: companyMap.get(item.companyId) }))
      .map((department) => {
        const departmentUsers = allUsers.filter((user) => Number(user.departmentId) === Number(department.id));
        return serializeDepartment(
          { ...department, company: companyMap.get(department.companyId) || null },
          departmentUsers.length,
          departmentUsers.filter((user) => normalizeRole(user.role) === ROLES.ADMIN).length
        );
      });

    return {
      mode: "SUPER_ADMIN",
      stats: {
        companies: visibleCompanies.length,
        departments: visibleDepartments.length,
        users: users?.count ?? 0,
        admins: admins?.count ?? 0
      },
      departments: visibleDepartments,
      recentLogs: logs.map((item) => serializeLog({ ...item, user: userMap.get(item.userId) || null }))
    };
  }

  const departmentId = Number(currentUser.departmentId);
  const departmentRow = throwIfSupabaseError(
    await client.from("Department").select(DEPARTMENT_COLUMNS).eq("id", departmentId).maybeSingle(),
    "buscar departamento"
  );
  const departmentCompany = departmentRow
    ? throwIfSupabaseError(
        await client.from("Company").select("id,name").eq("id", departmentRow.companyId).maybeSingle(),
        "buscar empresa do departamento"
      )
    : null;
  const department = departmentRow
    ? { ...departmentRow, company: departmentCompany }
    : null;

  const users = await loadUsersWithRelations({
    companyId: currentUser.companyId,
    departmentId
  });

  const logs = throwIfSupabaseError(
    await client
      .from("AuditLog")
      .select(AUDIT_LOG_COLUMNS)
      .order("createdAt", { ascending: false })
      .limit(50),
    "listar logs"
  );
  const scopedLogs = logs
    .filter((item) => {
      const logUser = users.find((user) => Number(user.id) === Number(item.userId));
      return logUser && Number(logUser.companyId) === Number(currentUser.companyId);
    })
    .slice(0, 10);

  return {
    mode: "ADMIN",
    stats: {
      users: users.length,
      activeUsers: users.filter((item) => item.active).length,
      inactiveUsers: users.filter((item) => !item.active).length,
      departmentName: department?.name || "Sem departamento"
    },
    department: department
      ? serializeDepartment(
          { ...department, company: department.company },
          users.length,
          users.filter((item) => normalizeRole(item.role) === ROLES.ADMIN).length
        )
      : null,
    recentLogs: scopedLogs.map((item) =>
      serializeLog({
        ...item,
        user: users.find((user) => Number(user.id) === Number(item.userId)) || null
      })
    )
  };
}

async function buildDepartments(currentUser) {
  const client = getSupabaseAdmin();
  const currentRole = normalizeRole(currentUser.role);

  let query = client.from("Department").select(DEPARTMENT_COLUMNS).order("companyId").order("name");

  if (currentRole !== ROLES.SUPER_ADMIN) {
    query = query.eq("companyId", currentUser.companyId).eq("id", currentUser.departmentId);
  }

  const departments = throwIfSupabaseError(await query, "listar departamentos");
  const companies = throwIfSupabaseError(await client.from("Company").select("id,name"), "listar empresas");
  const companyMap = new Map(companies.map((item) => [item.id, item]));
  const allUsers = throwIfSupabaseError(await client.from("User").select("id,role,departmentId"), "listar usuarios");

  const visibleDepartments =
    currentRole === ROLES.SUPER_ADMIN
      ? departments.filter((item) => !isSystemDepartment({ ...item, company: companyMap.get(item.companyId) }))
      : departments;

  return visibleDepartments.map((department) => {
    const departmentUsers = allUsers.filter((user) => Number(user.departmentId) === Number(department.id));
    return serializeDepartment(
      { ...department, company: companyMap.get(department.companyId) || null },
      departmentUsers.length,
      departmentUsers.filter((user) => normalizeRole(user.role) === ROLES.ADMIN).length
    );
  });
}

export async function listUsers(currentUser) {
  const currentRole = normalizeRole(currentUser.role);
  const filter =
    currentRole === ROLES.SUPER_ADMIN
      ? { role: ROLES.USER }
      : {
          role: ROLES.USER,
          companyId: currentUser.companyId,
          departmentId: currentUser.departmentId
        };

  const users = await loadUsersWithRelations(filter);
  return users.map((user) => serializeAdminRecord(user, user.permissionKeys || []));
}

export async function getSettings(currentUser) {
  return withAdminCache(currentUser, "settings", () => buildSettings(currentUser));
}

export async function getOverview(currentUser) {
  return withAdminCache(currentUser, "overview", () => buildOverview(currentUser));
}

export async function listDepartments(currentUser) {
  return withAdminCache(currentUser, "departments", () => buildDepartments(currentUser));
}

export async function listAdmins(currentUser) {
  if (normalizeRole(currentUser.role) !== ROLES.SUPER_ADMIN) {
    throw new Error("Acesso permitido somente ao SUPER_ADMIN");
  }

  const currentRole = normalizeRole(currentUser.role);
  const filter =
    currentRole === ROLES.SUPER_ADMIN
      ? { role: ROLES.ADMIN }
      : {
          role: ROLES.ADMIN,
          companyId: currentUser.companyId,
          departmentId: currentUser.departmentId
        };

  const users = await loadUsersWithRelations(filter);
  return users.map((user) => serializeAdminRecord(user, user.permissionKeys || []));
}
