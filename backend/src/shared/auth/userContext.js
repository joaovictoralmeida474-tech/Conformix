import { ROLE_PERMISSION_MAP, ROLES, normalizeRole } from "./permissions.js";
import { getSupabaseAdmin, throwIfSupabaseError } from "../database/supabaseStore.js";

function serializeDepartment(department) {
  if (!department) return null;

  return {
    id: department.id,
    name: department.name,
    slug: department.slug,
    active: department.active,
    companyId: department.companyId
  };
}

function serializeCompany(company) {
  if (!company) return null;

  return {
    id: company.id,
    name: company.name
  };
}

export function serializeUserContext(user) {
  const normalizedRole = normalizeRole(user.role);
  const rolePermissionsFromDb = (user.rolePermissions || [])
    .map((item) => item.permission?.key)
    .filter(Boolean);
  const userPermissionsFromDb = (user.userPermissions || [])
    .map((item) => item.permission?.key)
    .filter(Boolean);
  const permissions =
    normalizedRole === ROLES.SUPER_ADMIN
      ? ROLE_PERMISSION_MAP[ROLES.SUPER_ADMIN] || []
      : userPermissionsFromDb.length
      ? userPermissionsFromDb
      : rolePermissionsFromDb.length
      ? rolePermissionsFromDb
      : ROLE_PERMISSION_MAP[normalizedRole] || [];
  const isSuperAdmin = normalizedRole === ROLES.SUPER_ADMIN;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: normalizedRole,
    active: user.active,
    companyId: isSuperAdmin ? null : user.companyId,
    departmentId: isSuperAdmin ? null : user.departmentId || null,
    company: isSuperAdmin ? null : serializeCompany(user.company),
    department: isSuperAdmin ? null : serializeDepartment(user.department),
    permissions,
    permissionsSource:
      normalizedRole === ROLES.SUPER_ADMIN ? "role" : userPermissionsFromDb.length ? "custom" : "role"
  };
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export async function getUserContextById(userId, options = {}) {
  if (!userId && !options.email) return null;

  const numericId = Number(userId);
  const client = getSupabaseAdmin();

  if (!Number.isInteger(numericId) || numericId <= 0) {
    const email = normalizeEmail(options.email);

    if (!email) {
      return null;
    }

    const userByEmail = throwIfSupabaseError(
      await client.from("User").select("*").eq("email", email).maybeSingle(),
      "buscar usuario por email"
    );

    if (!userByEmail || !userByEmail.active) {
      return null;
    }

    return getUserContextById(userByEmail.id);
  }

  const user = throwIfSupabaseError(
    await client.from("User").select("*").eq("id", numericId).maybeSingle(),
    "buscar usuario"
  );

  if (!user || !user.active) {
    return null;
  }

  const [company, department, userPermissionLinks, rolePermissionLinks] = await Promise.all([
    user.companyId
      ? throwIfSupabaseError(
          await client.from("Company").select("id,name").eq("id", user.companyId).maybeSingle(),
          "buscar empresa"
        )
      : null,
    user.departmentId
      ? throwIfSupabaseError(
          await client
            .from("Department")
            .select("id,name,slug,active,companyId")
            .eq("id", user.departmentId)
            .maybeSingle(),
          "buscar departamento"
        )
      : null,
    throwIfSupabaseError(
      await client.from("UserPermission").select("permissionId").eq("userId", numericId),
      "buscar permissoes do usuario"
    ),
    throwIfSupabaseError(
      await client.from("RolePermission").select("permissionId").eq("role", normalizeRole(user.role)),
      "buscar permissoes da role"
    )
  ]);

  const permissionIds = [
    ...new Set([
      ...userPermissionLinks.map((item) => item.permissionId),
      ...rolePermissionLinks.map((item) => item.permissionId)
    ])
  ];

  let permissions = [];

  if (permissionIds.length) {
    permissions = throwIfSupabaseError(
      await client.from("Permission").select("id,key").in("id", permissionIds),
      "buscar permissoes"
    );
  }

  const permissionKeyMap = new Map(permissions.map((item) => [item.id, item.key]));
  const userPermissions = userPermissionLinks
    .map((item) => ({ permission: { key: permissionKeyMap.get(item.permissionId) } }))
    .filter((item) => item.permission.key);
  const rolePermissions = rolePermissionLinks
    .map((item) => ({ permission: { key: permissionKeyMap.get(item.permissionId) } }))
    .filter((item) => item.permission.key);

  return serializeUserContext({
    ...user,
    company,
    department,
    userPermissions,
    rolePermissions
  });
}
