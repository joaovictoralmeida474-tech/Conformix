import express from "express";

import { auth } from "../../shared/middlewares/auth.js";
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory
} from "./categoryController.js";

const router = express.Router();

router.get("/", auth, listCategories);
router.post("/", auth, createCategory);
router.put("/:id", auth, updateCategory);
router.delete("/:id", auth, deleteCategory);

export default router;
