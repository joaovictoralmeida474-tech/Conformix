function rebuildApiUrl(req) {
  const originalPath = String(req.query?.path || "").replace(/^\/+/, "");
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(req.query || {})) {
    if (key === "path") continue;

    if (Array.isArray(value)) {
      value.forEach((item) => searchParams.append(key, item));
      continue;
    }

    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  }

  const queryString = searchParams.toString();
  return `/api/${originalPath}${queryString ? `?${queryString}` : ""}`;
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

export default async function handler(req, res) {
  try {
    const { default: app, initializeApp } = await import("../backend/src/app.js");
    await initializeApp();
    req.url = rebuildApiUrl(req);
    await runExpressApp(app, req, res);
    return;
  } catch (error) {
    console.error("Erro ao inicializar API no Vercel:", error);

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
