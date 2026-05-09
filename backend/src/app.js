import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";

import routes from "./modules/index.js";
import { seedPlatform } from "./shared/database/seed.js";
import { getAllowedCorsOrigins, getJwtSecret, isAllowedCorsOrigin } from "./shared/config/security.js";

const app = express();
const port = Number(process.env.PORT || 3000);
const allowedOrigins = new Set(getAllowedCorsOrigins());

app.disable("x-powered-by");
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);
app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (isAllowedCorsOrigin(origin, [...allowedOrigins])) {
        callback(null, true);
        return;
      }

      callback(new Error("Origem nao permitida pelo CORS"));
    }
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

async function start() {
  try {
    getJwtSecret();
    await seedPlatform();
  } catch (error) {
    console.error("Falha ao validar seguranca inicial:", error.message);
    process.exit(1);
  }

  app.listen(port, () => {
    console.log(`API rodando na porta ${port}`);
  });
}

start().catch((error) => {
  console.error("Erro ao iniciar API:", error);
  process.exit(1);
});
