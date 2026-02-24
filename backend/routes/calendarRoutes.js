// Calendar Routes: Route level logic for the feature area.
import express from "express";
import { protect, restrictTo } from "../middleware/authMiddleware.js";
import {
  getRegistrationCalendarIcs,
  getRegistrationCalendarLinks,
  getMyEventsCalendarIcs,
} from "../controllers/calendarController.js";

const router = express.Router();

router.get(
  "/registrations/:registrationId.ics",
  protect,
  restrictTo("IIIT_PARTICIPANT", "NON_IIIT_PARTICIPANT"),
  getRegistrationCalendarIcs
);

router.get(
  "/registrations/:registrationId/links",
  protect,
  restrictTo("IIIT_PARTICIPANT", "NON_IIIT_PARTICIPANT"),
  getRegistrationCalendarLinks
);

router.get(
  "/my-events.ics",
  protect,
  restrictTo("IIIT_PARTICIPANT", "NON_IIIT_PARTICIPANT"),
  getMyEventsCalendarIcs
);

export default router;
