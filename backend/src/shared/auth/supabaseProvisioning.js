import { prisma } from "../database/prisma.js";
import { ROLES, normalizeRole } from "./permissions.js";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "geral";
}

function toPositiveInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function deriveDisplayName(supabaseUser) {
  const metadataName =
    supabaseUser?.app_metadata?.name ??
    supabaseUser?.user_metadata?.name ??
    "";

  if (String(metadataName).trim()) {
    return String(metadataName).trim();
  }

  const email = normalizeEmail(supabaseUser?.email);

  if (!email.includes("@")) {
    return "Usuario";
  }

  const [localPart] = email.split("@");
  return localPart.trim() || "Usuario";
}

export function extractSupabaseMetadataValue(user, key) {
  return user?.app_metadata?.[key] ?? user?.user_metadata?.[key] ?? null;
}

export function buildSupabaseProfile(supabaseUser, overrides = {}) {
  return {
    email: normalizeEmail(supabaseUser?.email),
    name: String(
      overrides.name ??
        extractSupabaseMetadataValue(supabaseUser, "name") ??
        deriveDisplayName(supabaseUser)
    ).trim() || "Usuario",
    role: normalizeRole(overrides.role ?? extractSupabaseMetadataValue(supabaseUser, "role")),
    companyId: toPositiveInt(overrides.companyId ?? extractSupabaseMetadataValue(supabaseUser, "companyId")),
    departmentId: toPositiveInt(
      overrides.departmentId ?? extractSupabaseMetadataValue(supabaseUser, "departmentId")
    )
  };
}

async function ensureImportedCompany(profile) {
  const fallbackName = String(
    process.env.SUPABASE_IMPORTED_COMPANY_NAME || "Usuarios importados do Supabase"
  ).trim();

  if (profile.companyId) {
    const existing = await prisma.company.findUnique({
      where: {
        id: profile.companyId
      }
    });

    if (existing) {
      return existing;
    }

    return prisma.company.create({
      data: {
        id: profile.companyId,
        name: `${fallbackName} ${profile.companyId}`
      }
    });
  }

  let company = await prisma.company.findFirst({
    where: {
      name: fallbackName
    }
  });

  if (!company) {
    company = await prisma.company.create({
      data: {
        name: fallbackName
      }
    });
  }

  return company;
}

async function ensureImportedDepartment(companyId, profile) {
  const fallbackName = String(
    process.env.SUPABASE_IMPORTED_DEPARTMENT_NAME || "Acesso geral"
  ).trim();

  if (profile.role === ROLES.SUPER_ADMIN) {
    return null;
  }

  if (profile.departmentId) {
    const existing = await prisma.department.findUnique({
      where: {
        id: profile.departmentId
      }
    });

    if (existing && Number(existing.companyId) === Number(companyId)) {
      return existing;
    }

    return prisma.department.create({
      data: {
        id: profile.departmentId,
        companyId: Number(companyId),
        name: `${fallbackName} ${profile.departmentId}`,
        slug: `${slugify(fallbackName)}-${profile.departmentId}`,
        description: "Departamento importado automaticamente do Supabase",
        active: true
      }
    });
  }

  const slug = slugify(fallbackName);
  let department = await prisma.department.findFirst({
    where: {
      companyId: Number(companyId),
      slug
    }
  });

  if (!department) {
    department = await prisma.department.create({
      data: {
        companyId: Number(companyId),
        name: fallbackName,
        slug,
        description: "Departamento padrao para logins importados do Supabase",
        active: true
      }
    });
  }

  return department;
}

export async function ensureSupabaseProvisioningScope(profile) {
  if (profile.role === ROLES.SUPER_ADMIN) {
    let company = await prisma.company.findFirst({
      where: {
        name: String(process.env.SUPER_ADMIN_COMPANY || "Conformix Platform").trim()
      }
    });

    if (!company) {
      company = await prisma.company.create({
        data: {
          name: String(process.env.SUPER_ADMIN_COMPANY || "Conformix Platform").trim()
        }
      });
    }

    return {
      companyId: company.id,
      departmentId: null
    };
  }

  const company = await ensureImportedCompany(profile);
  const department = await ensureImportedDepartment(company.id, profile);

  return {
    companyId: company.id,
    departmentId: department?.id || null
  };
}
