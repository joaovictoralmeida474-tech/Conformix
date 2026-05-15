import { createClient } from "@supabase/supabase-js";

export function createSupabaseClient(config = {}) {
  const url = String(
    config.url ||
      process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      ""
  )
    .trim()
    .replace(/\/$/, "");

  const anonKey = String(
    config.anonKey ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      ""
  ).trim();

  if (!url || !anonKey) {
    const error = new Error("SUPABASE_URL ou SUPABASE_ANON_KEY nao configurados");
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
