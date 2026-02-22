import express from "express";
import { protect, restrictTo } from "../middleware/authMiddleware.js";
import {
  getAdminCategories,
  getAdminOrganizers,
  updateOrganizerStatus,
  deleteOrganizerPermanent,
  createAdminPasswordResetRequest,
  getAdminPasswordResetRequests,
  reviewAdminPasswordResetRequest,
} from "../controllers/adminController.js";

const router = express.Router();

router.use(protect, restrictTo("admin"));

router.get("/categories", getAdminCategories);
router.get("/organizers", getAdminOrganizers);
router.patch("/organizers/:id/status", updateOrganizerStatus);
router.delete("/organizers/:id", deleteOrganizerPermanent);

router.post("/password-reset-requests", createAdminPasswordResetRequest);
router.get("/password-reset-requests", getAdminPasswordResetRequests);
router.patch(
  "/password-reset-requests/:id/review",
  reviewAdminPasswordResetRequest
);

export default router;
