import * as authService from "./authService.js";
import { clearAuthCookie, setAuthCookie } from "../../shared/middlewares/auth.js";

function applyNoStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}

function sendSafeAuthError(res, error) {
  console.error("Erro de autenticacao:", error);

  if (error?.code === "AUTH_INVALID_CREDENTIALS") {
    return res.status(401).json({ error: "Email ou senha invalidos" });
  }

  if (error?.code === "AUTH_USER_INACTIVE") {
    return res.status(403).json({ error: "Usuario desativado. Entre em contato com o administrador." });
  }

  if (error?.code === "AUTH_RATE_LIMIT") {
    return res.status(429).json({ error: "Muitas tentativas. Tente novamente em alguns minutos." });
  }

  if (error?.code === "AUTH_SERVICE_UNAVAILABLE") {
    return res.status(503).json({
      error: "Servico de autenticacao temporariamente indisponivel"
    });
  }

  return res.status(400).json({ error: "Nao foi possivel concluir a autenticacao" });
}

export async function register(req, res) {
  try {
    applyNoStore(res);
    const result = await authService.register(req.body);
    setAuthCookie(res, result.token, Boolean(req.body?.rememberMe));
    res.status(201).json({ user: result.user });
  } catch (error) {
    applyNoStore(res);
    sendSafeAuthError(res, error);
  }
}

export async function login(req, res) {
  try {
    applyNoStore(res);
    const result = await authService.login(req.body);
    setAuthCookie(res, result.token, Boolean(req.body?.rememberMe));
    res.json({ user: result.user });
  } catch (error) {
    applyNoStore(res);
    sendSafeAuthError(res, error);
  }
}

export async function me(req, res) {
  try {
    applyNoStore(res);
    res.json(req.user);
  } catch (error) {
    applyNoStore(res);
    res.status(401).json({ error: "Nao autorizado" });
  }
}

export async function logout(_req, res) {
  applyNoStore(res);
  clearAuthCookie(res);
  res.json({ success: true });
}
