import { createClient } from "@supabase/supabase-js";

import { getSupabaseServiceRoleKey, getSupabaseUrl, isSupabaseDataConfigured } from "../config/supabaseEnv.js";

const globalStore = globalThis;

function createAdminClient() {
  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export function getSupabaseAdmin() {
  if (!isSupabaseDataConfigured()) {
    throw new Error(
      "Supabase nao configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY na Vercel."
    );
  }

  if (!globalStore.__conformixSupabaseAdmin) {
    globalStore.__conformixSupabaseAdmin = createAdminClient();
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
