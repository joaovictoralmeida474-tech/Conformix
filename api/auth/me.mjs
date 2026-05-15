import { sendJson } from "../lib/http.mjs";
import { getTokenFromRequest, verifyAccessToken } from "../lib/authToken.mjs";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Metodo nao permitido" });
  }

  try {
    const token = getTokenFromRequest(req);

    if (!token) {
      return sendJson(res, 401, { error: "Nao autorizado" });
    }

    const { user } = verifyAccessToken(token);

    if (!user) {
      return sendJson(res, 401, { error: "Nao autorizado" });
    }

    return sendJson(res, 200, user);
  } catch {
    return sendJson(res, 401, { error: "Nao autorizado" });
  }
}
