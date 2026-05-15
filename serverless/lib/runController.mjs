import "../../backend/src/shared/config/loadEnv.js";
import { resolveDatabaseUrl } from "../../backend/src/shared/config/databaseEnv.js";

import { readJsonBody, sendJson } from "./http.mjs";

resolveDatabaseUrl();
import { hasPermission } from "../../backend/src/shared/auth/permissions.js";
import { createExpressRequest, createExpressResponse } from "./expressAdapter.mjs";
import { withAuth } from "./withAuth.mjs";

async function runController(req, res, controllerFn) {
  if (["POST", "PUT", "PATCH"].includes(String(req.method || "").toUpperCase())) {
    req.body = await readJsonBody(req);
  }

  const expressReq = createExpressRequest(req, { params: req.params || {} });
  const expressRes = createExpressResponse(res);

  try {
    await controllerFn(expressReq, expressRes);
  } catch (error) {
    console.error("Erro no controller serverless:", error);

    if (!res.writableEnded) {
      sendJson(res, 500, {
        error: error?.message || "Erro interno do servidor"
      });
    }
  }
}

export function createMethodRouteHandler(routeMap = {}) {
  return withAuth(async (req, res) => {
    const method = String(req.method || "GET").toUpperCase();
    const route = routeMap[method];

    if (!route) {
      return sendJson(res, 405, { error: "Metodo nao permitido" });
    }

    if (route.permission && !hasPermission(req.user, route.permission)) {
      return sendJson(res, 403, { error: "Sem permissao para executar esta acao" });
    }

    return runController(req, res, route.handler);
  });
}

export function createRouteHandler(controllerFn, options = {}) {
  const { method = null, permission = null } = options;

  return withAuth(async (req, res) => {
    if (method && String(req.method || "").toUpperCase() !== method) {
      return sendJson(res, 405, { error: "Metodo nao permitido" });
    }

    return runController(req, res, controllerFn);
  }, { permission });
}
