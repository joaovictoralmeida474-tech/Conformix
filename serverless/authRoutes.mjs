import { readJsonBody, sendJson, setAuthCookie } from "./lib/http.mjs";
import { getTokenFromRequest, verifyAccessToken } from "./lib/authToken.mjs";
import { performLogin } from "./lib/loginCore.mjs";
import { createSessionFromAccessToken } from "./lib/sessionCore.mjs";

function readSupabaseConfig(body = {}) {
  return {
    url: body.supabaseUrl || body.supabase_url,
    anonKey: body.supabaseAnonKey || body.supabase_anon_key
  };
}

async function handleLogin(req, res) {
  const body = await readJsonBody(req);
  const email = body?.email;
  const password = body?.password;
  const rememberMe = Boolean(body?.rememberMe);
  const supabaseConfig = readSupabaseConfig(body);

  if (!email || !password) {
    return sendJson(res, 400, { error: "Email e senha sao obrigatorios" });
  }

  const result = await performLogin({ email, password, supabaseConfig });
  setAuthCookie(res, result.token, rememberMe);
  return sendJson(res, 200, { user: result.user });
}

async function handleSession(req, res) {
  const body = await readJsonBody(req);
  const accessToken = body?.accessToken || body?.access_token;
  const rememberMe = Boolean(body?.rememberMe);
  const supabaseConfig = readSupabaseConfig(body);

  const result = await createSessionFromAccessToken(accessToken, supabaseConfig);
  setAuthCookie(res, result.token, rememberMe);
  return sendJson(res, 200, { user: result.user });
}

async function handleMe(req, res) {
  const token = getTokenFromRequest(req);

  if (!token) {
    return sendJson(res, 401, { error: "Nao autorizado" });
  }

  const { user } = verifyAccessToken(token);

  if (!user) {
    return sendJson(res, 401, { error: "Nao autorizado" });
  }

  return sendJson(res, 200, user);
}

function handleLogout(_req, res) {
  const cookieOptions = [
    "conformix_auth=",
    "HttpOnly",
    "Path=/",
    "SameSite=Strict",
    "Priority=High",
    "Max-Age=0"
  ];

  if (process.env.VERCEL === "1" || process.env.COOKIE_SECURE === "true") {
    cookieOptions.push("Secure");
  }

  res.setHeader("Set-Cookie", cookieOptions.join("; "));
  return sendJson(res, 200, { success: true });
}

export async function handleAuthRoute(path, method, req, res) {
  const normalizedPath = String(path || "").replace(/^\/+|\/+$/g, "");
  const verb = String(method || "GET").toUpperCase();

  try {
    if (normalizedPath === "auth/login" && verb === "POST") {
      await handleLogin(req, res);
      return true;
    }

    if (normalizedPath === "auth/session" && verb === "POST") {
      await handleSession(req, res);
      return true;
    }

    if (normalizedPath === "auth/me" && verb === "GET") {
      await handleMe(req, res);
      return true;
    }

    if (normalizedPath === "auth/logout" && verb === "POST") {
      handleLogout(req, res);
      return true;
    }
  } catch (error) {
    console.error("Erro na rota de autenticacao:", error);

    if (error?.code === "AUTH_INVALID_CREDENTIALS") {
      sendJson(res, 401, { error: "Email ou senha invalidos" });
      return true;
    }

    if (error?.code === "AUTH_SERVICE_UNAVAILABLE") {
      sendJson(res, 503, {
        error: "Servico de autenticacao temporariamente indisponivel"
      });
      return true;
    }

    sendJson(res, 500, {
      error: "Nao foi possivel concluir a autenticacao",
      details: error?.message || "Erro interno"
    });
    return true;
  }

  return false;
}
