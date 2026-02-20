import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { getTicketById } from "../controllers/ticketController.js";

const router = express.Router();

router.get("/:ticketId", protect, getTicketById);

export default router;
