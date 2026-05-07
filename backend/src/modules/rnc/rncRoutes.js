import express from "express";

import { auth } from "../../shared/middlewares/auth.js";
import { listRNC, updateRNC } from "./rncController.js";

const router = express.Router();

router.get("/", auth, listRNC);
router.put("/:id", auth, updateRNC);

export default router;
