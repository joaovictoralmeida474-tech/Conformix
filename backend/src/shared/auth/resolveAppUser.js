import { getUserContextById } from "./userContext.js";
import { runWithSupabaseAccessTokenAsync } from "../database/supabaseContext.js";
import { provisionUserFromSessionSnapshot } from "../database/platformBootstrap.js";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export async function resolveAppUserFromSupabase(supabaseUser, profile, accessToken = "") {
  const snapshot = {
    id: String(supabaseUser?.id || profile?.id || "").trim(),
    email: normalizeEmail(supabaseUser?.email || profile?.email),
    name: String(profile?.name || "").trim() || "Usuario",
    role: profile?.role,
    active: profile?.active !== false
  };

  if (!snapshot.email) {
    return profile;
  }

  try {
    const localRow = await runWithSupabaseAccessTokenAsync(accessToken, async () =>
      provisionUserFromSessionSnapshot(snapshot)
    );

    if (localRow?.id) {
      const context = await runWithSupabaseAccessTokenAsync(accessToken, async () =>
        getUserContextById(localRow.id)
      );

      if (context) {
        return context;
      }
    }
  } catch (error) {
    console.error("Falha ao resolver usuario local do Supabase:", error?.message || error);
  }

  return profile;
}
