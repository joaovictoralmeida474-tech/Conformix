import { sendJson } from "./http.mjs";
import { getTokenFromRequest, verifyAccessToken } from "./authToken.mjs";
import { hasPermission } from "../../backend/src/shared/auth/permissions.js";

export function withAuth(handler, options = {}) {
  const { permission = null } = options;

  return async function authHandler(req, res) {
    try {
      const token = getTokenFromRequest(req);

      if (!token) {
        return sendJson(res, 401, { error: "Nao autorizado" });
      }

      const { user } = verifyAccessToken(token);

      if (!user) {
        return sendJson(res, 401, { error: "Nao autorizado" });
      }

      if (permission && !hasPermission(user, permission)) {
        return sendJson(res, 403, { error: "Sem permissao para executar esta acao" });
      }

      req.user = user;
      return handler(req, res);
    } catch {
      return sendJson(res, 401, { error: "Nao autorizado" });
    }
  };
}
