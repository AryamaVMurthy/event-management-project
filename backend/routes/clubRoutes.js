// backend/routes/clubRoutes.js
import express from "express";
import { protect, restrictTo } from "../middleware/authMiddleware.js";
import {
  getAllCategories,
  createCategory,
  getAllClubs,
  getClubById,
  getClubEventsPublic,
  createClub,
  updateClub,
  deleteClub,
} from "../controllers/clubController.js";

const router = express.Router();

// Public routes
router.get("/categories/all", getAllCategories);
router.get("/", getAllClubs);
router.get("/:id/events", getClubEventsPublic);
router.get("/:id", getClubById);

// Admin-only routes
router.post("/categories", protect, restrictTo("admin"), createCategory);
router.post("/", protect, restrictTo("admin"), createClub);
router.put("/:id", protect, restrictTo("admin"), updateClub);
router.delete("/:id", protect, restrictTo("admin"), deleteClub);

export default router;
