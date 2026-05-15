import "./loadEnv.js";

export function getSupabaseUrl() {
  return String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/i, "")
    .replace(/\/auth\/v1$/i, "");
}

export function getSupabaseAnonKey() {
  return String(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "").trim();
}

/** Opcional: apenas para sincronizar usuarios na API Admin Auth do Supabase. */
export function getSupabaseServiceRoleKey() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

export function getSupabaseDataKey() {
  return getSupabaseAnonKey();
}

export function isSupabaseDataConfigured() {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}
