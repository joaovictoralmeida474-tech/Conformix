import bcrypt from "bcryptjs";

import { ROLES, normalizeRole } from "../../shared/auth/permissions.js";
import { getUserContextById } from "../../shared/auth/userContext.js";
import { log as writeAuditLog } from "../audit/auditService.js";
import {
  deleteSupabaseUser,
  updateSupabaseUserPassword,
  upsertSupabaseUser
} from "../../shared/integrations/supabaseAdmin.js";
import { assertStrongPassword } from "../../shared/utils/passwordPolicy.js";
import { getSupabaseAdmin, throwIfSupabaseError } from "../../shared/database/supabaseStore.js";
import * as repo from "../../shared/database/supabaseRepo.js";

function slugify(value) {
  return (
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "departamento"
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
    company: department.company || null,
    userCount,
    adminCount,
    createdAt: department.createdAt,
    updatedAt: department.updatedAt
  };
}

async function attachDepartmentCompany(department) {
  if (!department) return null;
  const company = await repo.findById("Company", department.companyId);
  return { ...department, company: company ? { id: company.id, name: company.name } : null };
}

async function countDepartmentUsers(departmentId) {
  const users = await repo.findMany("User", { departmentId: Number(departmentId) }, { select: "id,role" });
  return {
    total: users.length,
    admins: users.filter((user) => normalizeRole(user.role) === ROLES.ADMIN).length
  };
}

async function ensureUniqueEmail(email, currentId = null) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) throw new Error("Email obrigatorio");

  const existing = await repo.findOne("User", { email: normalizedEmail });
  if (existing && Number(existing.id) !== Number(currentId)) {
    throw new Error("Email ja cadastrado");
  }

  return normalizedEmail;
}

async function ensureCompanyScope(currentUser, companyId) {
  const company = await repo.findById("Company", companyId);
  if (!company) throw new Error("Empresa nao encontrada");

  if (
    normalizeRole(currentUser.role) !== ROLES.SUPER_ADMIN &&
    Number(currentUser.companyId) !== Number(companyId)
  ) {
    throw new Error("Empresa fora do escopo do administrador");
  }

  return company;
}

async function ensureDepartmentForAdminScope(currentUser, departmentId) {
  const department = await repo.findById("Department", departmentId);
  if (!department) throw new Error("Departamento nao encontrado");

  if (normalizeRole(currentUser.role) !== ROLES.SUPER_ADMIN) {
    if (Number(currentUser.companyId) !== Number(department.companyId)) {
      throw new Error("Departamento fora do escopo do administrador");
    }
    if (Number(currentUser.departmentId) !== Number(department.id)) {
      throw new Error("Administrador nao pode operar outro departamento");
    }
  }

  return department;
}

async function getPermissionCatalog() {
  return repo.findMany("Permission", {}, { orderBy: { key: true } });
}

async function resolvePermissionKeysForTarget(currentUser, requestedKeys = []) {
  const catalog = await getPermissionCatalog();
  const catalogMap = new Map(catalog.map((item) => [item.key, item]));
  const actorRole = normalizeRole(currentUser.role);
  const actorAllowedKeys =
    actorRole === ROLES.SUPER_ADMIN
      ? catalog.map((item) => item.key)
      : Array.isArray(currentUser.permissions)
      ? currentUser.permissions
      : [];

  const normalizedKeys = [...new Set((requestedKeys || []).filter(Boolean).map((item) => String(item).trim()))];
  const invalidKey = normalizedKeys.find((key) => !catalogMap.has(key));
  if (invalidKey) throw new Error(`Permissao invalida: ${invalidKey}`);

  const unauthorizedKey = normalizedKeys.find((key) => !actorAllowedKeys.includes(key));
  if (unauthorizedKey) throw new Error(`Sem permissao para conceder acesso a: ${unauthorizedKey}`);

  return normalizedKeys;
}

async function syncUserPermissions(userId, permissionKeys = []) {
  await repo.deleteWhere("UserPermission", { userId: Number(userId) });
  if (!permissionKeys.length) return;

  const permissions = await repo.findMany("Permission", {}, { select: "id,key" });
  const permissionMap = new Map(permissions.map((item) => [item.key, item.id]));

  for (const key of permissionKeys) {
    const permissionId = permissionMap.get(key);
    if (!permissionId) continue;
    await repo.insertRow(
      "UserPermission",
      { userId: Number(userId), permissionId },
      { single: false }
    );
  }
}

