// backend/routes/interestRoutes.js
import express from "express";
import { protect, restrictTo } from "../middleware/authMiddleware.js";
import {
  getAllInterests,
  createInterest,
  updateInterest,
  deleteInterest
} from "../controllers/interestController.js";

const router = express.Router();

// Public routes
router.get("/", getAllInterests);

// Admin-only routes
router.post("/", protect, restrictTo("admin"), createInterest);
router.put("/:id", protect, restrictTo("admin"), updateInterest);
router.delete("/:id", protect, restrictTo("admin"), deleteInterest);

export default router;
