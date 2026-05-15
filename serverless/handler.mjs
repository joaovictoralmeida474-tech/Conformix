import { handleAdminStatus } from "./adminStatus.mjs";
import { handleAuthRoute } from "./authRoutes.mjs";
import { rebuildApiUrl, resolveApiPath } from "./lib/resolveApiPath.mjs";

let cachedApp = null;
let cachedInitializeApp = null;

function prepareRequest(req) {
  const nextUrl = rebuildApiUrl(req);
  const method = String(req.method || "GET").toUpperCase();

  req.url = nextUrl;
  req.originalUrl = nextUrl;
  req.method = method;

  if (!req.headers.host && req.headers["x-forwarded-host"]) {
    req.headers.host = String(req.headers["x-forwarded-host"]);
  }
}

function runExpressApp(app, req, res) {
  return new Promise((resolve, reject) => {
    let settled = false;

    function finish() {
      if (settled) return;
      settled = true;
      resolve();
    }

    function fail(error) {
      if (settled) return;
      settled = true;
      reject(error);
    }

    res.once("finish", finish);
    res.once("close", finish);
    res.once("error", fail);

    try {
      app(req, res, (error) => {
        if (error) {
          fail(error);
          return;
        }

        if (!res.writableEnded) {
          finish();
        }
      });
    } catch (error) {
      fail(error);
    }
  });
}

async function loadApp() {
  if (!cachedApp) {
    const module = await import("../backend/src/app.js");
    cachedApp = module.default;
    cachedInitializeApp = module.initializeApp;
  }

  try {
    await cachedInitializeApp();
  } catch (error) {
    console.error("Aviso: inicializacao parcial da API:", error?.message || error);
  }

  return cachedApp;
}

export default async function handler(req, res) {
  try {
    prepareRequest(req);

    const path = resolveApiPath(req);
    const method = String(req.method || "GET").toUpperCase();

    if (await handleAuthRoute(path, method, req, res)) {
      return;
    }

    if (path === "admin/status" && method === "GET") {
      return handleAdminStatus(req, res);
    }

    await import("../backend/src/shared/config/loadEnv.js");
    const app = await loadApp();
    await runExpressApp(app, req, res);
  } catch (error) {
    console.error("Erro ao executar API no Vercel:", error);

    if (res.headersSent) {
      res.end();
      return;
    }

    return res.status(500).json({
      error: "Falha ao iniciar a API",
      details: error?.message || "Erro interno"
    });
  }
}
