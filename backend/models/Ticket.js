import mongoose from "mongoose";
import { z } from "zod";

const ticketSchema = new mongoose.Schema(
  {
    ticketId: { type: String, required: true, trim: true, unique: true },
    registrationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Registration",
      required: true,
      unique: true,
    },
    participantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    qrPayload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    issuedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ticketSchema.index({ participantId: 1, issuedAt: -1 });
ticketSchema.index({ eventId: 1 });

const Ticket = mongoose.model("Ticket", ticketSchema);

const objectIdSchema = z.string().refine(
  (val) => mongoose.Types.ObjectId.isValid(val),
  { message: "Invalid MongoDB ObjectId" }
);

const ticketZodSchema = z.object({
  ticketId: z.string().trim().min(1),
  registrationId: objectIdSchema,
  participantId: objectIdSchema,
  eventId: objectIdSchema,
  qrPayload: z.any(),
  issuedAt: z.coerce.date().optional(),
});

export { Ticket, ticketZodSchema };
