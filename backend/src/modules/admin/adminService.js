import bcrypt from "bcrypt";

import { prisma } from "../../shared/database/prisma.js";
import {
  ROLE_PERMISSION_MAP,
  ROLES,
  normalizeRole,
} from "../../shared/auth/permissions.js";
import { getUserContextById } from "../../shared/auth/userContext.js";
import { log as writeAuditLog } from "../audit/auditService.js";
import { assertStrongPassword } from "../../shared/utils/passwordPolicy.js";
import {
  deleteSupabaseUser,
  updateSupabaseUserPassword,
  upsertSupabaseUser
} from "../../shared/integrations/supabaseAdmin.js";

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "departamento";
}

function serializeDepartment(department) {
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
    userCount: department._count?.users || 0,
    adminCount:
      department.users?.filter((user) => normalizeRole(user.role) === ROLES.ADMIN).length || 0,
    createdAt: department.createdAt,
    updatedAt: department.updatedAt
  };
}

function serializeAdminRecord(user) {
  const normalizedRole = normalizeRole(user.role);
  const userPermissionsFromDb = (user.userPermissions || [])
    .map((item) => item.permission?.key)
    .filter(Boolean);
  const permissions =
    normalizedRole === ROLES.SUPER_ADMIN
      ? ROLE_PERMISSION_MAP[ROLES.SUPER_ADMIN] || []
      : userPermissionsFromDb.length
    ? userPermissionsFromDb
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
    company: user.company
      ? {
          id: user.company.id,
          name: user.company.name
        }
      : null,
    department: user.department
      ? {
          id: user.department.id,
          name: user.department.name,
          slug: user.department.slug
        }
      : null,
    permissions,
    permissionsSource:
      normalizedRole === ROLES.SUPER_ADMIN ? "role" : userPermissionsFromDb.length ? "custom" : "role"
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
    user: item.user
      ? {
          id: item.user.id,
          name: item.user.name,
          email: item.user.email,
          role: normalizeRole(item.user.role),
          companyId: item.user.companyId,
          departmentId: item.user.departmentId
        }
      : null
  };
}

function getSystemCompanyName() {
  return String(process.env.SUPER_ADMIN_COMPANY || "Conformix Platform").trim();
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

async function ensureDepartmentForAdminScope(currentUser, departmentId) {
  const department = await prisma.department.findUnique({
    where: {
      id: Number(departmentId)
    }
  });

  if (!department) {
    throw new Error("Departamento nao encontrado");
  }

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

async function ensureUniqueEmail(email, currentId = null) {
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error("Email obrigatorio");
  }

  const existing = await prisma.user.findUnique({
    where: {
      email: normalizedEmail
    }
  });

  if (existing && Number(existing.id) !== Number(currentId)) {
    throw new Error("Email ja cadastrado");
  }

  return normalizedEmail;
}

async function ensureCompanyScope(currentUser, companyId) {
  if (normalizeRole(currentUser.role) === ROLES.SUPER_ADMIN) {
    const company = await prisma.company.findUnique({
      where: {
        id: Number(companyId)
      }
    });

    if (!company) {
      throw new Error("Empresa nao encontrada");
    }

    return company;
  }

  if (Number(currentUser.companyId) !== Number(companyId)) {
    throw new Error("Empresa fora do escopo do administrador");
  }

  const company = await prisma.company.findUnique({
    where: {
      id: Number(companyId)
    }
  });

  if (!company) {
    throw new Error("Empresa nao encontrada");
  }

  return company;
}

async function getPermissionCatalog() {
  return prisma.permission.findMany({
    orderBy: {
      key: "asc"
    }
  });
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

  if (invalidKey) {
    throw new Error(`Permissao invalida: ${invalidKey}`);
  }

  const unauthorizedKey = normalizedKeys.find((key) => !actorAllowedKeys.includes(key));

  if (unauthorizedKey) {
    throw new Error(`Sem permissao para conceder acesso a: ${unauthorizedKey}`);
  }

  return normalizedKeys;
}

async function syncUserPermissions(userId, permissionKeys = []) {
  await prisma.userPermission.deleteMany({
    where: {
      userId: Number(userId)
    }
  });

  if (!permissionKeys.length) {
    return;
  }

  const permissions = await prisma.permission.findMany({
    where: {
      key: {
        in: permissionKeys
      }
    },
    select: {
      id: true
    }
  });

  if (!permissions.length) {
    return;
  }

  await prisma.$transaction(
    permissions.map((item) =>
      prisma.userPermission.create({
        data: {
          userId: Number(userId),
          permissionId: item.id
        }
      })
    )
  );
}

async function resolveScopedCompanyAndDepartment({
  currentUser,
  targetRole,
  companyId,
  departmentId
}) {
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
    return {
      companyId: company.id,
      department: null
    };
  }

  if (!departmentId) {
    throw new Error("Departamento obrigatorio");
  }

  const department = await ensureDepartmentForAdminScope(currentUser, departmentId);
  const resolvedCompanyId = Number(companyId || department.companyId);

  if (Number(department.companyId) !== resolvedCompanyId) {
    throw new Error("Departamento nao pertence a empresa selecionada");
  }

  await ensureCompanyScope(currentUser, resolvedCompanyId);

  return {
    companyId: resolvedCompanyId,
    department
  };
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

  if (!password) {
    throw new Error("Email e senha sao obrigatorios");
  }

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

  const user = await prisma.user.create({
    data: {
      name: String(name || "").trim() || "Usuario",
      email: normalizedEmail,
      password: hash,
      role: normalizedRole,
      active: Boolean(active),
      companyId: scope.companyId,
      departmentId: scope.department?.id || null
    }
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
      await prisma.user.update({
        where: {
          id: user.id
        },
        data: {
          authUserId: supabaseUser.id
        }
      });
    }
  } catch (error) {
    await prisma.userPermission.deleteMany({
      where: {
        userId: user.id
      }
    });
    await prisma.user.delete({
      where: {
        id: user.id
      }
    });
    throw error;
  }

  return getUserContextById(user.id);
}

