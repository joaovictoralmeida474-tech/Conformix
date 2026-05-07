import "dotenv/config";
import express from "express";
import cors from "cors";

import routes from "./modules/index.js";
import { seedPlatform } from "./shared/database/seed.js";

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json());
app.use("/api", routes);

app.get("/health", (_, res) => {
  res.json({ status: "ok" });
});

async function start() {
  await seedPlatform();

  app.listen(port, () => {
    console.log(`API rodando na porta ${port}`);
  });
}

start().catch((error) => {
  console.error("Erro ao iniciar API:", error);
  process.exit(1);
});
