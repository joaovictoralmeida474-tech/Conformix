import bcrypt from "bcryptjs";
import axios from "axios";

import { prisma } from "./prisma.js";
import {
  PERMISSION_DEFINITIONS,
  ROLE_PERMISSION_MAP,
  ROLES,
  normalizeRole
} from "../auth/permissions.js";
import {
  buildSupabaseProfile,
  ensureSupabaseProvisioningScope
} from "../auth/supabaseProvisioning.js";
import { isBootstrapSeedEnabled, isDemoDataEnabled } from "../config/security.js";
import { listSupabaseUsers } from "../integrations/supabaseAdmin.js";

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "departamento";
}

export async function seedPermissions() {
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
    const passwordMatches = await bcrypt.compare(password, existing.password);

    await prisma.user.update({
      where: {
        id: existing.id
      },
      data: {
        name,
        password: passwordMatches ? existing.password : hash,
        role: ROLES.SUPER_ADMIN,
        active: true,
        companyId: company.id,
        departmentId: null
      }
    });
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

async function ensureSupabaseSuperAdmin() {
  const url = String(process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const email = String(process.env.SUPER_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = String(process.env.SUPER_ADMIN_PASSWORD || "");
  const name = String(process.env.SUPER_ADMIN_NAME || "Super Admin").trim() || "Super Admin";

  if (!url || !serviceRoleKey || !email || !password) {
    return;
  }

  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json"
  };

  const listResponse = await axios.get(`${url}/auth/v1/admin/users`, {
    proxy: false,
    headers
  });

  const users = Array.isArray(listResponse.data?.users) ? listResponse.data.users : [];
  const existingUser = users.find((item) => String(item?.email || "").trim().toLowerCase() === email);
  const payload = {
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name
    },
    app_metadata: {
      role: ROLES.SUPER_ADMIN
    }
  };

  if (!existingUser?.id) {
    await axios.post(`${url}/auth/v1/admin/users`, payload, {
      proxy: false,
      headers
    });
    return;
  }

  await axios.put(`${url}/auth/v1/admin/users/${existingUser.id}`, payload, {
    proxy: false,
    headers
  });
}

async function syncSupabaseUsersToLocal() {
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const url = String(process.env.SUPABASE_URL || "").trim();

  if (!serviceRoleKey || !url) {
    return;
  }

  const superAdminEmail = String(process.env.SUPER_ADMIN_EMAIL || "").trim().toLowerCase();
  const users = await listSupabaseUsers();

  for (const supabaseUser of users) {
    const email = String(supabaseUser?.email || "").trim().toLowerCase();

    if (!email) {
      continue;
    }

    const profile = buildSupabaseProfile(supabaseUser);
    let role = normalizeRole(profile.role);
    let name = profile.name;
    let scope = null;

    if (email === superAdminEmail) {
      role = ROLES.SUPER_ADMIN;
      name = name || "Super Admin";
      scope = await ensureSupabaseProvisioningScope({
        ...profile,
        role: ROLES.SUPER_ADMIN
      });
    } else {
      scope = await ensureSupabaseProvisioningScope(profile);
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ authUserId: supabaseUser.id }, { email }]
      }
    });

    const passwordHash = await bcrypt.hash(`supabase:${supabaseUser.id}`, 10);

    if (existingUser) {
      await prisma.user.update({
        where: {
          id: existingUser.id
        },
        data: {
          name,
          email,
          role,
          active: true,
          companyId: scope.companyId,
          departmentId: scope.departmentId,
          authUserId: supabaseUser.id,
          password: existingUser.password || passwordHash
        }
      });
      continue;
    }

    await prisma.user.create({
      data: {
        name,
        email,
        role,
        active: true,
        companyId: scope.companyId,
        departmentId: scope.departmentId,
        authUserId: supabaseUser.id,
        password: passwordHash
      }
    });
  }
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
  try {
    await ensureSupabaseSuperAdmin();
    await syncSupabaseUsersToLocal();
  } catch (error) {
    console.error("Aviso: falha ao sincronizar usuarios com Supabase durante bootstrap:", error?.message || error);
  }

  if (isDemoDataEnabled()) {
    await ensureDemoCompany();
  }
}
