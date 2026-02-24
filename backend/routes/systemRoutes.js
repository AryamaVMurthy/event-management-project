// System Routes: Route level logic for the feature area.
import express from "express";
import { protect, restrictTo } from "../middleware/authMiddleware.js";
import { getEmailHealth } from "../controllers/systemController.js";

const router = express.Router();

router.get("/email-health", protect, restrictTo("admin"), getEmailHealth);

export default router;

