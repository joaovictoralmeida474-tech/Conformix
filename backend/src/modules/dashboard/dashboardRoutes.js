import express from "express";

import { auth } from "../../shared/middlewares/auth.js";
import { getDashboard } from "./dashboardController.js";

const router = express.Router();

router.get("/", auth, getDashboard);

export default router;