async function resolveScopedCompanyAndDepartment({ currentUser, targetRole, companyId, departmentId }) {
  const actorRole = normalizeRole(currentUser.role);
  const normalizedTargetRole = normalizeRole(targetRole);

  if (actorRole !== ROLES.SUPER_ADMIN) {
    const scopedDepartment = await ensureDepartmentForAdminScope(
      currentUser,
      departmentId || currentUser.departmentId
    );
    return {
      companyId: Number(currentUser.companyId),
      department: normalizedTargetRole === ROLES.SUPER_ADMIN ? null : scopedDepartment
    };
  }

  if (normalizedTargetRole === ROLES.SUPER_ADMIN) {
    const company = await ensureCompanyScope(currentUser, companyId || currentUser.companyId);
    return { companyId: company.id, department: null };
  }

  if (!departmentId) throw new Error("Departamento obrigatorio");

  const department = await ensureDepartmentForAdminScope(currentUser, departmentId);
  const resolvedCompanyId = Number(companyId || department.companyId);

  if (Number(department.companyId) !== resolvedCompanyId) {
    throw new Error("Departamento nao pertence a empresa selecionada");
  }

  await ensureCompanyScope(currentUser, resolvedCompanyId);
  return { companyId: resolvedCompanyId, department };
}

async function createUserWithRole({
  currentUser,
  name,
  email,
  password,
  role,
  departmentId,
  companyId,
  active = true,
  permissionKeys = []
}) {
  const normalizedRole = normalizeRole(role);
  const normalizedEmail = await ensureUniqueEmail(email);

  if (!password) throw new Error("Email e senha sao obrigatorios");
  assertStrongPassword(password);

  if (normalizeRole(currentUser.role) === ROLES.ADMIN && normalizedRole !== ROLES.USER) {
    throw new Error("ADMIN so pode criar usuarios comuns");
  }

  const scope = await resolveScopedCompanyAndDepartment({
    currentUser,
    targetRole: normalizedRole,
    companyId,
    departmentId
  });
  const hash = await bcrypt.hash(password, 10);
  const resolvedPermissionKeys = await resolvePermissionKeysForTarget(currentUser, permissionKeys);

  const user = await repo.insertRow("User", {
    name: String(name || "").trim() || "Usuario",
    email: normalizedEmail,
    password: hash,
    role: normalizedRole,
    active: Boolean(active),
    companyId: scope.companyId,
    departmentId: scope.department?.id || null
  });

  await syncUserPermissions(user.id, resolvedPermissionKeys);

  try {
    const supabaseUser = await upsertSupabaseUser({
      email: normalizedEmail,
      password,
      name: user.name,
      role: normalizedRole,
      companyId: scope.companyId,
      departmentId: scope.department?.id || null,
      active: Boolean(active)
    });

    if (supabaseUser?.id) {
      await repo.updateRow("User", user.id, { authUserId: supabaseUser.id });
    }
  } catch (error) {
    await repo.deleteWhere("UserPermission", { userId: user.id });
    await repo.deleteRow("User", user.id);
    throw error;
  }

  return getUserContextById(user.id);
}

async function assertUserScope(currentUser, user, expectedRole) {
  if (!user || normalizeRole(user.role) !== expectedRole) {
    throw new Error(expectedRole === ROLES.ADMIN ? "Admin nao encontrado" : "Usuario nao encontrado");
  }

  if (normalizeRole(currentUser.role) !== ROLES.SUPER_ADMIN) {
    if (
      Number(user.companyId) !== Number(currentUser.companyId) ||
      Number(user.departmentId) !== Number(currentUser.departmentId)
    ) {
      throw new Error(
        expectedRole === ROLES.ADMIN
          ? "Admin fora do escopo do administrador"
          : "Usuario fora do escopo do administrador"
      );
    }
  }
}

