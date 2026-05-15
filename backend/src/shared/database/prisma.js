import { isSupabaseDataConfigured } from "../config/supabaseEnv.js";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

function createPrismaClient() {
  const databaseUrl = String(
    process.env.SUPABASE_POSTGRES_PRISMA_URL ||
      process.env.POSTGRES_PRISMA_URL ||
      process.env.POSTGRES_URL ||
      ""
  ).trim();

  if (!databaseUrl) {
    throw new Error(
      "Prisma local indisponivel. O runtime em producao usa Supabase (SUPABASE_URL + SUPABASE_ANON_KEY)."
    );
  }

  return new PrismaClient({
    log: process.env.VERCEL === "1" ? ["error"] : ["error", "warn"],
    datasources: {
      db: {
        url: databaseUrl
      }
    }
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

export function isDatabaseConfigured() {
  return isSupabaseDataConfigured();
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
