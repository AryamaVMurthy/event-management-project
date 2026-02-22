// backend/routes/clubRoutes.js
import express from "express";
import { protect, restrictTo } from "../middleware/authMiddleware.js";
import {
  getAllCategories,
  createCategory,
  getAllClubs,
  getClubEventsPublic,
  createClub,
} from "../controllers/clubController.js";

const router = express.Router();

// Public routes
router.get("/categories/all", getAllCategories);
router.get("/", getAllClubs);
router.get("/:id/events", getClubEventsPublic);

// Admin-only routes
router.post("/categories", protect, restrictTo("admin"), createCategory);
router.post("/", protect, restrictTo("admin"), createClub);

export default router;
