import { isSupabaseDataConfigured } from "../backend/src/shared/config/supabaseEnv.js";
import { testSupabaseConnection } from "../backend/src/shared/database/supabaseStore.js";
import { sendJson } from "./lib/http.mjs";

export async function handleAdminStatus(_req, res) {
  const configured = isSupabaseDataConfigured();
  const connection = configured ? await testSupabaseConnection() : { connected: false };

  return sendJson(res, 200, {
    supabaseConfigured: configured,
    supabaseConnected: connection.connected,
    needsRelogin: Boolean(connection.needsRelogin),
    vercel: process.env.VERCEL === "1"
  });
}
