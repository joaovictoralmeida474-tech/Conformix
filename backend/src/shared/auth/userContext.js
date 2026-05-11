import { prisma } from "../database/prisma.js";
import { ROLE_PERMISSION_MAP, ROLES, normalizeRole } from "./permissions.js";

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

export async function getUserContextById(userId) {
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: {
      id: Number(userId)
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
          slug: true,
          active: true,
          companyId: true
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
    }
  });

  if (!user || !user.active) {
    return null;
  }

  const rolePermissions = await prisma.rolePermission.findMany({
    where: {
      role: normalizeRole(user.role)
    },
    include: {
      permission: {
        select: {
          key: true
        }
      }
    }
  });

  return serializeUserContext({
    ...user,
    rolePermissions
  });
}
