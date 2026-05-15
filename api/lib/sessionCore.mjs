import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";

import {
  ROLE_PERMISSION_MAP,
  ROLES,
  normalizeRole
} from "../../backend/src/shared/auth/permissions.js";

const FALLBACK_JWT_SECRET = "conformix-vercel-fallback-jwt-secret-2026-secure-seed";

function resolveEnv(primaryKey, aliasKeys = []) {
  const primary = String(process.env[primaryKey] || "").trim();

  if (primary) {
    return primary;
  }

  for (const aliasKey of aliasKeys) {
    const aliasValue = String(process.env[aliasKey] || "").trim();

    if (aliasValue) {
      process.env[primaryKey] = aliasValue;
      return aliasValue;
    }
  }

  return "";
}

function getSupabaseClient() {
  const url = resolveEnv("SUPABASE_URL", ["VITE_SUPABASE_URL"]).replace(/\/$/, "");
  const anonKey = resolveEnv("SUPABASE_ANON_KEY", ["VITE_SUPABASE_ANON_KEY"]);

  if (!url || !anonKey) {
    const error = new Error("SUPABASE_URL ou SUPABASE_ANON_KEY nao configurados");
    error.code = "AUTH_SERVICE_UNAVAILABLE";
    throw error;
  }

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

function getJwtSecret() {
  const secret = String(process.env.JWT_SECRET || "").trim();

  if (!secret || secret.length < 32 || secret.toUpperCase() === "SECRET") {
    return FALLBACK_JWT_SECRET;
  }

  return secret;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getSuperAdminAliases() {
  const configured = normalizeEmail(process.env.SUPER_ADMIN_EMAIL);
  return new Set(
    [
      "superadmin@conformix.local",
      "joaovictoralmeida474@gmail.com",
      configured
    ].filter(Boolean)
  );
}

function extractSupabaseMetadataValue(user, key) {
  return user?.app_metadata?.[key] ?? user?.user_metadata?.[key] ?? null;
}

function deriveDisplayName(supabaseUser) {
  const metadataName =
    supabaseUser?.app_metadata?.name ?? supabaseUser?.user_metadata?.name ?? "";

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

function toPositiveInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function buildUserFromSupabase(supabaseUser) {
  const normalizedEmail = normalizeEmail(supabaseUser?.email);
  const aliases = getSuperAdminAliases();
  const isSuperAdminAlias = aliases.has(normalizedEmail);
  const role = isSuperAdminAlias
    ? ROLES.SUPER_ADMIN
    : normalizeRole(extractSupabaseMetadataValue(supabaseUser, "role") || ROLES.USER);
  const permissions = ROLE_PERMISSION_MAP[role] || [];
  const name =
    String(extractSupabaseMetadataValue(supabaseUser, "name") ?? deriveDisplayName(supabaseUser)).trim() ||
    "Usuario";

  return {
    id: String(supabaseUser?.id || normalizedEmail || "supabase-user"),
    name,
    email: normalizedEmail,
    role,
    active: true,
    companyId:
      role === ROLES.SUPER_ADMIN
        ? null
        : toPositiveInt(extractSupabaseMetadataValue(supabaseUser, "companyId")),
    departmentId:
      role === ROLES.SUPER_ADMIN
        ? null
        : toPositiveInt(extractSupabaseMetadataValue(supabaseUser, "departmentId")),
    company: null,
    department: null,
    permissions,
    permissionsSource: "role"
  };
}

function signAccessToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: normalizeRole(user.role),
      userSnapshot: user
    },
    getJwtSecret(),
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "8h"
    }
  );
}

export async function createSessionFromAccessToken(accessToken) {
  const token = String(accessToken || "").trim();

  if (!token) {
    const error = new Error("Token de acesso obrigatorio");
    error.code = "AUTH_INVALID_CREDENTIALS";
    throw error;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user?.email) {
    const authError = new Error("Sessao Supabase invalida ou expirada");
    authError.code = "AUTH_INVALID_CREDENTIALS";
    throw authError;
  }

  const user = buildUserFromSupabase(data.user);

  return {
    user,
    token: signAccessToken(user)
  };
}
