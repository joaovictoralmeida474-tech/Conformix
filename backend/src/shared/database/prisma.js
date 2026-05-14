import "../config/loadEnv.js";
import { PrismaClient } from "@prisma/client";

function ensureRuntimeDatabaseUrl() {
  const databaseUrl = String(process.env.DATABASE_URL || "").trim();

  if (databaseUrl) {
    return;
  }

  if (process.env.VERCEL === "1") {
    throw new Error(
      "DATABASE_URL nao configurada na Vercel. Use um banco PostgreSQL persistente para evitar perda de categorias, fornecedores e demais cadastros."
    );
  }

  throw new Error(
    "DATABASE_URL nao configurada. Defina a conexao do banco antes de iniciar a API."
  );
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
