import bcrypt from "bcryptjs";

import { PERMISSION_DEFINITIONS, ROLE_PERMISSION_MAP, ROLES, normalizeRole } from "../auth/permissions.js";
import { isSupabaseDataConfigured } from "../config/supabaseEnv.js";
import { getSupabaseAdmin, throwIfSupabaseError } from "./supabaseStore.js";

let bootstrapPromise = null;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function hasUsablePostgresDatabase() {
  return isSupabaseDataConfigured();
}

export async function testDatabaseConnection(timeoutMs = 8000, accessToken = "") {
  const { testSupabaseConnection } = await import("./supabaseStore.js");
  const result = await testSupabaseConnection(timeoutMs, accessToken);
  return result.connected;
}

export async function describeDatabaseConnection(timeoutMs = 8000, accessToken = "") {
  const { testSupabaseConnection } = await import("./supabaseStore.js");
  return testSupabaseConnection(timeoutMs, accessToken);
}

async function ensureDefaultCompany() {
  const client = getSupabaseAdmin();
  const companyName = String(process.env.SUPER_ADMIN_COMPANY || "Integraxx Platform").trim();

  const existing = throwIfSupabaseError(
    await client.from("Company").select("id,name").eq("name", companyName).limit(1).maybeSingle(),
    "buscar empresa padrao"
  );

  if (existing) {
    const department = throwIfSupabaseError(
      await client
        .from("Department")
        .select("id,name,slug,companyId,active")
        .eq("companyId", existing.id)
        .eq("active", true)
        .limit(1)
        .maybeSingle(),
      "buscar departamento padrao"
    );

    return { company: existing, department };
  }

  const company = throwIfSupabaseError(
    await client.from("Company").insert({ name: companyName }).select("id,name").single(),
    "criar empresa padrao"
  );

  const department = throwIfSupabaseError(
    await client
      .from("Department")
      .insert({
        companyId: company.id,
        name: "Administracao Global",
        slug: "administracao-global",
        description: "Departamento padrao da plataforma",
        active: true
      })
      .select("id,name,slug,companyId,active")
      .single(),
    "criar departamento padrao"
  );

  return { company, department };
}

export async function provisionUserFromSessionSnapshot(userSnapshot = {}) {
  const email = normalizeEmail(userSnapshot.email);
  const role = normalizeRole(userSnapshot.role || ROLES.USER);

  if (!email) {
    return null;
  }

  const client = getSupabaseAdmin();
  let existing = throwIfSupabaseError(
    await client.from("User").select("*").eq("email", email).maybeSingle(),
    "buscar usuario por email"
  );

  const authUserId = String(userSnapshot.id || "").trim();

  if (existing) {
    return existing;
  }

  const { company, department } = await ensureDefaultCompany();
  const passwordSeed = `supabase:${String(userSnapshot.id || email)}`;
  const hash = await bcrypt.hash(passwordSeed, 10);

  return throwIfSupabaseError(
    await client
      .from("User")
      .insert({
        name: String(userSnapshot.name || "Usuario").trim() || "Usuario",
        email,
        password: hash,
        role: role === ROLES.SUPER_ADMIN ? ROLES.SUPER_ADMIN : role,
        active: userSnapshot.active !== false,
        companyId: company.id,
        departmentId: role === ROLES.SUPER_ADMIN ? null : department?.id || null,
        authUserId: authUserId || null
      })
      .select("*")
      .single(),
    "criar usuario da sessao"
  );
}

async function seedPermissionsSupabase() {
  const client = getSupabaseAdmin();

  for (const item of PERMISSION_DEFINITIONS) {
    const existing = throwIfSupabaseError(
      await client.from("Permission").select("id").eq("key", item.key).maybeSingle(),
      "buscar permissao"
    );

    if (existing) {
      throwIfSupabaseError(
        await client
          .from("Permission")
          .update({
            name: item.name,
            description: item.description || null
          })
          .eq("id", existing.id),
        "atualizar permissao"
      );
      continue;
    }

    throwIfSupabaseError(
      await client.from("Permission").insert({
        key: item.key,
        name: item.name,
        description: item.description || null
      }),
      "criar permissao"
    );
  }

  const permissions = throwIfSupabaseError(
    await client.from("Permission").select("id,key"),
    "listar permissoes"
  );
  const permissionMap = new Map((permissions || []).map((item) => [item.key, item.id]));

  for (const [role, keys] of Object.entries(ROLE_PERMISSION_MAP)) {
    for (const permissionKey of keys) {
      const permissionId = permissionMap.get(permissionKey);
      if (!permissionId) continue;

      const existingLink = throwIfSupabaseError(
        await client
          .from("RolePermission")
          .select("id")
          .eq("role", role)
          .eq("permissionId", permissionId)
          .maybeSingle(),
        "buscar role permission"
      );

      if (existingLink) continue;

      throwIfSupabaseError(
        await client.from("RolePermission").insert({
          role,
          permissionId
        }),
        "criar role permission"
      );
    }
  }
}

async function runPlatformBootstrap(userSnapshot = null) {
  await seedPermissionsSupabase();
  await ensureDefaultCompany();

  if (userSnapshot?.email) {
    await provisionUserFromSessionSnapshot(userSnapshot);
  }
}

export async function ensurePlatformBootstrap(userSnapshot = null) {
  if (!isSupabaseDataConfigured()) {
    return false;
  }

  const timeoutMs = process.env.VERCEL === "1" ? 8000 : 30000;

  try {
    if (!bootstrapPromise) {
      bootstrapPromise = Promise.race([
        runPlatformBootstrap(userSnapshot),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Timeout no bootstrap da plataforma")), timeoutMs);
        })
      ]).catch((error) => {
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
