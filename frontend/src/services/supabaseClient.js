import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || "";

export function isSupabaseClientConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function getSupabasePublicConfig() {
  return {
    supabaseUrl,
    supabaseAnonKey
  };
}

export const supabase = isSupabaseClientConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
