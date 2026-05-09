import express from "express";

import { auth, requirePermission } from "../../shared/middlewares/auth.js";
import { PERMISSIONS } from "../../shared/auth/permissions.js";
import {
  createAdmin,
  createCompany,
  createDepartment,
  createUser,
  deleteAdmin,
  deleteUser,
  getAdminOverview,
  getSettings,
  listAdmins,
  listDepartments,
  listSystemLogs,
  listUsers,
  resetAdminPassword,
  resetUserPassword,
  setAdminStatus,
  setUserStatus,
  updateAdmin,
  updateDepartment,
  updateUser
} from "./adminController.js";

const router = express.Router();

router.use(auth, requirePermission(PERMISSIONS.ADMIN_ACCESS));

router.get("/overview", requirePermission(PERMISSIONS.ADMIN_DASHBOARD_VIEW), getAdminOverview);

router.get("/users", requirePermission(PERMISSIONS.USERS_VIEW), listUsers);
router.post("/users", requirePermission(PERMISSIONS.USERS_MANAGE), createUser);
router.put("/users/:id", requirePermission(PERMISSIONS.USERS_MANAGE), updateUser);
router.patch("/users/:id/status", requirePermission(PERMISSIONS.USERS_MANAGE), setUserStatus);
router.delete("/users/:id", requirePermission(PERMISSIONS.USERS_MANAGE), deleteUser);
router.post(
  "/users/:id/reset-password",
  requirePermission(PERMISSIONS.USERS_MANAGE),
  resetUserPassword
);

router.get("/admins", requirePermission(PERMISSIONS.ADMINS_VIEW), listAdmins);
router.post("/admins", requirePermission(PERMISSIONS.ADMINS_MANAGE), createAdmin);
router.put("/admins/:id", requirePermission(PERMISSIONS.ADMINS_MANAGE), updateAdmin);
router.patch("/admins/:id/status", requirePermission(PERMISSIONS.ADMINS_MANAGE), setAdminStatus);
router.delete("/admins/:id", requirePermission(PERMISSIONS.ADMINS_MANAGE), deleteAdmin);
router.post(
  "/admins/:id/reset-password",
  requirePermission(PERMISSIONS.ADMINS_MANAGE),
  resetAdminPassword
);

router.get("/departments", requirePermission(PERMISSIONS.DEPARTMENTS_VIEW), listDepartments);
router.post("/departments", requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE), createDepartment);
router.put("/departments/:id", requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE), updateDepartment);
router.post("/companies", requirePermission(PERMISSIONS.SETTINGS_VIEW), createCompany);

router.get("/settings", requirePermission(PERMISSIONS.ADMIN_ACCESS), getSettings);
router.get("/logs", requirePermission(PERMISSIONS.SYSTEM_LOGS_VIEW), listSystemLogs);

export default router;
