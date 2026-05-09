import bcrypt from "bcrypt";

import { prisma } from "./prisma.js";
import {
  PERMISSION_DEFINITIONS,
  ROLE_PERMISSION_MAP,
  ROLES
} from "../auth/permissions.js";
import { isBootstrapSeedEnabled, isDemoDataEnabled } from "../config/security.js";

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "departamento";
}

async function seedPermissions() {
  for (const item of PERMISSION_DEFINITIONS) {
    await prisma.permission.upsert({
      where: {
        key: item.key
      },
      update: {
        name: item.name,
        description: item.description || null
      },
      create: {
        key: item.key,
        name: item.name,
        description: item.description || null
      }
    });
  }

  const permissions = await prisma.permission.findMany({
    select: {
      id: true,
      key: true
    }
  });

  const permissionMap = new Map(permissions.map((item) => [item.key, item.id]));

  for (const [role, keys] of Object.entries(ROLE_PERMISSION_MAP)) {
    for (const permissionKey of keys) {
      const permissionId = permissionMap.get(permissionKey);
      if (!permissionId) continue;

      await prisma.rolePermission.upsert({
        where: {
          role_permissionId: {
            role,
            permissionId
          }
        },
        update: {},
        create: {
          role,
          permissionId
        }
      });
    }
  }
}

async function ensureDepartment(companyId, name, description = null) {
  const slug = slugify(name);

  const existing = await prisma.department.findFirst({
    where: {
      companyId,
      slug
    }
  });

  if (existing) {
    return existing;
  }

  return prisma.department.create({
    data: {
      companyId,
      name,
      slug,
      description
    }
  });
}

async function ensureSuperAdmin() {
  const email = String(process.env.SUPER_ADMIN_EMAIL || "")
    .trim()
    .toLowerCase();
  const password = String(process.env.SUPER_ADMIN_PASSWORD || "");
  const name = String(process.env.SUPER_ADMIN_NAME || "Super Admin").trim();
  const companyName = String(process.env.SUPER_ADMIN_COMPANY || "Conformix Platform").trim();

  if (!email || !password) {
    throw new Error(
      "ENABLE_BOOTSTRAP_SEED=true exige SUPER_ADMIN_EMAIL e SUPER_ADMIN_PASSWORD definidos"
    );
  }

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

  await ensureDepartment(
    company.id,
    "Administracao Global",
    "Departamento reservado ao super administrador da plataforma"
  );

  const hash = await bcrypt.hash(password, 10);
  const existing = await prisma.user.findUnique({
    where: {
      email
    }
  });

  if (existing) {
    return;
  }

  await prisma.user.create({
    data: {
      name,
      email,
      password: hash,
      role: ROLES.SUPER_ADMIN,
      companyId: company.id,
      departmentId: null,
      active: true
    }
  });
}

async function ensureDemoCompany() {
  const defaultAdminEmail = String(process.env.DEMO_ADMIN_EMAIL || "")
    .trim()
    .toLowerCase();
  const defaultAdminPassword = String(process.env.DEMO_ADMIN_PASSWORD || "");

  if (!defaultAdminEmail || !defaultAdminPassword) {
    throw new Error(
      "ENABLE_DEMO_DATA=true exige DEMO_ADMIN_EMAIL e DEMO_ADMIN_PASSWORD definidos"
    );
  }

  let company = await prisma.company.findFirst({
    where: {
      name: "Empresa Demo"
    }
  });

  if (!company) {
    company = await prisma.company.create({
      data: {
        name: "Empresa Demo"
      }
    });
  }

  const department = await ensureDepartment(
    company.id,
    "Operacoes",
    "Departamento padrao da empresa demo"
  );

  const password = await bcrypt.hash(defaultAdminPassword, 10);
  const existingAdmin = await prisma.user.findUnique({
    where: {
      email: defaultAdminEmail
    }
  });

  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        name: "Administrador Demo",
        email: defaultAdminEmail,
        password,
        role: ROLES.ADMIN,
        companyId: company.id,
        departmentId: department.id,
        active: true
      }
    });
  }

  const hasCategory = await prisma.category.findFirst({
    where: {
      companyId: company.id
    }
  });

  if (!hasCategory) {
    await prisma.category.create({
      data: {
        slug: "critico",
        name: "Critico",
        description: "Categoria com maior impacto operacional",
        companyId: company.id,
        questions: {
          create: [
            {
              prompt: "Entrega no prazo?",
              sortOrder: 1
            },
            {
              prompt: "Qualidade dentro do padrao?",
              sortOrder: 2
            }
          ]
        },
        documents: {
          create: [
            {
              name: "ISO 9001",
              sortOrder: 1
            },
            {
              name: "Plano de acao",
              sortOrder: 2
            }
          ]
        }
      }
    });
  }
}

export async function seedPlatform() {
  await seedPermissions();

  if (!isBootstrapSeedEnabled()) {
    return;
  }

  await ensureSuperAdmin();

  if (isDemoDataEnabled()) {
    await ensureDemoCompany();
  }
}
