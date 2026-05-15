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

function ensureSupabaseEnv() {
  resolveEnv("SUPABASE_URL", ["VITE_SUPABASE_URL"]);
  resolveEnv("SUPABASE_ANON_KEY", ["VITE_SUPABASE_ANON_KEY"]);
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

function getAuthEmailCandidates(email) {
  return [normalizeEmail(email)];
}

function normalizePasswordCandidates(password) {
  const raw = String(password || "");
  const trimmed = raw.trim();
  return [...new Set([raw, trimmed].filter(Boolean))];
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

function buildSupabaseProfile(supabaseUser) {
  return {
    email: normalizeEmail(supabaseUser?.email),
    name:
      String(extractSupabaseMetadataValue(supabaseUser, "name") ?? deriveDisplayName(supabaseUser)).trim() ||
      "Usuario",
    role: normalizeRole(extractSupabaseMetadataValue(supabaseUser, "role")),
    companyId: toPositiveInt(extractSupabaseMetadataValue(supabaseUser, "companyId")),
    departmentId: toPositiveInt(extractSupabaseMetadataValue(supabaseUser, "departmentId"))
  };
}

function buildUserFromSupabase(supabaseUser, emailHint = "") {
  const profile = buildSupabaseProfile(supabaseUser);
  const normalizedEmail = normalizeEmail(supabaseUser?.email || emailHint);
  const aliases = getSuperAdminAliases();
  const isSuperAdminAlias = aliases.has(normalizedEmail);
  const role = isSuperAdminAlias ? ROLES.SUPER_ADMIN : normalizeRole(profile.role || ROLES.USER);
  const permissions = ROLE_PERMISSION_MAP[role] || [];

  return {
    id: String(supabaseUser?.id || normalizedEmail || "supabase-user"),
    name: profile.name || "Usuario",
    email: normalizedEmail,
    role,
    active: true,
    companyId: role === ROLES.SUPER_ADMIN ? null : profile.companyId,
    departmentId: role === ROLES.SUPER_ADMIN ? null : profile.departmentId,
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

function getSupabaseClient() {
  ensureSupabaseEnv();

  const url = String(process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const anonKey = String(process.env.SUPABASE_ANON_KEY || "").trim();

  if (!url || !anonKey) {
    const error = new Error("SUPABASE_URL ou SUPABASE_ANON_KEY nao configurados na Vercel");
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

async function signInWithSupabase(email, password) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data?.user) {
    const authError = new Error(error?.message || "Credenciais invalidas no Supabase");
    authError.code = "AUTH_INVALID_CREDENTIALS";
    throw authError;
  }

  return {
    user: data.user,
    session: data.session
  };
}

export async function performLogin({ email, password }) {
  const emailCandidates = getAuthEmailCandidates(email);
  const passwordCandidates = normalizePasswordCandidates(password);
  let lastInvalidCredentials = false;
  let serviceUnavailable = false;

  for (const currentEmail of emailCandidates) {
    for (const currentPassword of passwordCandidates) {
      try {
        const authResponse = await signInWithSupabase(currentEmail, currentPassword);
        const supabaseUser = authResponse?.user || authResponse?.session?.user;

        if (!supabaseUser?.email) {
          lastInvalidCredentials = true;
          continue;
        }

        const user = buildUserFromSupabase(supabaseUser, currentEmail);
        return {
          user,
          token: signAccessToken(user)
        };
      } catch (error) {
        if (error?.code === "AUTH_INVALID_CREDENTIALS") {
          lastInvalidCredentials = true;
          continue;
        }

        if (error?.code === "AUTH_SERVICE_UNAVAILABLE") {
          serviceUnavailable = true;
          continue;
        }

        if (error?.response?.status === 400 || error?.response?.status === 401) {
          lastInvalidCredentials = true;
          continue;
        }

        throw error;
      }
    }
  }

  if (serviceUnavailable) {
    const error = new Error("Servico de autenticacao temporariamente indisponivel");
    error.code = "AUTH_SERVICE_UNAVAILABLE";
    throw error;
  }

  if (lastInvalidCredentials) {
    const error = new Error("Email ou senha invalidos");
    error.code = "AUTH_INVALID_CREDENTIALS";
    throw error;
  }

  const error = new Error("Email ou senha invalidos");
  error.code = "AUTH_INVALID_CREDENTIALS";
  throw error;
}
