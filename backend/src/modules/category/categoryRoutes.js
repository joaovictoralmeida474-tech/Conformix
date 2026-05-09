import express from "express";

import { PERMISSIONS } from "../../shared/auth/permissions.js";
import { auth, requirePermission } from "../../shared/middlewares/auth.js";
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory
} from "./categoryController.js";

const router = express.Router();

router.get("/", auth, requirePermission(PERMISSIONS.CATEGORIES_VIEW), listCategories);
router.post("/", auth, requirePermission(PERMISSIONS.CATEGORIES_MANAGE), createCategory);
router.put("/:id", auth, requirePermission(PERMISSIONS.CATEGORIES_MANAGE), updateCategory);
router.delete("/:id", auth, requirePermission(PERMISSIONS.CATEGORIES_MANAGE), deleteCategory);

export default router;
