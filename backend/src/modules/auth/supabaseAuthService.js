import axios from "axios";

function getSupabaseConfig() {
  const url = String(process.env.SUPABASE_URL || "").trim();
  const anonKey = String(process.env.SUPABASE_ANON_KEY || "").trim();

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
