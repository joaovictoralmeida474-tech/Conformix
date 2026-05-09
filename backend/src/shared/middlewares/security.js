import rateLimit from "express-rate-limit";

import { isPublicRegistrationEnabled } from "../config/security.js";

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
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
