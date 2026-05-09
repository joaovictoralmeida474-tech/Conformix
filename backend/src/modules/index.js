import express from "express";

import authRoutes from "./auth/authRoutes.js";
import adminRoutes from "./admin/adminRoutes.js";
import supplierRoutes from "./supplier/supplierRoutes.js";
import categoryRoutes from "./category/categoryRoutes.js";
import rncRoutes from "./rnc/rncRoutes.js";
import dashboardRoutes from "./dashboard/dashboardRoutes.js";
import auditRoutes from "./audit/auditRoutes.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);
router.use("/suppliers", supplierRoutes);
router.use("/categories", categoryRoutes);
router.use("/rnc", rncRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/audit", auditRoutes);

export default router;
