import jwt from "jsonwebtoken";

import { getJwtSecret } from "./authToken.mjs";
import { createSupabaseClient } from "./supabaseConfig.mjs";
import { buildUserFromSupabase } from "./userFromSupabase.mjs";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizePasswordCandidates(password) {
  const raw = String(password || "");
  const trimmed = raw.trim();
  return [...new Set([raw, trimmed].filter(Boolean))];
}

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

async function signInWithSupabase(email, password, supabaseConfig = {}) {
  const supabase = createSupabaseClient(supabaseConfig);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data?.user?.email) {
    const authError = new Error(error?.message || "Credenciais invalidas no Supabase");
    authError.code = "AUTH_INVALID_CREDENTIALS";
    throw authError;
  }

  return data;
}

export async function performLogin({ email, password, supabaseConfig = {} }) {
  const normalizedEmail = normalizeEmail(email);
  const passwordCandidates = normalizePasswordCandidates(password);
  let lastInvalidCredentials = false;

  for (const currentPassword of passwordCandidates) {
    try {
      const authData = await signInWithSupabase(normalizedEmail, currentPassword, supabaseConfig);
      const user = buildUserFromSupabase(authData.user);

      return {
        user,
        token: signAccessToken(user, authData?.session?.access_token || authData?.access_token)
      };
    } catch (error) {
      if (error?.code === "AUTH_INVALID_CREDENTIALS") {
        lastInvalidCredentials = true;
        continue;
      }

      if (error?.code === "AUTH_SERVICE_UNAVAILABLE") {
        throw error;
      }

      throw error;
    }
  }

  if (lastInvalidCredentials) {
    const authError = new Error("Email ou senha invalidos");
    authError.code = "AUTH_INVALID_CREDENTIALS";
    throw authError;
  }

  const authError = new Error("Email ou senha invalidos");
  authError.code = "AUTH_INVALID_CREDENTIALS";
  throw authError;
}