export async function getOverview(currentUser) {
  const currentRole = normalizeRole(currentUser.role);

  if (currentRole === ROLES.SUPER_ADMIN) {
    const [companies, departments, users, admins, logs] = await Promise.all([
      prisma.company.findMany({
        select: {
          id: true,
          name: true
        }
      }),
      prisma.department.findMany({
        include: {
          company: {
            select: {
              id: true,
              name: true
            }
          },
          _count: {
            select: {
              users: true
            }
          },
          users: {
            select: {
              id: true,
              role: true
            }
          }
        },
        orderBy: [{ companyId: "asc" }, { name: "asc" }]
      }),
      prisma.user.count(),
      prisma.user.count({
        where: {
          role: ROLES.ADMIN
        }
      }),
      prisma.auditLog.findMany({
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              companyId: true,
              departmentId: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 10
      })
    ]);

    const visibleCompanies = companies.filter((item) => !isSystemCompany(item));
    const visibleDepartments = departments.filter((item) => !isSystemDepartment(item));

    return {
      mode: "SUPER_ADMIN",
      stats: {
        companies: visibleCompanies.length,
        departments: visibleDepartments.length,
        users,
        admins
      },
      departments: visibleDepartments.map(serializeDepartment),
      recentLogs: logs.map(serializeLog)
    };
  }

  const departmentId = Number(currentUser.departmentId);
  const [department, users, recentLogs] = await Promise.all([
    prisma.department.findUnique({
      where: {
        id: departmentId
      },
      include: {
        company: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            users: true
          }
        }
      }
    }),
    prisma.user.findMany({
      where: {
        companyId: currentUser.companyId,
        departmentId
      },
      orderBy: {
        name: "asc"
      }
    }),
    prisma.auditLog.findMany({
      where: {
        user: {
          companyId: currentUser.companyId,
          departmentId
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            companyId: true,
            departmentId: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 10
    })
  ]);

  return {
    mode: "ADMIN",
    stats: {
      users: users.length,
      activeUsers: users.filter((item) => item.active).length,
      inactiveUsers: users.filter((item) => !item.active).length,
      departmentName: department?.name || "Sem departamento"
    },
    department: department ? serializeDepartment(department) : null,
    recentLogs: recentLogs.map(serializeLog)
  };
}

