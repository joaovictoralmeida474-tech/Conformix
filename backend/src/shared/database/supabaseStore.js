import { createClient } from "@supabase/supabase-js";

import {
  getSupabaseAnonKey,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
  isSupabaseDataConfigured
} from "../config/supabaseEnv.js";
import { getSupabaseAccessToken } from "./supabaseContext.js";

const globalStore = globalThis;

function decodeJwtPayload(token = "") {
  const parts = String(token || "").split(".");
  if (parts.length < 2) return null;

  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

export function isJwtExpired(token = "", skewSeconds = 30) {
  const payload = decodeJwtPayload(token);
  const exp = Number(payload?.exp);

  if (!Number.isFinite(exp)) {
    return false;
  }

  return Date.now() >= (exp - skewSeconds) * 1000;
}

function isJwtExpiredError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes("jwt expired") || message.includes("invalid jwt");
}

function clearSupabaseClientCache() {
  if (globalStore.__integraxxSupabaseClients) {
    globalStore.__integraxxSupabaseClients.clear();
  }
}

function createServiceRoleClient() {
  const serviceRoleKey = getSupabaseServiceRoleKey();

  return createClient(getSupabaseUrl(), serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

function createUserClient(accessToken = "") {
  const userToken = String(accessToken || "").trim();
  const anonKey = getSupabaseAnonKey();
  const bearer = userToken && !isJwtExpired(userToken) ? userToken : anonKey;

  return createClient(getSupabaseUrl(), anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${bearer}`
      }
    }
  });
}

function createDataClient(accessToken = "") {
  if (getSupabaseServiceRoleKey()) {
    return createServiceRoleClient();
  }

  return createUserClient(accessToken);
}

function getClientCacheKey(accessToken = "") {
  if (getSupabaseServiceRoleKey()) {
    return "service-role";
  }

  const userToken = String(accessToken || "").trim();
  if (userToken && !isJwtExpired(userToken)) {
    return `user:${userToken.slice(0, 24)}`;
  }

  return "anon";
}

function resolveAccessToken(explicitToken = "") {
  const token = String(explicitToken || getSupabaseAccessToken() || "").trim();

  if (!token || isJwtExpired(token)) {
    return "";
  }

  return token;
}

export function getSupabaseAdmin(options = {}) {
  if (!isSupabaseDataConfigured()) {
    throw new Error(
      "Supabase nao configurado. Defina SUPABASE_URL e SUPABASE_ANON_KEY (ou VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY) na Vercel em Production e Preview."
    );
  }

  const accessToken = resolveAccessToken(options.accessToken);
  const cacheKey = getClientCacheKey(accessToken);

  if (!globalStore.__integraxxSupabaseClients) {
    globalStore.__integraxxSupabaseClients = new Map();
  }

  if (!globalStore.__integraxxSupabaseClients.has(cacheKey)) {
    globalStore.__integraxxSupabaseClients.set(cacheKey, createDataClient(accessToken));
  }

  return globalStore.__integraxxSupabaseClients.get(cacheKey);
}

export { isSupabaseDataConfigured };

function isRlsPolicyError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  const code = String(error?.code || "");

  return (
    code === "42501" ||
    message.includes("row-level security") ||
    message.includes("violates row-level security")
  );
}

function isTextUuidOperatorError(error) {
  return String(error?.message || error || "").includes("operator does not exist: text = uuid");
}

async function probeSupabaseClient(client, timeoutMs) {
  const probe = client.from("Company").select("id").limit(1);

  const result = await Promise.race([
    probe,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Timeout ao conectar ao Supabase")), timeoutMs);
    })
  ]);

  if (result?.error) {
    if (isTextUuidOperatorError(result.error)) {
      const schemaError = new Error(
        "Erro de schema/RLS no Supabase (text = uuid). Execute backend/supabase/reset_all_rls.sql no SQL Editor ou adicione SUPABASE_SERVICE_ROLE_KEY na Vercel (somente servidor)."
      );
      schemaError.code = "SUPABASE_SCHEMA_RLS";
      throw schemaError;
    }

    if (isJwtExpiredError(result.error)) {
      clearSupabaseClientCache();
      const expiredError = new Error("JWT expired");
      expiredError.code = "SUPABASE_JWT_EXPIRED";
      throw expiredError;
    }

    if (isRlsPolicyError(result.error)) {
      return { ok: true, rlsBlocked: true };
    }

    throw result.error;
  }

  return { ok: true, rlsBlocked: false };
}

export async function testSupabaseConnection(timeoutMs = 8000, explicitAccessToken = "") {
  if (!isSupabaseDataConfigured()) {
    return { configured: false, connected: false, needsRelogin: false, schemaError: false };
  }

  const rawToken = String(explicitAccessToken || getSupabaseAccessToken() || "").trim();
  const accessToken = resolveAccessToken(rawToken);

  if (getSupabaseServiceRoleKey()) {
    try {
      await probeSupabaseClient(getSupabaseAdmin({ accessToken }), timeoutMs);
      return { configured: true, connected: true, needsRelogin: false, schemaError: false };
    } catch (error) {
      console.error("Teste de conexao Supabase falhou:", error?.message || error);
      return {
        configured: true,
        connected: false,
        needsRelogin: false,
        schemaError: error?.code === "SUPABASE_SCHEMA_RLS"
      };
    }
  }

  if (rawToken && isJwtExpired(rawToken)) {
    return { configured: true, connected: false, needsRelogin: true, schemaError: false };
  }

  if (!accessToken) {
    return { configured: true, connected: false, needsRelogin: true, schemaError: false };
  }

  try {
    await probeSupabaseClient(getSupabaseAdmin({ accessToken }), timeoutMs);
    return { configured: true, connected: true, needsRelogin: false, schemaError: false };
  } catch (error) {
    console.error("Teste de conexao Supabase falhou:", error?.message || error);

    if (error?.code === "SUPABASE_SCHEMA_RLS" || isTextUuidOperatorError(error)) {
      return { configured: true, connected: false, needsRelogin: false, schemaError: true };
    }

    if (error?.code === "SUPABASE_JWT_EXPIRED" || isJwtExpiredError(error)) {
      return { configured: true, connected: false, needsRelogin: true, schemaError: false };
    }

    return { configured: true, connected: false, needsRelogin: false, schemaError: false };
  }
}

export function throwIfSupabaseError(result, label = "operacao") {
  if (result?.error) {
    if (isTextUuidOperatorError(result.error)) {
      const schemaError = new Error(
        "Erro de schema/RLS no Supabase (text = uuid). Execute backend/supabase/reset_all_rls.sql no SQL Editor ou configure SUPABASE_SERVICE_ROLE_KEY na Vercel."
      );
      schemaError.code = "SUPABASE_SCHEMA_RLS";
      throw schemaError;
    }

    if (isJwtExpiredError(result.error)) {
      clearSupabaseClientCache();
      const expiredError = new Error(
        "Sessao do Supabase expirada. Faca logout e login novamente para continuar."
      );
      expiredError.code = "SUPABASE_JWT_EXPIRED";
      throw expiredError;
    }

    const error = new Error(result.error.message || `Falha na ${label}`);
    error.code = result.error.code;
    throw error;
  }

  return result.data;
}
