const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://localhost:4173",
  "http://127.0.0.1:4173"
];

const LOCALHOST_ORIGIN_PATTERN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;
const FALLBACK_JWT_SECRET = "conformix-vercel-fallback-jwt-secret-2026-secure-seed";

function normalizeBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function parseOrigins(value) {
  const items = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length ? items : DEFAULT_ALLOWED_ORIGINS;
}

export function getJwtSecret() {
  const secret = String(process.env.JWT_SECRET || "").trim();

  if (!secret || secret.length < 32 || secret.toUpperCase() === "SECRET") {
    if (process.env.VERCEL === "1") {
      console.warn(
        "Aviso: JWT_SECRET ausente ou invalido na Vercel. Usando fallback temporario para manter a aplicacao disponivel."
      );
      return FALLBACK_JWT_SECRET;
    }

    throw new Error(
      "JWT_SECRET invalido. Configure um segredo forte com pelo menos 32 caracteres."
    );
  }

  return secret;
}

function getVercelDeploymentOrigins() {
  const hosts = [
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL
  ]
    .map((value) =>
      String(value || "")
        .trim()
        .replace(/^https?:\/\//i, "")
        .replace(/\/$/, "")
    )
    .filter(Boolean);

  return [...new Set(hosts.map((host) => `https://${host}`))];
}

export function getAllowedCorsOrigins() {
  const configured = parseOrigins(process.env.CORS_ALLOWED_ORIGINS);
  const vercelOrigins = getVercelDeploymentOrigins();

  return [...new Set([...configured, ...vercelOrigins])];
}

function normalizeHost(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
}

function extractOriginHost(origin) {
  try {
    return normalizeHost(new URL(origin).host);
  } catch {
    return "";
  }
}

export function isAllowedCorsOrigin(origin, allowedOrigins = [], requestHost = "") {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (requestHost && extractOriginHost(origin) === normalizeHost(requestHost)) return true;
  return LOCALHOST_ORIGIN_PATTERN.test(origin);
}

export function isPublicRegistrationEnabled() {
  return normalizeBoolean(process.env.ALLOW_PUBLIC_REGISTRATION, false);
}

export function isBootstrapSeedEnabled() {
  return normalizeBoolean(process.env.ENABLE_BOOTSTRAP_SEED, false);
}

export function isDemoDataEnabled() {
  return normalizeBoolean(process.env.ENABLE_DEMO_DATA, false);
}

export function getMaxUploadSizeBytes() {
  const rawValue = Number(process.env.MAX_UPLOAD_SIZE_MB || 10);
  const megabytes = Number.isFinite(rawValue) && rawValue > 0 ? rawValue : 10;
  return Math.floor(megabytes * 1024 * 1024);
}

export function getAuthCookieName() {
  return "conformix_auth";
}

export function getRememberMeDurationMs() {
  const rawValue = Number(process.env.AUTH_REMEMBER_ME_DAYS || 7);
  const days = Number.isFinite(rawValue) && rawValue > 0 ? rawValue : 7;
  return Math.floor(days * 24 * 60 * 60 * 1000);
}

export function shouldUseSecureCookies() {
  if (process.env.VERCEL === "1") {
    return true;
  }

  return normalizeBoolean(process.env.COOKIE_SECURE, false);
}
