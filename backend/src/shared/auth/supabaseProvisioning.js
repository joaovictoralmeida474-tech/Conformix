import { ROLES, normalizeRole } from "./permissions.js";
import { getSupabaseAdmin, throwIfSupabaseError } from "../database/supabaseStore.js";

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
  const client = getSupabaseAdmin();
  const fallbackName = String(
    process.env.SUPABASE_IMPORTED_COMPANY_NAME || "Usuarios importados do Supabase"
  ).trim();

  if (profile.companyId) {
    const existing = throwIfSupabaseError(
      await client.from("Company").select("*").eq("id", profile.companyId).maybeSingle(),
      "buscar empresa importada"
    );

    if (existing) {
      return existing;
    }

    return throwIfSupabaseError(
      await client
        .from("Company")
        .insert({ id: profile.companyId, name: `${fallbackName} ${profile.companyId}` })
        .select("*")
        .single(),
      "criar empresa importada"
    );
  }

  const existing = throwIfSupabaseError(
    await client.from("Company").select("*").eq("name", fallbackName).limit(1).maybeSingle(),
    "buscar empresa padrao importada"
  );

  if (existing) {
    return existing;
  }

  return throwIfSupabaseError(
    await client.from("Company").insert({ name: fallbackName }).select("*").single(),
    "criar empresa padrao importada"
  );
}

async function ensureImportedDepartment(companyId, profile) {
  const client = getSupabaseAdmin();
  const fallbackName = String(
    process.env.SUPABASE_IMPORTED_DEPARTMENT_NAME || "Acesso geral"
  ).trim();

  if (profile.role === ROLES.SUPER_ADMIN) {
    return null;
  }

  if (profile.departmentId) {
    const existing = throwIfSupabaseError(
      await client.from("Department").select("*").eq("id", profile.departmentId).maybeSingle(),
      "buscar departamento importado"
    );

    if (existing && Number(existing.companyId) === Number(companyId)) {
      return existing;
    }

    return throwIfSupabaseError(
      await client
        .from("Department")
        .insert({
          id: profile.departmentId,
          companyId: Number(companyId),
          name: `${fallbackName} ${profile.departmentId}`,
          slug: `${slugify(fallbackName)}-${profile.departmentId}`,
          description: "Departamento importado automaticamente do Supabase",
          active: true
        })
        .select("*")
        .single(),
      "criar departamento importado"
    );
  }

  const slug = slugify(fallbackName);
  const existing = throwIfSupabaseError(
    await client
      .from("Department")
      .select("*")
      .eq("companyId", Number(companyId))
      .eq("slug", slug)
      .limit(1)
      .maybeSingle(),
    "buscar departamento padrao importado"
  );

  if (existing) {
    return existing;
  }

  return throwIfSupabaseError(
    await client
      .from("Department")
      .insert({
        companyId: Number(companyId),
        name: fallbackName,
        slug,
        description: "Departamento padrao para logins importados do Supabase",
        active: true
      })
      .select("*")
      .single(),
    "criar departamento padrao importado"
  );
}

export async function ensureSupabaseProvisioningScope(profile) {
  if (profile.role === ROLES.SUPER_ADMIN) {
    const client = getSupabaseAdmin();
    const companyName = String(process.env.SUPER_ADMIN_COMPANY || "Conformix Platform").trim();
    const existing = throwIfSupabaseError(
      await client.from("Company").select("*").eq("name", companyName).limit(1).maybeSingle(),
      "buscar empresa do super admin"
    );

    const company =
      existing ||
      throwIfSupabaseError(
        await client.from("Company").insert({ name: companyName }).select("*").single(),
        "criar empresa do super admin"
      );

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
