import jwt from "jsonwebtoken";

import { resolveAppUserFromSupabase } from "../../backend/src/shared/auth/resolveAppUser.js";
import { getJwtSecret } from "./authToken.mjs";
import { createSupabaseClient } from "./supabaseConfig.mjs";
import { buildUserFromSupabase } from "./userFromSupabase.mjs";

function signAccessToken(user, supabaseAccessToken = "") {
  const token = String(supabaseAccessToken || "").trim();

  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      userSnapshot: user,
      supabaseAccessToken: token || undefined
    },
    getJwtSecret(),
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "8h"
    }
  );
}

export async function createSessionFromAccessToken(accessToken, supabaseConfig = {}) {
  const token = String(accessToken || "").trim();

  if (!token) {
    const error = new Error("Token de acesso obrigatorio");
    error.code = "AUTH_INVALID_CREDENTIALS";
    throw error;
  }

  const supabase = createSupabaseClient(supabaseConfig);
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user?.email) {
    const authError = new Error(error?.message || "Sessao Supabase invalida ou expirada");
    authError.code = "AUTH_INVALID_CREDENTIALS";
    throw authError;
  }

  const profile = buildUserFromSupabase(data.user);
  const user = await resolveAppUserFromSupabase(data.user, profile, token);

  return {
    user,
    token: signAccessToken(user, token)
  };
}
