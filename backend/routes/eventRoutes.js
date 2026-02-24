// Event Routes: Route level logic for the feature area.
import express from "express";
import { protect, restrictTo } from "../middleware/authMiddleware.js";
import {
  uploadRegistrationFiles,
  uploadPaymentProof,
  handleUploadError,
} from "../middleware/uploadMiddleware.js";
import {
  listEvents,
  getEventDetails,
  registerForEvent,
  purchaseMerchandise,
  listRegistrationFiles,
  downloadRegistrationFile,
  uploadPaymentProof as uploadPaymentProofHandler,
  getPaymentProof,
  getOrganizerEvents,
  getOrganizerEventDetails,
  getOrganizerEventAnalytics,
  getOrganizerEventParticipants,
  scanAttendanceByQr,
  manualAttendanceOverride,
  getLiveAttendanceSummary,
  listMerchOrdersForOrganizerEvent,
  reviewMerchOrderForOrganizerEvent,
  updateParticipantAttendance,
  exportOrganizerEventParticipants,
  createEvent,
  updateEvent,
  deleteEvent,
  publishEvent,
  startEvent,
  closeEvent,
  completeEvent,
} from "../controllers/eventController.js";

const router = express.Router();

router.get(
  "/organizer/events",
  protect,
  restrictTo("organizer", "admin"),
  getOrganizerEvents
);
router.get(
  "/organizer/events/:id",
  protect,
  restrictTo("organizer", "admin"),
  getOrganizerEventDetails
);
router.get(
  "/organizer/events/:id/analytics",
  protect,
  restrictTo("organizer"),
  getOrganizerEventAnalytics
);
router.get(
  "/organizer/events/:id/participants",
  protect,
  restrictTo("organizer", "admin"),
  getOrganizerEventParticipants
);
router.get(
  "/organizer/events/:id/attendance/live",
  protect,
  restrictTo("organizer", "admin"),
  getLiveAttendanceSummary
);
router.post(
  "/organizer/events/:id/attendance/scan",
  protect,
  restrictTo("organizer", "admin"),
  scanAttendanceByQr
);
router.post(
  "/organizer/events/:id/attendance/override",
  protect,
  restrictTo("organizer", "admin"),
  manualAttendanceOverride
);
router.get(
  "/organizer/events/:id/merch-orders",
  protect,
  restrictTo("organizer", "admin"),
  listMerchOrdersForOrganizerEvent
);
router.patch(
  "/organizer/events/:id/merch-orders/:registrationId/review",
  protect,
  restrictTo("organizer", "admin"),
  reviewMerchOrderForOrganizerEvent
);
router.patch(
  "/organizer/events/:id/participants/:registrationId/attendance",
  protect,
  restrictTo("organizer"),
  updateParticipantAttendance
);
router.get(
  "/organizer/events/:id/participants/export",
  protect,
  restrictTo("organizer"),
  exportOrganizerEventParticipants
);

router.get(
  "/",
  protect,
  restrictTo("IIIT_PARTICIPANT", "NON_IIIT_PARTICIPANT"),
  listEvents
);
router.get(
  "/registrations/:registrationId/files",
  protect,
  listRegistrationFiles
);
router.get(
  "/registrations/:registrationId/payment-proof",
  protect,
  getPaymentProof
);
router.post(
  "/registrations/:registrationId/payment-proof",
  protect,
  restrictTo("IIIT_PARTICIPANT", "NON_IIIT_PARTICIPANT"),
  uploadPaymentProof,
  handleUploadError,
  uploadPaymentProofHandler
);
router.get(
  "/:id",
  protect,
  restrictTo("IIIT_PARTICIPANT", "NON_IIIT_PARTICIPANT"),
  getEventDetails
);
router.post(
  "/:id/register",
  protect,
  restrictTo("IIIT_PARTICIPANT", "NON_IIIT_PARTICIPANT"),
  uploadRegistrationFiles,
  handleUploadError,
  registerForEvent
);
router.get(
  "/files/:registrationId/:fieldId",
  protect,
  downloadRegistrationFile
);
router.post(
  "/:id/purchase",
  protect,
  restrictTo("IIIT_PARTICIPANT", "NON_IIIT_PARTICIPANT"),
  purchaseMerchandise
);

router.post("/", protect, restrictTo("organizer"), createEvent);
router.put("/:id", protect, restrictTo("organizer"), updateEvent);
router.delete("/:id", protect, restrictTo("organizer"), deleteEvent);
router.post("/:id/publish", protect, restrictTo("organizer"), publishEvent);
router.post("/:id/start", protect, restrictTo("organizer"), startEvent);
router.post("/:id/close", protect, restrictTo("organizer"), closeEvent);
router.post("/:id/complete", protect, restrictTo("organizer"), completeEvent);

export default router;
