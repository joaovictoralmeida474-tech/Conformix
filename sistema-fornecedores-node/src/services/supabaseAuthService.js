const axios = require('axios');

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('SUPABASE_URL ou SUPABASE_ANON_KEY nao configurados');
  }

  return {
    url: url.replace(/\/$/, ''),
    anonKey
  };
}

async function signInWithPassword(email, password) {
  const { url, anonKey } = getSupabaseConfig();

  const response = await axios.post(
    `${url}/auth/v1/token?grant_type=password`,
    { email, password },
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data;
}

module.exports = {
  signInWithPassword
};
