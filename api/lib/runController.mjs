import { readJsonBody, sendJson } from "./http.mjs";
import { createExpressRequest, createExpressResponse } from "./expressAdapter.mjs";
import { withAuth } from "./withAuth.mjs";

export function createRouteHandler(controllerFn, options = {}) {
  const { method = null, permission = null } = options;

  return withAuth(async (req, res) => {
    if (method && String(req.method || "").toUpperCase() !== method) {
      return sendJson(res, 405, { error: "Metodo nao permitido" });
    }

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
  }, { permission });
}
