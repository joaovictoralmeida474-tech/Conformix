import jwt from "jsonwebtoken";

const FALLBACK_JWT_SECRET = "integraxx-vercel-fallback-jwt-secret-2026-secure-seed";
const AUTH_COOKIE_NAME = "integraxx_auth";
const LEGACY_AUTH_COOKIE_NAMES = ["conformix_auth", "integrax_auth"];

export function getJwtSecret() {
  const secret = String(process.env.JWT_SECRET || "").trim();

  if (!secret || secret.length < 32 || secret.toUpperCase() === "SECRET") {
    return FALLBACK_JWT_SECRET;
  }

  return secret;
}

function parseCookies(cookieHeader = "") {
  return String(cookieHeader || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((accumulator, item) => {
      const separatorIndex = item.indexOf("=");

      if (separatorIndex <= 0) {
        return accumulator;
      }

      const key = item.slice(0, separatorIndex).trim();
      const value = item.slice(separatorIndex + 1).trim();
      accumulator[key] = decodeURIComponent(value);
      return accumulator;
    }, {});
}

export function getTokenFromRequest(req) {
  const authorization = String(req.headers?.authorization || "");

  if (authorization.startsWith("Bearer ")) {
    return authorization.slice(7).trim();
  }

  const cookies = parseCookies(req.headers?.cookie);

  if (cookies[AUTH_COOKIE_NAME]) {
    return cookies[AUTH_COOKIE_NAME];
  }

  for (const legacyName of LEGACY_AUTH_COOKIE_NAMES) {
    if (cookies[legacyName]) {
      return cookies[legacyName];
    }
  }

  return null;
}

export function verifyAccessToken(token) {
  const decoded = jwt.verify(token, getJwtSecret());
  const user =
    decoded?.userSnapshot && typeof decoded.userSnapshot === "object"
      ? decoded.userSnapshot
      : null;

  return {
    decoded,
    user
  };
}

export { AUTH_COOKIE_NAME, LEGACY_AUTH_COOKIE_NAMES };
