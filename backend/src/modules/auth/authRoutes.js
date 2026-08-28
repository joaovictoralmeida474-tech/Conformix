import express from "express";

import { auth } from "../../shared/middlewares/auth.js";
import { authRateLimiter, blockPublicRegistration } from "../../shared/middlewares/security.js";
import { login, logout, me, register, session } from "./authController.js";

const router = express.Router();

router.post("/login", authRateLimiter, login);
router.post("/session", authRateLimiter, session);
router.post("/logout", logout);
router.post("/register", authRateLimiter, blockPublicRegistration, register);
router.get("/me", auth, me);

export default router;