export async function createUser(currentUser, payload) {
  const createdUser = await createUserWithRole({
    currentUser,
    name: payload.name,
    email: payload.email,
    password: payload.password,
    role: ROLES.USER,
    departmentId:
      normalizeRole(currentUser.role) === ROLES.SUPER_ADMIN
        ? payload.departmentId
        : currentUser.departmentId,
    companyId: payload.companyId || currentUser.companyId,
    active: payload.active ?? true,
    permissionKeys: payload.permissionKeys || []
  });

  await writeAuditLog(currentUser.id, "create", {
    entity: "user",
    entityId: createdUser.id,
    details: `Usuario ${createdUser.name} criado`
  });

  return createdUser;
}

export async function updateUser(currentUser, userId, payload) {
  const user = await repo.findById("User", userId);
  await assertUserScope(currentUser, user, ROLES.USER);

  const scope = await resolveScopedCompanyAndDepartment({
    currentUser,
    targetRole: ROLES.USER,
    companyId: payload.companyId || user.companyId,
    departmentId:
      normalizeRole(currentUser.role) === ROLES.SUPER_ADMIN
        ? payload.departmentId || user.departmentId
        : currentUser.departmentId
  });
  const normalizedEmail = payload.email ? await ensureUniqueEmail(payload.email, user.id) : user.email;
  const resolvedPermissionKeys = await resolvePermissionKeysForTarget(
    currentUser,
    payload.permissionKeys || []
  );

  const updatedUser = await repo.updateRow("User", userId, {
    name: String(payload.name || user.name).trim() || user.name,
    email: normalizedEmail,
    active: payload.active ?? user.active,
    companyId: scope.companyId,
    departmentId: scope.department?.id || null
  });

  await syncUserPermissions(userId, resolvedPermissionKeys);

  const supabaseUser = await upsertSupabaseUser({
    email: normalizedEmail,
    name: updatedUser.name,
    role: ROLES.USER,
    companyId: scope.companyId,
    departmentId: scope.department?.id || null,
    active: payload.active ?? user.active
  });

  if (supabaseUser?.id && supabaseUser.id !== updatedUser.authUserId) {
    await repo.updateRow("User", userId, { authUserId: supabaseUser.id });
  }

  await writeAuditLog(currentUser.id, "update", {
    entity: "user",
    entityId: Number(userId),
    details: `Usuario ${updatedUser.name} atualizado`
  });

  return getUserContextById(userId);
}

export async function setUserStatus(currentUser, userId, active) {
  const user = await repo.findById("User", userId);
  await assertUserScope(currentUser, user, ROLES.USER);

  const updatedUser = await repo.updateRow("User", userId, { active: Boolean(active) });
  const supabaseUser = await upsertSupabaseUser({
    email: updatedUser.email,
    name: updatedUser.name,
    role: updatedUser.role,
    companyId: updatedUser.companyId,
    departmentId: updatedUser.departmentId,
    active: Boolean(active)
  });

  if (supabaseUser?.id && supabaseUser.id !== updatedUser.authUserId) {
    await repo.updateRow("User", userId, { authUserId: supabaseUser.id });
  }

  await writeAuditLog(currentUser.id, "update", {
    entity: "user",
    entityId: Number(userId),
    details: `Usuario ${user.name} ${active ? "ativado" : "desativado"}`
  });

  return getUserContextById(userId);
}

export async function deleteUser(currentUser, userId) {
  const user = await repo.findById("User", userId);
  await assertUserScope(currentUser, user, ROLES.USER);

  if (user.authUserId) await deleteSupabaseUser(user.authUserId);
  await repo.deleteWhere("UserPermission", { userId: Number(userId) });
  await repo.deleteRow("User", userId);

  await writeAuditLog(currentUser.id, "delete", {
    entity: "user",
    entityId: Number(userId),
    details: `Usuario ${user.name} excluido`
  });
}

export async function resetUserPassword(currentUser, userId, password) {
  const user = await repo.findById("User", userId);
  await assertUserScope(currentUser, user, ROLES.USER);

  assertStrongPassword(password);
  const hash = await bcrypt.hash(String(password || ""), 10);
  const updatedUser = await repo.updateRow("User", userId, { password: hash });

  if (updatedUser.authUserId) {
    await updateSupabaseUserPassword(updatedUser.authUserId, password);
  } else {
    const supabaseUser = await upsertSupabaseUser({
      email: updatedUser.email,
      password,
      name: updatedUser.name,
      role: updatedUser.role,
      companyId: updatedUser.companyId,
      departmentId: updatedUser.departmentId,
      active: updatedUser.active
    });
    if (supabaseUser?.id) {
      await repo.updateRow("User", userId, { authUserId: supabaseUser.id });
    }
  }

  await writeAuditLog(currentUser.id, "update", {
    entity: "user",
    entityId: Number(userId),
    details: `Senha do usuario ${user.name} redefinida`
  });
}

