import { createClient } from "@supabase/supabase-js";

import {
  getSupabaseAnonKey,
  getSupabaseUrl,
  isSupabaseDataConfigured
} from "../config/supabaseEnv.js";

const globalStore = globalThis;

function createDataClient() {
  return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export function getSupabaseAdmin() {
  if (!isSupabaseDataConfigured()) {
    throw new Error(
      "Supabase nao configurado. Defina SUPABASE_URL e SUPABASE_ANON_KEY na Vercel."
    );
  }

  if (!globalStore.__conformixSupabaseAdmin) {
    globalStore.__conformixSupabaseAdmin = createDataClient();
  }

  return globalStore.__conformixSupabaseAdmin;
}

export { isSupabaseDataConfigured };

export async function testSupabaseConnection(timeoutMs = 8000) {
  if (!isSupabaseDataConfigured()) {
    return false;
  }

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

export function throwIfSupabaseError(result, label = "operacao") {
  if (result?.error) {
    const error = new Error(result.error.message || `Falha na ${label}`);
    error.code = result.error.code;
    throw error;
  }

  return result.data;
}
