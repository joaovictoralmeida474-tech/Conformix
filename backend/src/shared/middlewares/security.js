import rateLimit from "express-rate-limit";

import { isPublicRegistrationEnabled } from "../config/security.js";

function isLocalRequest(req) {
  const forwardedFor = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const realIp = String(req.headers["x-real-ip"] || "").trim();
  const ip = forwardedFor || realIp || req.socket?.remoteAddress || "";
  const origin = String(req.headers.origin || "");

  return (
    ip === "::1" ||
    ip === "127.0.0.1" ||
    ip === "::ffff:127.0.0.1" ||
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:")
  );
}

function getClientIp(req) {
  const forwardedFor = String(req.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  const realIp = String(req.headers["x-real-ip"] || "").trim();

  return forwardedFor || realIp || req.socket?.remoteAddress || "unknown";
}

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV !== "production" && isLocalRequest(req),
  keyGenerator: (req) => getClientIp(req),
  validate: {
    trustProxy: false,
    xForwardedForHeader: false
  },
  message: {
    error: "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente."
  }
});

export function blockPublicRegistration(_, res, next) {
  if (isPublicRegistrationEnabled()) {
    return next();
  }

  return res.status(403).json({
    error: "Cadastro publico desabilitado. Solicite acesso ao administrador."
  });
}
