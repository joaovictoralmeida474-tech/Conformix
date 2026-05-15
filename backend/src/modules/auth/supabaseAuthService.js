import axios from "axios";

function normalizeSupabaseUrl(url) {
  let normalized = String(url || "").trim();

  if (!normalized) {
    return "";
  }

  normalized = normalized
    .replace(/\/rest\/v1\/?$/i, "")
    .replace(/\/auth\/v1\/?$/i, "")
    .replace(/\/+$/, "");

  try {
    const parsed = new URL(normalized);

    if (parsed.hostname.includes("supabase.co") && parsed.pathname && parsed.pathname !== "/") {
      return `${parsed.protocol}//${parsed.host}`;
    }
  } catch {
    return normalized;
  }

  return normalized;
}

function getSupabaseConfig() {
  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "");
  const anonKey = String(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "").trim();

  if (!url || !anonKey) {
    throw new Error("SUPABASE_URL ou SUPABASE_ANON_KEY nao configurados");
  }

  return {
    url: url.replace(/\/$/, ""),
    anonKey
  };
}

export async function signInWithPassword(email, password) {
  const { url, anonKey } = getSupabaseConfig();

  const response = await axios.post(
    `${url}/auth/v1/token?grant_type=password`,
    {
      email,
      password
    },
    {
      proxy: false,
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json"
      }
    }
  );

  return response.data;
}
