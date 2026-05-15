import { isDatabaseConfigured, resolveDatabaseUrl } from "../config/databaseEnv.js";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

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
  const databaseUrl = resolveDatabaseUrl();

  if (!databaseUrl) {
    throw createDatabaseUrlError();
  }

  return new PrismaClient({
    log: process.env.VERCEL === "1" ? ["error"] : ["error", "warn"]
  });
}

function getPrismaClient() {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  const client = createPrismaClient();
  globalForPrisma.prisma = client;

  return client;
}

export { isDatabaseConfigured };

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
