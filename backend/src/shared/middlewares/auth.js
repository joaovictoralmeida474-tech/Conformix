import jwt from "jsonwebtoken";

import { hasPermission, isAdminRole, normalizeRole } from "../auth/permissions.js";
import { getUserContextById } from "../auth/userContext.js";
import { getJwtSecret } from "../config/security.js";

function extractToken(authorization = "") {
  if (authorization.startsWith("Bearer ")) {
    return authorization.slice(7);
  }

  return authorization || null;
}

function signAccessToken(user) {
  const jwtSecret = getJwtSecret();

  return jwt.sign(
    {
      id: user.id,
      role: normalizeRole(user.role)
    },
    jwtSecret,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "8h"
    }
  );
}

export async function auth(req, res, next) {
  const token = extractToken(req.headers.authorization);

  if (!token) {
    return res.status(401).json({ error: "Token nao informado" });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    const user = await getUserContextById(decoded.id);

    if (!user) {
      return res.status(401).json({ error: "Usuario nao encontrado ou inativo" });
    }

    req.user = user;
    req.token = token;
    return next();
  } catch {
    return res.status(403).json({ error: "Token invalido" });
  }
}

export function requireRole(roles = []) {
  const normalizedRoles = Array.isArray(roles) ? roles.map((item) => normalizeRole(item)) : [];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Usuario nao autenticado" });
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
      return res.status(401).json({ error: "Usuario nao autenticado" });
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
