import { readJsonBody, sendJson, setAuthCookie } from "../lib/http.mjs";
import { createSessionFromAccessToken } from "../lib/sessionCore.mjs";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Metodo nao permitido" });
  }

  try {
    const body = await readJsonBody(req);
    const accessToken = body?.accessToken || body?.access_token;
    const rememberMe = Boolean(body?.rememberMe);

    const result = await createSessionFromAccessToken(accessToken);
    setAuthCookie(res, result.token, rememberMe);
    return sendJson(res, 200, { user: result.user });
  } catch (error) {
    console.error("Erro ao criar sessao:", error);

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
