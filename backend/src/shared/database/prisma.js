import "../config/loadEnv.js";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

function hasDatabaseUrl() {
  return /^postgres(ql)?:\/\//i.test(String(process.env.DATABASE_URL || "").trim());
}

function createDatabaseUrlError() {
  if (process.env.VERCEL === "1") {
    return new Error(
      "DATABASE_URL nao configurada na Vercel. Configure PostgreSQL nas variaveis de ambiente do projeto."
    );
  }

  return new Error(
    "DATABASE_URL nao configurada. Defina a conexao do banco antes de iniciar a API."
  );
}

function createPrismaClient() {
  if (!hasDatabaseUrl()) {
    throw createDatabaseUrlError();
  }

  return new PrismaClient({
    log: ["error", "warn"]
  });
}

function getPrismaClient() {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  const client = createPrismaClient();

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }

  return client;
}

export function isDatabaseConfigured() {
  return hasDatabaseUrl();
}

export const prisma = new Proxy(
  {},
  {
    get(_target, property) {
      const client = getPrismaClient();
      const value = client[property];

      return typeof value === "function" ? value.bind(client) : value;
    }
  }
);
