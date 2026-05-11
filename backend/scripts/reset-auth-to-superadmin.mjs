import "dotenv/config";
import bcrypt from "bcrypt";

import { prisma } from "../src/shared/database/prisma.js";
import { ROLES } from "../src/shared/auth/permissions.js";
import {
  deleteSupabaseUser,
  listSupabaseUsers,
  upsertSupabaseUser
} from "../src/shared/integrations/supabaseAdmin.js";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function ensureSuperAdminCompany() {
  const companyName = String(process.env.SUPER_ADMIN_COMPANY || "Conformix Platform").trim();
  const departmentName = "Administracao Global";
  const departmentSlug = "administracao-global";

  let company = await prisma.company.findFirst({
    where: {
      name: companyName
    }
  });

  if (!company) {
    company = await prisma.company.create({
      data: {
        name: companyName
      }
    });
  }

  const existingDepartment = await prisma.department.findFirst({
    where: {
      companyId: company.id,
      slug: departmentSlug
    }
  });

  if (!existingDepartment) {
    await prisma.department.create({
      data: {
        companyId: company.id,
        name: departmentName,
        slug: departmentSlug,
        description: "Departamento reservado ao super administrador da plataforma"
      }
    });
  }

  return company;
}

async function ensureLocalSuperAdmin() {
  const email = normalizeEmail(process.env.SUPER_ADMIN_EMAIL);
  const password = String(process.env.SUPER_ADMIN_PASSWORD || "");
  const name = String(process.env.SUPER_ADMIN_NAME || "Super Admin").trim() || "Super Admin";

  if (!email || !password) {
    throw new Error("SUPER_ADMIN_EMAIL e SUPER_ADMIN_PASSWORD precisam estar definidos");
  }

  const company = await ensureSuperAdminCompany();
  const hash = await bcrypt.hash(password, 10);
  const existingUser = await prisma.user.findUnique({
    where: {
      email
    }
  });

  if (existingUser) {
    return prisma.user.update({
      where: {
        id: existingUser.id
      },
      data: {
        name,
        password: hash,
        role: ROLES.SUPER_ADMIN,
        active: true,
        companyId: company.id,
        departmentId: null
      }
    });
  }

  return prisma.user.create({
    data: {
      name,
      email,
      password: hash,
      role: ROLES.SUPER_ADMIN,
      active: true,
      companyId: company.id,
      departmentId: null
    }
  });
}

async function ensureSupabaseSuperAdmin(localSuperAdmin) {
  const password = String(process.env.SUPER_ADMIN_PASSWORD || "");
  const remoteUser = await upsertSupabaseUser({
    email: localSuperAdmin.email,
    password,
    name: localSuperAdmin.name,
    role: ROLES.SUPER_ADMIN,
    companyId: localSuperAdmin.companyId,
    departmentId: null,
    active: true
  });

  if (remoteUser?.id && remoteUser.id !== localSuperAdmin.authUserId) {
    return prisma.user.update({
      where: {
        id: localSuperAdmin.id
      },
      data: {
        authUserId: remoteUser.id
      }
    });
  }

  return localSuperAdmin;
}

async function deleteOtherSupabaseUsers(keepEmail) {
  const users = await listSupabaseUsers();
  const removableUsers = users.filter((item) => normalizeEmail(item?.email) !== keepEmail);

  for (const user of removableUsers) {
    if (!user?.id) {
      continue;
    }

    await deleteSupabaseUser(user.id);
  }

  return removableUsers.length;
}

async function deleteOtherLocalUsers(keepUserId) {
  const otherUsers = await prisma.user.findMany({
    where: {
      id: {
        not: Number(keepUserId)
      }
    },
    select: {
      id: true
    }
  });

  const otherIds = otherUsers.map((item) => item.id);

  if (!otherIds.length) {
    return 0;
  }

  await prisma.$transaction([
    prisma.evaluation.updateMany({
      where: {
        evaluatorId: {
          in: otherIds
        }
      },
      data: {
        evaluatorId: Number(keepUserId)
      }
    }),
    prisma.auditLog.updateMany({
      where: {
        userId: {
          in: otherIds
        }
      },
      data: {
        userId: Number(keepUserId)
      }
    }),
    prisma.userPermission.deleteMany({
      where: {
        userId: {
          in: otherIds
        }
      }
    }),
    prisma.user.deleteMany({
      where: {
        id: {
          in: otherIds
        }
      }
    })
  ]);

  return otherIds.length;
}

async function main() {
  const keepEmail = normalizeEmail(process.env.SUPER_ADMIN_EMAIL);

  if (!keepEmail) {
    throw new Error("SUPER_ADMIN_EMAIL nao configurado");
  }

  const localSuperAdmin = await ensureLocalSuperAdmin();
  const syncedSuperAdmin = await ensureSupabaseSuperAdmin(localSuperAdmin);
  const removedSupabaseUsers = await deleteOtherSupabaseUsers(keepEmail);
  const removedLocalUsers = await deleteOtherLocalUsers(syncedSuperAdmin.id);

  console.log(
    JSON.stringify(
      {
        keptSuperAdmin: keepEmail,
        removedSupabaseUsers,
        removedLocalUsers
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
