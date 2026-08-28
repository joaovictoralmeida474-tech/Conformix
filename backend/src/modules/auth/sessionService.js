import { createClient } from "@supabase/supabase-js";

import { buildSupabaseProfile } from "../../shared/auth/supabaseProvisioning.js";
import { resolveAppUserFromSupabase } from "../../shared/auth/resolveAppUser.js";
import { ROLE_PERMISSION_MAP, ROLES, normalizeRole } from "../../shared/auth/permissions.js";
import { getSupabaseAnonKey, getSupabaseUrl } from "../../shared/config/supabaseEnv.js";
import { signAccessToken } from "../../shared/middlewares/auth.js";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function createAuthError(message = "Falha na autenticacao") {
  const error = new Error(message);
  error.code = "AUTH_INVALID_CREDENTIALS";
  return error;
}

function buildFallbackContext(supabaseUser, profile) {
  const email = normalizeEmail(supabaseUser?.email || profile?.email);
  const role = normalizeRole(profile?.role || ROLES.USER);
  const permissions = ROLE_PERMISSION_MAP[role] || [];

  return {
    id: String(supabaseUser?.id || email || "supabase-user"),
    name: profile?.name || "Usuario",
    email,
    role,
    active: true,
    companyId: role === ROLES.SUPER_ADMIN ? null : profile?.companyId || null,
    departmentId: role === ROLES.SUPER_ADMIN ? null : profile?.departmentId || null,
    company: null,
    department: null,
    permissions,
    permissionsSource: "role"
  };
}

export async function createSessionFromAccessToken(accessToken, refreshToken = "") {
  const token = String(accessToken || "").trim();
  const nextRefreshToken = String(refreshToken || "").trim();

  if (!token) {
    throw createAuthError("Token de acesso obrigatorio");
  }

  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  if (!url || !anonKey) {
    throw createAuthError("Supabase nao configurado");
  }

  const supabase = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user?.email) {
    throw createAuthError(error?.message || "Sessao Supabase invalida ou expirada");
  }

  const profile = buildSupabaseProfile(data.user);
  const aliases = new Set(["superadmin@integraxx.local", "superadmin@conformix.local"]);
  const email = normalizeEmail(data.user.email);

  if (aliases.has(email) && profile.role !== ROLES.SUPER_ADMIN) {
    profile.role = ROLES.SUPER_ADMIN;
  }

  let user;

  try {
    user = await resolveAppUserFromSupabase(data.user, buildFallbackContext(data.user, profile), token);
  } catch {
    user = buildFallbackContext(data.user, profile);
  }

  if (!user?.email) {
    throw createAuthError("Nao foi possivel resolver o usuario da sessao");
  }

  return {
    user,
    token: signAccessToken(user, {
      supabaseAccessToken: token,
      supabaseRefreshToken: nextRefreshToken
    })
  };
}
