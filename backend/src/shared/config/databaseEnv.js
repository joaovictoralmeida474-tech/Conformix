import "./loadEnv.js";

const DATABASE_ENV_KEYS = [
  "DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_URL_UNPOOLED",
  "SUPABASE_DATABASE_URL",
  "SUPABASE_DB_URL"
];

function isPostgresUrl(value) {
  return /^postgres(ql)?:\/\//i.test(String(value || "").trim());
}

function ensureSupabaseSslParams(url) {
  let normalized = String(url || "").trim();

  if (!normalized || !normalized.includes("supabase.com")) {
    return normalized;
  }

  if (!/sslmode=/i.test(normalized)) {
    normalized += normalized.includes("?") ? "&sslmode=require" : "?sslmode=require";
  }

  if (normalized.includes("pooler.supabase.com") && !/pgbouncer=/i.test(normalized)) {
    normalized += "&pgbouncer=true";
  }

  if (process.env.VERCEL === "1" && !/connection_limit=/i.test(normalized)) {
    normalized += "&connection_limit=1";
  }

  return normalized;
}

export function resolveDatabaseUrl() {
  const current = String(process.env.DATABASE_URL || "").trim();

  if (isPostgresUrl(current)) {
    process.env.DATABASE_URL = ensureSupabaseSslParams(current);
    return process.env.DATABASE_URL;
  }

  for (const key of DATABASE_ENV_KEYS) {
    const candidate = String(process.env[key] || "").trim();

    if (isPostgresUrl(candidate)) {
      process.env.DATABASE_URL = ensureSupabaseSslParams(candidate);
      return process.env.DATABASE_URL;
    }
  }

  return "";
}

export function isDatabaseConfigured() {
  return Boolean(resolveDatabaseUrl());
}
