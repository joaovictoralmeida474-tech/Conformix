import express from "express";

import { PERMISSIONS } from "../../shared/auth/permissions.js";
import { auth, requirePermission } from "../../shared/middlewares/auth.js";
import { listAuditLogs } from "./auditController.js";

const router = express.Router();

router.get("/", auth, requirePermission(PERMISSIONS.AUDIT_VIEW), listAuditLogs);

export default router;
