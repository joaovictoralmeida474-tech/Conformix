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

export function getSupabaseAdmin() {
  if (!isSupabaseDataConfigured()) {
    throw new Error(
      "Supabase nao configurado. Defina SUPABASE_URL e SUPABASE_ANON_KEY na Vercel."
    );
  }

  const accessToken = getSupabaseAccessToken();
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

export async function testSupabaseConnection(timeoutMs = 8000) {
  if (!isSupabaseDataConfigured()) {
    return false;
  }

  if (getSupabaseServiceRoleKey()) {
    try {
      const client = getSupabaseAdmin();
      const probe = client.from("Company").select("id").limit(1);

      await Promise.race([
        probe,
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Timeout ao conectar ao Supabase")), timeoutMs);
        })
      ]);

      return true;
    } catch (error) {
      console.error("Teste de conexao Supabase falhou:", error?.message || error);
      return false;
    }
  }

  return Boolean(getSupabaseAccessToken());
}

export function throwIfSupabaseError(result, label = "operacao") {
  if (result?.error) {
    const error = new Error(result.error.message || `Falha na ${label}`);
    error.code = result.error.code;
    throw error;
  }

  return result.data;
}
