import "./shared/config/loadEnv.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";

import routes from "./modules/index.js";
import { seedPlatform } from "./shared/database/seed.js";
import { ensurePlatformBootstrap } from "./shared/database/platformBootstrap.js";
import { getAllowedCorsOrigins, getJwtSecret, isAllowedCorsOrigin } from "./shared/config/security.js";

const app = express();
const port = Number(process.env.PORT || 3000);
const allowedOrigins = new Set(getAllowedCorsOrigins());
let startupPromise = null;

if (process.env.VERCEL === "1") {
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);
app.use(
  cors((req, callback) => {
    const requestHost = String(req.headers["x-forwarded-host"] || req.headers.host || "").trim();

    if (isAllowedCorsOrigin(req.headers.origin, [...allowedOrigins], requestHost)) {
      callback(null, {
        credentials: true,
        origin: true
      });
      return;
    }

    callback(new Error("Origem nao permitida pelo CORS"));
  })
);
app.use(express.json({ limit: "1mb" }));
app.use("/api", routes);

app.use((error, _req, res, _next) => {
  if (error?.message === "Origem nao permitida pelo CORS") {
    return res.status(403).json({ error: error.message });
  }

  if (error?.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "Arquivo excede o tamanho maximo permitido" });
  }

  if (Number.isInteger(error?.statusCode) && error?.statusCode >= 400 && error?.message) {
    return res.status(error.statusCode).json({ error: error.message });
  }

  console.error("Erro interno nao tratado:", error);
  return res.status(500).json({ error: "Erro interno do servidor" });
});

app.get("/health", (_, res) => {
  res.json({ status: "ok" });
});

export async function initializeApp() {
  if (!startupPromise) {
    startupPromise = (async () => {
      getJwtSecret();
      const databaseUrl = String(process.env.DATABASE_URL || "").trim();
      const hasPostgresUrl = /^postgres(ql)?:\/\//i.test(databaseUrl);

      if (!hasPostgresUrl) {
        console.warn("DATABASE_URL ausente. Login via Supabase permanece disponivel, mas cadastros exigem PostgreSQL.");
        return;
      }

      if (process.env.VERCEL === "1") {
        console.log("Vercel: preparando permissoes e estrutura minima do banco.");
        await ensurePlatformBootstrap();
        return;
      }

      await seedPlatform();
    })().catch((error) => {
      startupPromise = null;
      throw error;
    });
  }

  return startupPromise;
}

export default app;

if (process.env.VERCEL !== "1") {
  initializeApp()
    .then(() => {
      app.listen(port, () => {
        console.log(`API rodando na porta ${port}`);
      });
    })
    .catch((error) => {
      console.error("Erro ao iniciar API:", error);
      process.exit(1);
    });
}
