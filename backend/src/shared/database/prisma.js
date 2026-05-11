import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function ensureRuntimeDatabaseUrl() {
  if (String(process.env.DATABASE_URL || "").trim()) {
    return;
  }

  if (process.env.VERCEL !== "1") {
    return;
  }

  const runtimeDbPath = "/tmp/conformix-runtime.db";
  const seedDbPath = path.resolve(__dirname, "../../../prisma/dev.db");

  try {
    if (!fs.existsSync(runtimeDbPath) && fs.existsSync(seedDbPath)) {
      fs.copyFileSync(seedDbPath, runtimeDbPath);
    }
  } catch (error) {
    console.error("Falha ao preparar banco SQLite temporario na Vercel:", error);
  }

  process.env.DATABASE_URL = `file:${runtimeDbPath}`;
}

ensureRuntimeDatabaseUrl();

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["error", "warn"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