export async function listUsers(currentUser) {
  const currentRole = normalizeRole(currentUser.role);
  const where =
    currentRole === ROLES.SUPER_ADMIN
      ? {
          role: ROLES.USER
        }
      : {
          role: ROLES.USER,
          companyId: currentUser.companyId,
          departmentId: currentUser.departmentId
        };

  const users = await prisma.user.findMany({
    where,
    include: {
      company: {
        select: {
          id: true,
          name: true
        }
      },
      department: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      },
      userPermissions: {
        include: {
          permission: {
            select: {
              key: true
            }
          }
        }
      }
    },
    orderBy: [{ active: "desc" }, { name: "asc" }]
  });

  return users.map(serializeAdminRecord);
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
  const user = await prisma.user.findUnique({
    where: {
      id: Number(userId)
    }
  });

  if (!user || normalizeRole(user.role) !== ROLES.USER) {
    throw new Error("Usuario nao encontrado");
  }

  if (normalizeRole(currentUser.role) !== ROLES.SUPER_ADMIN) {
    if (
      Number(user.companyId) !== Number(currentUser.companyId) ||
      Number(user.departmentId) !== Number(currentUser.departmentId)
    ) {
      throw new Error("Usuario fora do escopo do administrador");
    }
  }

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

  const updatedUser = await prisma.user.update({
    where: {
      id: Number(userId)
    },
    data: {
      name: String(payload.name || user.name).trim() || user.name,
      email: normalizedEmail,
      active: payload.active ?? user.active,
      companyId: scope.companyId,
      departmentId: scope.department?.id || null
    }
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
    await prisma.user.update({
      where: {
        id: Number(userId)
      },
      data: {
        authUserId: supabaseUser.id
      }
    });
  }

  await writeAuditLog(currentUser.id, "update", {
    entity: "user",
    entityId: Number(userId),
    details: `Usuario ${String(payload.name || user.name).trim() || user.name} atualizado`
  });

  return getUserContextById(userId);
}

export async function setUserStatus(currentUser, userId, active) {
  const user = await prisma.user.findUnique({
    where: {
      id: Number(userId)
    }
  });

  if (!user || normalizeRole(user.role) !== ROLES.USER) {
    throw new Error("Usuario nao encontrado");
  }

  if (normalizeRole(currentUser.role) !== ROLES.SUPER_ADMIN) {
    if (
      Number(user.companyId) !== Number(currentUser.companyId) ||
      Number(user.departmentId) !== Number(currentUser.departmentId)
    ) {
      throw new Error("Usuario fora do escopo do administrador");
    }
  }

  const updatedUser = await prisma.user.update({
    where: {
      id: Number(userId)
    },
    data: {
      active: Boolean(active)
    }
  });

  const supabaseUser = await upsertSupabaseUser({
    email: updatedUser.email,
    name: updatedUser.name,
    role: updatedUser.role,
    companyId: updatedUser.companyId,
    departmentId: updatedUser.departmentId,
    active: Boolean(active)
  });

  if (supabaseUser?.id && supabaseUser.id !== updatedUser.authUserId) {
    await prisma.user.update({
      where: {
        id: Number(userId)
      },
      data: {
        authUserId: supabaseUser.id
      }
    });
  }

  await writeAuditLog(currentUser.id, "update", {
    entity: "user",
    entityId: Number(userId),
    details: `Usuario ${user.name} ${active ? "ativado" : "desativado"}`
  });

  return getUserContextById(userId);
}

export async function deleteUser(currentUser, userId) {
  const user = await prisma.user.findUnique({
    where: {
      id: Number(userId)
    }
  });

  if (!user || normalizeRole(user.role) !== ROLES.USER) {
    throw new Error("Usuario nao encontrado");
  }

  if (normalizeRole(currentUser.role) !== ROLES.SUPER_ADMIN) {
    if (
      Number(user.companyId) !== Number(currentUser.companyId) ||
      Number(user.departmentId) !== Number(currentUser.departmentId)
    ) {
      throw new Error("Usuario fora do escopo do administrador");
    }
  }

  if (user.authUserId) {
    await deleteSupabaseUser(user.authUserId);
  }

  await prisma.user.delete({
    where: {
      id: Number(userId)
    }
  });

  await writeAuditLog(currentUser.id, "delete", {
    entity: "user",
    entityId: Number(userId),
    details: `Usuario ${user.name} excluido`
  });
}

