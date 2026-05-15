import { readJsonBody, sendJson, setAuthCookie } from "../lib/http.mjs";
import { performLogin } from "../lib/loginCore.mjs";

function readSupabaseConfig(body = {}) {
  return {
    url: body.supabaseUrl || body.supabase_url,
    anonKey: body.supabaseAnonKey || body.supabase_anon_key
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Metodo nao permitido" });
  }

  try {
    const body = await readJsonBody(req);
    const email = body?.email;
    const password = body?.password;
    const rememberMe = Boolean(body?.rememberMe);
    const supabaseConfig = readSupabaseConfig(body);

    if (!email || !password) {
      return sendJson(res, 400, { error: "Email e senha sao obrigatorios" });
    }

    const result = await performLogin({
      email,
      password,
      supabaseConfig
    });
    setAuthCookie(res, result.token, rememberMe);
    return sendJson(res, 200, { user: result.user });
  } catch (error) {
    console.error("Erro no login serverless:", error);

    if (error?.code === "AUTH_INVALID_CREDENTIALS") {
      return sendJson(res, 401, { error: "Email ou senha invalidos" });
    }

    if (error?.code === "AUTH_SERVICE_UNAVAILABLE") {
      return sendJson(res, 503, {
        error: "Servico de autenticacao temporariamente indisponivel"
      });
    }

    return sendJson(res, 500, {
      error: "Nao foi possivel concluir a autenticacao",
      details: error?.message || "Erro interno"
    });
  }
}
