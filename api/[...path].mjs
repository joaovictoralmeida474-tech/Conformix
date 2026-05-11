import app, { initializeApp } from "../backend/src/app.js";

export default async function handler(req, res) {
  try {
    await initializeApp();
    return app(req, res);
  } catch (error) {
    console.error("Erro ao inicializar API no Vercel:", error);
    return res.status(500).json({
      error: "Falha ao iniciar a API",
      details: error?.message || "Erro interno"
    });
  }
}