export async function resetUserPassword(currentUser, userId, password) {
  const user = await prisma.user.findUnique({
    where: {
      id: Number(userId)
    }
  });

  if (!user || normalizeRole(user.role) !== ROLES.USER) {
    throw new Error("Usuario nao encontrado");
  }

  if (normalizeRole(currentUser.role) !== ROLES.SUPER_ADMIN) {
    if (
      Number(user.companyId) !== Number(currentUser.companyId) ||
      Number(user.departmentId) !== Number(currentUser.departmentId)
    ) {
      throw new Error("Usuario fora do escopo do administrador");
    }
  }

  assertStrongPassword(password);
  const hash = await bcrypt.hash(String(password || ""), 10);

  const updatedUser = await prisma.user.update({
    where: {
      id: Number(userId)
    },
    data: {
      password: hash
    }
  });

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
      await prisma.user.update({
        where: {
          id: Number(userId)
        },
        data: {
          authUserId: supabaseUser.id
        }
      });
    }
  }

  await writeAuditLog(currentUser.id, "update", {
    entity: "user",
    entityId: Number(userId),
    details: `Senha do usuario ${user.name} redefinida`
  });
}

export async function listAdmins(currentUser) {
  if (normalizeRole(currentUser.role) !== ROLES.SUPER_ADMIN) {
    throw new Error("Acesso permitido somente ao SUPER_ADMIN");
  }

  const admins = await prisma.user.findMany({
    where: {
      role: ROLES.ADMIN
    },
    include: {
      company: {
        select: {
          id: true,
          name: true
        }
      },
      department: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      },
      userPermissions: {
        include: {
          permission: {
            select: {
              key: true
            }
          }
        }
      }
    },
    orderBy: [{ active: "desc" }, { createdAt: "desc" }]
  });

  return admins.map(serializeAdminRecord);
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

  const admin = await prisma.user.findUnique({
    where: {
      id: Number(adminId)
    }
  });

  if (!admin || normalizeRole(admin.role) !== ROLES.ADMIN) {
    throw new Error("Admin nao encontrado");
  }

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

  const updatedAdmin = await prisma.user.update({
    where: {
      id: Number(adminId)
    },
    data: {
      name: String(payload.name || admin.name).trim() || admin.name,
      email: normalizedEmail,
      departmentId: scope.department?.id || null,
      companyId: scope.companyId,
      active: payload.active ?? admin.active
    }
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
    await prisma.user.update({
      where: {
        id: Number(adminId)
      },
      data: {
        authUserId: supabaseAdmin.id
      }
    });
  }

  await writeAuditLog(currentUser.id, "update", {
    entity: "admin",
    entityId: Number(adminId),
    details: `Admin ${String(payload.name || admin.name).trim() || admin.name} atualizado`
  });

  return getUserContextById(adminId);
}

export async function setAdminStatus(currentUser, adminId, active) {
  if (normalizeRole(currentUser.role) !== ROLES.SUPER_ADMIN) {
    throw new Error("Acesso permitido somente ao SUPER_ADMIN");
  }

  const admin = await prisma.user.findUnique({
    where: {
      id: Number(adminId)
    }
  });

  if (!admin || normalizeRole(admin.role) !== ROLES.ADMIN) {
    throw new Error("Admin nao encontrado");
  }

  const updatedAdmin = await prisma.user.update({
    where: {
      id: Number(adminId)
    },
    data: {
      active: Boolean(active)
    }
  });

  const supabaseAdmin = await upsertSupabaseUser({
    email: updatedAdmin.email,
    name: updatedAdmin.name,
    role: updatedAdmin.role,
    companyId: updatedAdmin.companyId,
    departmentId: updatedAdmin.departmentId,
    active: Boolean(active)
  });

  if (supabaseAdmin?.id && supabaseAdmin.id !== updatedAdmin.authUserId) {
    await prisma.user.update({
      where: {
        id: Number(adminId)
      },
      data: {
        authUserId: supabaseAdmin.id
      }
    });
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

  const admin = await prisma.user.findUnique({
    where: {
      id: Number(adminId)
    }
  });

  if (!admin || normalizeRole(admin.role) !== ROLES.ADMIN) {
    throw new Error("Admin nao encontrado");
  }

  if (admin.authUserId) {
    await deleteSupabaseUser(admin.authUserId);
  }

  await prisma.user.delete({
    where: {
      id: Number(adminId)
    }
  });

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

  const admin = await prisma.user.findUnique({
    where: {
      id: Number(adminId)
    }
  });

  if (!admin || normalizeRole(admin.role) !== ROLES.ADMIN) {
    throw new Error("Admin nao encontrado");
  }

  assertStrongPassword(password);
  const hash = await bcrypt.hash(String(password || ""), 10);

  const updatedAdmin = await prisma.user.update({
    where: {
      id: Number(adminId)
    },
    data: {
      password: hash
    }
  });

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
      await prisma.user.update({
        where: {
          id: Number(adminId)
        },
        data: {
          authUserId: supabaseAdmin.id
        }
      });
    }
  }

  await writeAuditLog(currentUser.id, "update", {
    entity: "admin",
    entityId: Number(adminId),
    details: `Senha do admin ${admin.name} redefinida`
  });
}

