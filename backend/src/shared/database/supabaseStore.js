import { createClient } from "@supabase/supabase-js";

import {
  getSupabaseAnonKey,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
  isSupabaseDataConfigured
} from "../config/supabaseEnv.js";
import { getSupabaseAccessToken } from "./supabaseContext.js";

const globalStore = globalThis;

function createDataClient(accessToken = "") {
  const userToken = String(accessToken || "").trim();
  const serviceRoleKey = getSupabaseServiceRoleKey();
  const apiKey = serviceRoleKey || getSupabaseAnonKey();
  const authorization = userToken || serviceRoleKey || apiKey;

  return createClient(getSupabaseUrl(), apiKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${authorization}`
      }
    }
  });
}

function getClientCacheKey(accessToken = "") {
  const userToken = String(accessToken || "").trim();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  if (serviceRoleKey) {
    return "service-role";
  }

  return userToken ? `user:${userToken.slice(0, 24)}` : "anon";
}

function resolveAccessToken(explicitToken = "") {
  return String(explicitToken || getSupabaseAccessToken() || "").trim();
}

export function getSupabaseAdmin(options = {}) {
  if (!isSupabaseDataConfigured()) {
    throw new Error(
      "Supabase nao configurado. Defina SUPABASE_URL e SUPABASE_ANON_KEY (ou VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY) na Vercel em Production e Preview."
    );
  }

  const accessToken = resolveAccessToken(options.accessToken);
  const cacheKey = getClientCacheKey(accessToken);

  if (!globalStore.__conformixSupabaseClients) {
    globalStore.__conformixSupabaseClients = new Map();
  }

  if (!globalStore.__conformixSupabaseClients.has(cacheKey)) {
    globalStore.__conformixSupabaseClients.set(cacheKey, createDataClient(accessToken));
  }

  return globalStore.__conformixSupabaseClients.get(cacheKey);
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

async function probeSupabaseClient(client, timeoutMs) {
  const probe = client.from("Company").select("id").limit(1);

  const result = await Promise.race([
    probe,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Timeout ao conectar ao Supabase")), timeoutMs);
    })
  ]);

  if (result?.error) {
    if (isRlsPolicyError(result.error)) {
      return { ok: true, rlsBlocked: true };
    }

    throw result.error;
  }

  return { ok: true, rlsBlocked: false };
}

export async function testSupabaseConnection(timeoutMs = 8000, explicitAccessToken = "") {
  if (!isSupabaseDataConfigured()) {
    return { configured: false, connected: false, needsRelogin: false };
  }

  const accessToken = resolveAccessToken(explicitAccessToken);

  if (getSupabaseServiceRoleKey()) {
    try {
      await probeSupabaseClient(getSupabaseAdmin({ accessToken }), timeoutMs);
      return { configured: true, connected: true, needsRelogin: false };
    } catch (error) {
      console.error("Teste de conexao Supabase falhou:", error?.message || error);
      return { configured: true, connected: false, needsRelogin: false };
    }
  }

  if (!accessToken) {
    return { configured: true, connected: false, needsRelogin: true };
  }

  try {
    await probeSupabaseClient(getSupabaseAdmin({ accessToken }), timeoutMs);
    return { configured: true, connected: true, needsRelogin: false };
  } catch (error) {
    console.error("Teste de conexao Supabase falhou:", error?.message || error);
    return { configured: true, connected: false, needsRelogin: false };
  }
}

export function throwIfSupabaseError(result, label = "operacao") {
  if (result?.error) {
    const error = new Error(result.error.message || `Falha na ${label}`);
    error.code = result.error.code;
    throw error;
  }

  return result.data;
}
