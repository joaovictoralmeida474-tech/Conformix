import express from "express";

import { PERMISSIONS } from "../../shared/auth/permissions.js";
import { auth, requirePermission } from "../../shared/middlewares/auth.js";
import { listRNC, updateRNC } from "./rncController.js";

const router = express.Router();

router.get("/", auth, requirePermission(PERMISSIONS.RNC_VIEW), listRNC);
router.put("/:id", auth, requirePermission(PERMISSIONS.RNC_MANAGE), updateRNC);

export default router;