export async function listDepartments(currentUser) {
  const where =
    normalizeRole(currentUser.role) === ROLES.SUPER_ADMIN
      ? {}
      : {
          companyId: currentUser.companyId,
          id: currentUser.departmentId
        };

  const departments = await prisma.department.findMany({
    where,
    include: {
      company: {
        select: {
          id: true,
          name: true
        }
      },
      users: {
        select: {
          id: true,
          role: true
        }
      },
      _count: {
        select: {
          users: true
        }
      }
    },
    orderBy: [{ companyId: "asc" }, { name: "asc" }]
  });

  const visibleDepartments =
    normalizeRole(currentUser.role) === ROLES.SUPER_ADMIN
      ? departments.filter((item) => !isSystemDepartment(item))
      : departments;

  return visibleDepartments.map(serializeDepartment);
}

export async function createDepartment(currentUser, payload) {
  if (normalizeRole(currentUser.role) !== ROLES.SUPER_ADMIN) {
    throw new Error("Acesso permitido somente ao SUPER_ADMIN");
  }

  const company = await ensureCompanyScope(currentUser, payload.companyId);
  const name = String(payload.name || "").trim();

  if (!name) {
    throw new Error("Nome do departamento obrigatorio");
  }

  const department = await prisma.department.create({
    data: {
      companyId: company.id,
      name,
      slug: slugify(payload.slug || name),
      description: String(payload.description || "").trim() || null,
      active: payload.active ?? true
    },
    include: {
      company: {
        select: {
          id: true,
          name: true
        }
      },
      users: {
        select: {
          id: true,
          role: true
        }
      },
      _count: {
        select: {
          users: true
        }
      }
    }
  });

  await writeAuditLog(currentUser.id, "create", {
    entity: "department",
    entityId: department.id,
    details: `Departamento ${department.name} criado`
  });

  return serializeDepartment(department);
}

export async function updateDepartment(currentUser, departmentId, payload) {
  if (normalizeRole(currentUser.role) !== ROLES.SUPER_ADMIN) {
    throw new Error("Acesso permitido somente ao SUPER_ADMIN");
  }

  const existing = await prisma.department.findUnique({
    where: {
      id: Number(departmentId)
    }
  });

  if (!existing) {
    throw new Error("Departamento nao encontrado");
  }

  const company = await ensureCompanyScope(currentUser, payload.companyId || existing.companyId);
  const nextName = payload.name ? String(payload.name).trim() : existing.name;
  const nextSlug = payload.slug ? slugify(payload.slug) : existing.slug;

  if (!nextName) {
    throw new Error("Nome do departamento obrigatorio");
  }

  await prisma.department.update({
    where: {
      id: Number(departmentId)
    },
    data: {
      companyId: company.id,
      name: nextName,
      slug: nextSlug,
      description:
        payload.description !== undefined
          ? String(payload.description || "").trim() || null
          : existing.description,
      active: payload.active ?? existing.active
    }
  });

  const updated = await prisma.department.findUnique({
    where: {
      id: Number(departmentId)
    },
    include: {
      company: {
        select: {
          id: true,
          name: true
        }
      },
      users: {
        select: {
          id: true,
          role: true
        }
      },
      _count: {
        select: {
          users: true
        }
      }
    }
  });

  await writeAuditLog(currentUser.id, "update", {
    entity: "department",
    entityId: Number(departmentId),
    details: `Departamento ${updated.name} atualizado`
  });

  return serializeDepartment(updated);
}

