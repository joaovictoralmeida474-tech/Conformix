import express from "express";

import { auth, isAdmin } from "../../shared/middlewares/auth.js";
import { listAuditLogs } from "./auditController.js";

const router = express.Router();

router.get("/", auth, isAdmin, listAuditLogs);

export default router;
