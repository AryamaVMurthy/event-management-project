import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getMe,
  getMyEvents,
  updateProfile,
  updateInterests,
  updateFollowedClubs,
  changePassword
} from "../controllers/userController.js";

const router = express.Router();

// All routes require authentication (protect middleware)
router.get("/me", protect, getMe);
router.get("/my-events", protect, getMyEvents);
router.put("/profile", protect, updateProfile);
router.put("/interests", protect, updateInterests);
router.put("/followed-clubs", protect, updateFollowedClubs);
router.put("/password", protect, changePassword);

export default router;