export async function deleteDepartment(currentUser, departmentId) {
  if (normalizeRole(currentUser.role) !== ROLES.SUPER_ADMIN) {
    throw new Error("Acesso permitido somente ao SUPER_ADMIN");
  }

  const existing = await prisma.department.findUnique({
    where: {
      id: Number(departmentId)
    },
    include: {
      company: {
        select: {
          id: true,
          name: true
        }
      },
      _count: {
        select: {
          users: true
        }
      }
    }
  });

  if (!existing) {
    throw new Error("Departamento nao encontrado");
  }

  if ((existing._count?.users || 0) > 0) {
    throw new Error("Nao e possivel excluir departamento com usuarios ou admins vinculados");
  }

  await prisma.department.delete({
    where: {
      id: Number(departmentId)
    }
  });

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

  if (!name) {
    throw new Error("Nome da empresa obrigatorio");
  }

  const existing = await prisma.company.findFirst({
    where: {
      name
    }
  });

  if (existing) {
    throw new Error("Empresa ja cadastrada");
  }

  const company = await prisma.company.create({
    data: {
      name
    },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          users: true,
          departments: true
        }
      }
    }
  });

  await writeAuditLog(currentUser.id, "create", {
    entity: "company",
    entityId: company.id,
    details: description ? `Empresa ${name} criada: ${description}` : `Empresa ${name} criada`
  });

  return company;
}

export async function deleteCompany(currentUser, companyId) {
  if (normalizeRole(currentUser.role) !== ROLES.SUPER_ADMIN) {
    throw new Error("Acesso permitido somente ao SUPER_ADMIN");
  }

  const existing = await prisma.company.findUnique({
    where: {
      id: Number(companyId)
    },
    select: {
      id: true,
      name: true,
      departments: {
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              users: true
            }
          }
        }
      },
      _count: {
        select: {
          users: true,
          departments: true,
          suppliers: true,
          categories: true,
          alerts: true
        }
      }
    }
  });

  if (!existing) {
    throw new Error("Empresa nao encontrada");
  }

  const blockingItems = [
    existing._count?.users || 0,
    existing._count?.suppliers || 0,
    existing._count?.categories || 0,
    existing._count?.alerts || 0
  ].reduce((sum, value) => sum + value, 0);

  if (blockingItems > 0) {
    throw new Error("Nao e possivel excluir empresa com usuarios, fornecedores, categorias ou alertas vinculados");
  }

  const departmentsWithUsers = (existing.departments || []).filter(
    (item) => (item._count?.users || 0) > 0
  );

  if (departmentsWithUsers.length > 0) {
    throw new Error("Nao e possivel excluir empresa com departamentos que ainda possuem usuarios ou admins vinculados");
  }

  await prisma.$transaction(async (tx) => {
    if ((existing.departments || []).length) {
      await tx.department.deleteMany({
        where: {
          companyId: Number(companyId)
        }
      });
    }

    await tx.company.delete({
      where: {
        id: Number(companyId)
      }
    });
  });

  await writeAuditLog(currentUser.id, "delete", {
    entity: "company",
    entityId: Number(companyId),
    details: `Empresa ${existing.name} excluida`
  });
}

export async function getSettings(currentUser) {
  const currentRole = normalizeRole(currentUser.role);
  const actorAllowedKeys =
    currentRole === ROLES.SUPER_ADMIN
      ? null
      : Array.isArray(currentUser.permissions)
      ? currentUser.permissions
      : [];

  const [companies, permissions] = await Promise.all([
    prisma.company.findMany({
      where: currentRole === ROLES.SUPER_ADMIN ? {} : { id: Number(currentUser.companyId) },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            users: true,
            departments: true,
            suppliers: true,
            categories: true
          }
        }
      },
      orderBy: {
        name: "asc"
      }
    }),
    prisma.permission.findMany({
      where: actorAllowedKeys
        ? {
            key: {
              in: actorAllowedKeys
            }
          }
        : undefined,
      orderBy: {
        key: "asc"
      }
    })
  ]);

  const visibleCompanies =
    currentRole === ROLES.SUPER_ADMIN
      ? companies.filter((item) => !isSystemCompany(item))
      : companies;

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

export async function listSystemLogs(currentUser) {
  if (normalizeRole(currentUser.role) !== ROLES.SUPER_ADMIN) {
    throw new Error("Acesso permitido somente ao SUPER_ADMIN");
  }

  const logs = await prisma.auditLog.findMany({
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          companyId: true,
          departmentId: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 50
  });

  return logs.map(serializeLog);
}
