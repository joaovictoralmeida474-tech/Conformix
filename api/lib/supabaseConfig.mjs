import { createClient } from "@supabase/supabase-js";

import { normalizeSupabaseUrl } from "./normalizeSupabaseUrl.mjs";

export function createSupabaseClient(config = {}) {
  const url = normalizeSupabaseUrl(
    config.url || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ""
  );

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
