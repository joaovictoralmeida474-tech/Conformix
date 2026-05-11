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

export default async function handler(req, res) {
  try {
    const { default: app, initializeApp } = await import("../backend/src/app.js");
    await initializeApp();
    req.url = rebuildApiUrl(req);
    return app(req, res);
  } catch (error) {
    console.error("Erro ao inicializar API no Vercel:", error);
    return res.status(500).json({
      error: "Falha ao iniciar a API",
      details: error?.message || "Erro interno"
    });
  }
}
