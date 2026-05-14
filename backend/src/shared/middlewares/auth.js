import jwt from "jsonwebtoken";

import { hasPermission, isAdminRole, normalizeRole } from "../auth/permissions.js";
import { getUserContextById } from "../auth/userContext.js";
import {
  getAuthCookieName,
  getJwtSecret,
  getRememberMeDurationMs,
  shouldUseSecureCookies
} from "../config/security.js";

function extractToken(authorization = "") {
  if (authorization.startsWith("Bearer ")) {
    return authorization.slice(7);
  }

  return authorization || null;
}

function parseCookies(cookieHeader = "") {
  return String(cookieHeader || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((accumulator, item) => {
      const separatorIndex = item.indexOf("=");
      if (separatorIndex <= 0) return accumulator;

      const key = item.slice(0, separatorIndex).trim();
      const value = item.slice(separatorIndex + 1).trim();
      accumulator[key] = decodeURIComponent(value);
      return accumulator;
    }, {});
}

function extractTokenFromRequest(req) {
  const headerToken = extractToken(req.headers.authorization);
  if (headerToken) return headerToken;

  const cookies = parseCookies(req.headers.cookie);
  return cookies[getAuthCookieName()] || null;
}

function signAccessToken(user) {
  const jwtSecret = getJwtSecret();

  return jwt.sign(
    {
      id: user.id,
      role: normalizeRole(user.role),
      userSnapshot: user
    },
    jwtSecret,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "8h"
    }
  );
}

export function setAuthCookie(res, token, rememberMe = false) {
  const cookieOptions = [
    `${getAuthCookieName()}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Strict",
    "Priority=High"
  ];

  if (shouldUseSecureCookies()) {
    cookieOptions.push("Secure");
  }

  if (rememberMe) {
    cookieOptions.push(`Max-Age=${Math.floor(getRememberMeDurationMs() / 1000)}`);
  }

  res.setHeader("Set-Cookie", cookieOptions.join("; "));
}

export function clearAuthCookie(res) {
  const cookieOptions = [
    `${getAuthCookieName()}=`,
    "HttpOnly",
    "Path=/",
    "SameSite=Strict",
    "Priority=High",
    "Max-Age=0"
  ];

  if (shouldUseSecureCookies()) {
    cookieOptions.push("Secure");
  }

  res.setHeader("Set-Cookie", cookieOptions.join("; "));
}

export async function auth(req, res, next) {
  const token = extractTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ error: "Nao autorizado" });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    const fallbackUser =
      decoded?.userSnapshot && typeof decoded.userSnapshot === "object"
        ? decoded.userSnapshot
        : null;
    let user = null;

    try {
      user = await getUserContextById(decoded.id);
    } catch (error) {
      if (!fallbackUser) {
        throw error;
      }
    }

    if (!user && fallbackUser) {
      user = fallbackUser;
    }

    if (!user) {
      return res.status(401).json({ error: "Nao autorizado" });
    }

    req.user = user;
    req.token = token;
    return next();
  } catch {
    return res.status(401).json({ error: "Nao autorizado" });
  }
}

export function requireRole(roles = []) {
  const normalizedRoles = Array.isArray(roles) ? roles.map((item) => normalizeRole(item)) : [];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Nao autorizado" });
    }

    if (!normalizedRoles.includes(normalizeRole(req.user.role))) {
      return res.status(403).json({ error: "Acesso negado" });
    }

    return next();
  };
}

export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Nao autorizado" });
    }

    if (!hasPermission(req.user, permission)) {
      return res.status(403).json({ error: "Sem permissao para executar esta acao" });
    }

    return next();
  };
}

export function isAdmin(req, res, next) {
  if (!isAdminRole(req.user?.role)) {
    return res.status(403).json({ error: "Acesso administrativo necessario" });
  }

  return next();
}

export { signAccessToken };