export async function createAdmin(currentUser, payload) {
  if (normalizeRole(currentUser.role) !== ROLES.SUPER_ADMIN) {
    throw new Error("Acesso permitido somente ao SUPER_ADMIN");
  }

  const createdAdmin = await createUserWithRole({
    currentUser,
    name: payload.name,
    email: payload.email,
    password: payload.password,
    role: ROLES.ADMIN,
    departmentId: payload.departmentId,
    companyId: payload.companyId,
    active: payload.active ?? true,
    permissionKeys: payload.permissionKeys || []
  });

  await writeAuditLog(currentUser.id, "create", {
    entity: "admin",
    entityId: createdAdmin.id,
    details: `Admin ${createdAdmin.name} criado`
  });

  return createdAdmin;
}

export async function updateAdmin(currentUser, adminId, payload) {
  if (normalizeRole(currentUser.role) !== ROLES.SUPER_ADMIN) {
    throw new Error("Acesso permitido somente ao SUPER_ADMIN");
  }

  const admin = await repo.findById("User", adminId);
  if (!admin || normalizeRole(admin.role) !== ROLES.ADMIN) throw new Error("Admin nao encontrado");

  const scope = await resolveScopedCompanyAndDepartment({
    currentUser,
    targetRole: ROLES.ADMIN,
    companyId: payload.companyId || admin.companyId,
    departmentId: payload.departmentId || admin.departmentId
  });
  const normalizedEmail = payload.email ? await ensureUniqueEmail(payload.email, admin.id) : admin.email;
  const resolvedPermissionKeys = await resolvePermissionKeysForTarget(
    currentUser,
    payload.permissionKeys || []
  );

  const updatedAdmin = await repo.updateRow("User", adminId, {
    name: String(payload.name || admin.name).trim() || admin.name,
    email: normalizedEmail,
    departmentId: scope.department?.id || null,
    companyId: scope.companyId,
    active: payload.active ?? admin.active
  });

  await syncUserPermissions(adminId, resolvedPermissionKeys);

  const supabaseAdmin = await upsertSupabaseUser({
    email: normalizedEmail,
    name: updatedAdmin.name,
    role: ROLES.ADMIN,
    companyId: scope.companyId,
    departmentId: scope.department?.id || null,
    active: payload.active ?? admin.active
  });

  if (supabaseAdmin?.id && supabaseAdmin.id !== updatedAdmin.authUserId) {
    await repo.updateRow("User", adminId, { authUserId: supabaseAdmin.id });
  }

  await writeAuditLog(currentUser.id, "update", {
    entity: "admin",
    entityId: Number(adminId),
    details: `Admin ${updatedAdmin.name} atualizado`
  });

  return getUserContextById(adminId);
}

export async function setAdminStatus(currentUser, adminId, active) {
  if (normalizeRole(currentUser.role) !== ROLES.SUPER_ADMIN) {
    throw new Error("Acesso permitido somente ao SUPER_ADMIN");
  }

  const admin = await repo.findById("User", adminId);
  if (!admin || normalizeRole(admin.role) !== ROLES.ADMIN) throw new Error("Admin nao encontrado");

  const updatedAdmin = await repo.updateRow("User", adminId, { active: Boolean(active) });
  const supabaseAdmin = await upsertSupabaseUser({
    email: updatedAdmin.email,
    name: updatedAdmin.name,
    role: updatedAdmin.role,
    companyId: updatedAdmin.companyId,
    departmentId: updatedAdmin.departmentId,
    active: Boolean(active)
  });

  if (supabaseAdmin?.id && supabaseAdmin.id !== updatedAdmin.authUserId) {
    await repo.updateRow("User", adminId, { authUserId: supabaseAdmin.id });
  }

  await writeAuditLog(currentUser.id, "update", {
    entity: "admin",
    entityId: Number(adminId),
    details: `Admin ${admin.name} ${active ? "ativado" : "desativado"}`
  });

  return getUserContextById(adminId);
}

