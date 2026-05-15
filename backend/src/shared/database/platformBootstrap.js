import bcrypt from "bcryptjs";

import { ROLES, normalizeRole } from "../auth/permissions.js";
import { seedPermissions } from "./seed.js";
import { prisma, isDatabaseConfigured } from "./prisma.js";

let bootstrapPromise = null;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function hasUsablePostgresDatabase() {
  return isDatabaseConfigured();
}

async function ensureDefaultCompany() {
  const companyName = String(process.env.SUPER_ADMIN_COMPANY || "Conformix Platform").trim();

  let company = await prisma.company.findFirst({
    where: {
      name: companyName
    }
  });

  if (!company) {
    company = await prisma.company.create({
      data: {
        name: companyName,
        departments: {
          create: {
            name: "Administracao Global",
            slug: "administracao-global",
            description: "Departamento padrao da plataforma",
            active: true
          }
        }
      },
      include: {
        departments: true
      }
    });
  }

  const department =
    company.departments?.[0] ||
    (await prisma.department.findFirst({
      where: {
        companyId: company.id,
        active: true
      }
    }));

  return {
    company,
    department
  };
}

export async function provisionUserFromSessionSnapshot(userSnapshot = {}) {
  const email = normalizeEmail(userSnapshot.email);
  const role = normalizeRole(userSnapshot.role || ROLES.USER);

  if (!email) {
    return null;
  }

  const lookupConditions = [{ email }];

  if (userSnapshot.id) {
    lookupConditions.push({ authUserId: String(userSnapshot.id) });
  }

  const existing = await prisma.user.findFirst({
    where: {
      OR: lookupConditions
    }
  });

  if (existing) {
    return existing;
  }

  const { company, department } = await ensureDefaultCompany();
  const passwordSeed = `supabase:${String(userSnapshot.id || email)}`;
  const hash = await bcrypt.hash(passwordSeed, 10);

  return prisma.user.create({
    data: {
      name: String(userSnapshot.name || "Usuario").trim() || "Usuario",
      email,
      password: hash,
      role: role === ROLES.SUPER_ADMIN ? ROLES.SUPER_ADMIN : role,
      active: userSnapshot.active !== false,
      companyId: company.id,
      departmentId: role === ROLES.SUPER_ADMIN ? null : department?.id || null,
      authUserId: String(userSnapshot.id || "") || null
    }
  });
}

export async function ensurePlatformBootstrap(userSnapshot = null) {
  if (!hasUsablePostgresDatabase()) {
    return false;
  }

  try {
    if (!bootstrapPromise) {
      bootstrapPromise = (async () => {
        await seedPermissions();
        await ensureDefaultCompany();

        if (userSnapshot?.email) {
          await provisionUserFromSessionSnapshot(userSnapshot);
        }
      })().catch((error) => {
        bootstrapPromise = null;
        throw error;
      });
    }

    await bootstrapPromise;

    if (userSnapshot?.email) {
      await provisionUserFromSessionSnapshot(userSnapshot);
    }

    return true;
  } catch (error) {
    console.error("Bootstrap da plataforma falhou:", error?.message || error);
    bootstrapPromise = null;
    return false;
  }
}
