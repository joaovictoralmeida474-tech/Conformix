import express from "express";

import { PERMISSIONS } from "../../shared/auth/permissions.js";
import { auth, requirePermission } from "../../shared/middlewares/auth.js";
import { getDashboard } from "./dashboardController.js";

const router = express.Router();

router.get("/", auth, requirePermission(PERMISSIONS.DASHBOARD_VIEW), getDashboard);

export default router;