export async function deleteAdmin(currentUser, adminId) {
  if (normalizeRole(currentUser.role) !== ROLES.SUPER_ADMIN) {
    throw new Error("Acesso permitido somente ao SUPER_ADMIN");
  }

  const admin = await repo.findById("User", adminId);
  if (!admin || normalizeRole(admin.role) !== ROLES.ADMIN) throw new Error("Admin nao encontrado");

  if (admin.authUserId) await deleteSupabaseUser(admin.authUserId);
  await repo.deleteWhere("UserPermission", { userId: Number(adminId) });
  await repo.deleteRow("User", adminId);

  await writeAuditLog(currentUser.id, "delete", {
    entity: "admin",
    entityId: Number(adminId),
    details: `Admin ${admin.name} excluido`
  });
}

export async function resetAdminPassword(currentUser, adminId, password) {
  if (normalizeRole(currentUser.role) !== ROLES.SUPER_ADMIN) {
    throw new Error("Acesso permitido somente ao SUPER_ADMIN");
  }

  const admin = await repo.findById("User", adminId);
  if (!admin || normalizeRole(admin.role) !== ROLES.ADMIN) throw new Error("Admin nao encontrado");

  assertStrongPassword(password);
  const hash = await bcrypt.hash(String(password || ""), 10);
  const updatedAdmin = await repo.updateRow("User", adminId, { password: hash });

  if (updatedAdmin.authUserId) {
    await updateSupabaseUserPassword(updatedAdmin.authUserId, password);
  } else {
    const supabaseAdmin = await upsertSupabaseUser({
      email: updatedAdmin.email,
      password,
      name: updatedAdmin.name,
      role: updatedAdmin.role,
      companyId: updatedAdmin.companyId,
      departmentId: updatedAdmin.departmentId,
      active: updatedAdmin.active
    });
    if (supabaseAdmin?.id) {
      await repo.updateRow("User", adminId, { authUserId: supabaseAdmin.id });
    }
  }

  await writeAuditLog(currentUser.id, "update", {
    entity: "admin",
    entityId: Number(adminId),
    details: `Senha do admin ${admin.name} redefinida`
  });
}

export async function createDepartment(currentUser, payload) {
  if (normalizeRole(currentUser.role) !== ROLES.SUPER_ADMIN) {
    throw new Error("Acesso permitido somente ao SUPER_ADMIN");
  }

  const company = await ensureCompanyScope(currentUser, payload.companyId);
  const name = String(payload.name || "").trim();
  if (!name) throw new Error("Nome do departamento obrigatorio");

  const department = await repo.insertRow("Department", {
    companyId: company.id,
    name,
    slug: slugify(payload.slug || name),
    description: String(payload.description || "").trim() || null,
    active: payload.active ?? true
  });

  const withCompany = await attachDepartmentCompany(department);

  await writeAuditLog(currentUser.id, "create", {
    entity: "department",
    entityId: department.id,
    details: `Departamento ${department.name} criado`
  });

  return serializeDepartment(withCompany, 0, 0);
}

export async function updateDepartment(currentUser, departmentId, payload) {
  if (normalizeRole(currentUser.role) !== ROLES.SUPER_ADMIN) {
    throw new Error("Acesso permitido somente ao SUPER_ADMIN");
  }

  const existing = await repo.findById("Department", departmentId);
  if (!existing) throw new Error("Departamento nao encontrado");

  const company = await ensureCompanyScope(currentUser, payload.companyId || existing.companyId);
  const nextName = payload.name ? String(payload.name).trim() : existing.name;
  const nextSlug = payload.slug ? slugify(payload.slug) : existing.slug;
  if (!nextName) throw new Error("Nome do departamento obrigatorio");

  const updated = await repo.updateRow("Department", departmentId, {
    companyId: company.id,
    name: nextName,
    slug: nextSlug,
    description:
      payload.description !== undefined
        ? String(payload.description || "").trim() || null
        : existing.description,
    active: payload.active ?? existing.active
  });

  const withCompany = await attachDepartmentCompany(updated);
  const counts = await countDepartmentUsers(departmentId);

  await writeAuditLog(currentUser.id, "update", {
    entity: "department",
    entityId: Number(departmentId),
    details: `Departamento ${updated.name} atualizado`
  });

  return serializeDepartment(withCompany, counts.total, counts.admins);
}

export async function deleteDepartment(currentUser, departmentId) {
  if (normalizeRole(currentUser.role) !== ROLES.SUPER_ADMIN) {
    throw new Error("Acesso permitido somente ao SUPER_ADMIN");
  }

  const existing = await repo.findById("Department", departmentId);
  if (!existing) throw new Error("Departamento nao encontrado");

  const userCount = await repo.countRows("User", { departmentId: Number(departmentId) });
  if (userCount > 0) {
    throw new Error("Nao e possivel excluir departamento com usuarios ou admins vinculados");
  }

  await repo.deleteRow("Department", departmentId);

  await writeAuditLog(currentUser.id, "delete", {
    entity: "department",
    entityId: Number(departmentId),
    details: `Departamento ${existing.name} excluido`
  });
}

export async function createCompany(currentUser, payload) {
  if (normalizeRole(currentUser.role) !== ROLES.SUPER_ADMIN) {
    throw new Error("Acesso permitido somente ao SUPER_ADMIN");
  }

  const name = String(payload.name || "").trim();
  const description = String(payload.description || "").trim();
  if (!name) throw new Error("Nome da empresa obrigatorio");

  const existing = await repo.findOne("Company", { name });
  if (existing) throw new Error("Empresa ja cadastrada");

  const company = await repo.insertRow("Company", { name }, { select: "id,name" });

  await writeAuditLog(currentUser.id, "create", {
    entity: "company",
    entityId: company.id,
    details: description ? `Empresa ${name} criada: ${description}` : `Empresa ${name} criada`
  });

  return {
    ...company,
    _count: { users: 0, departments: 0, suppliers: 0, categories: 0 }
  };
}

export async function deleteCompany(currentUser, companyId) {
  if (normalizeRole(currentUser.role) !== ROLES.SUPER_ADMIN) {
    throw new Error("Acesso permitido somente ao SUPER_ADMIN");
  }

  const existing = await repo.findById("Company", companyId);
  if (!existing) throw new Error("Empresa nao encontrada");

  const [users, suppliers, categories, alerts, departments] = await Promise.all([
    repo.countRows("User", { companyId: Number(companyId) }),
    repo.countRows("Supplier", { companyId: Number(companyId) }),
    repo.countRows("Category", { companyId: Number(companyId) }),
    repo.countRows("Alert", { companyId: Number(companyId) }),
    repo.findMany("Department", { companyId: Number(companyId) }, { select: "id,name" })
  ]);

  if (users + suppliers + categories + alerts > 0) {
    throw new Error("Nao e possivel excluir empresa com usuarios, fornecedores, categorias ou alertas vinculados");
  }

  for (const department of departments) {
    const departmentUsers = await repo.countRows("User", { departmentId: department.id });
    if (departmentUsers > 0) {
      throw new Error(
        "Nao e possivel excluir empresa com departamentos que ainda possuem usuarios ou admins vinculados"
      );
    }
  }

  if (departments.length) {
    await repo.deleteWhere("Department", { companyId: Number(companyId) });
  }

  await repo.deleteRow("Company", companyId);

  await writeAuditLog(currentUser.id, "delete", {
    entity: "company",
    entityId: Number(companyId),
    details: `Empresa ${existing.name} excluida`
  });
}

export async function listSystemLogs(currentUser) {
  if (normalizeRole(currentUser.role) !== ROLES.SUPER_ADMIN) {
    throw new Error("Acesso permitido somente ao SUPER_ADMIN");
  }

  const client = getSupabaseAdmin();
  const logs = throwIfSupabaseError(
    await client.from("AuditLog").select("*").order("createdAt", { ascending: false }).limit(50),
    "listar logs"
  );

  const userIds = [...new Set(logs.map((item) => item.userId).filter(Boolean))];
  let userMap = new Map();

  if (userIds.length) {
    const users = throwIfSupabaseError(
      await client
        .from("User")
        .select("id,name,email,role,companyId,departmentId")
        .in("id", userIds),
      "listar usuarios dos logs"
    );
    userMap = new Map(users.map((item) => [item.id, item]));
  }

  return logs.map((item) => ({
    id: item.id,
    action: item.action,
    entity: item.entity,
    entityId: item.entityId,
    details: item.details,
    createdAt: item.createdAt,
    user: userMap.get(item.userId) || null
  }));
}
