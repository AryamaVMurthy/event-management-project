import mongoose from "mongoose";
import { z } from "zod";
import { REGISTRATION_STATUSES } from "./constants.js";

const merchandisePurchaseSchema = new mongoose.Schema(
  {
    itemId: { type: String, trim: true },
    variantId: { type: String, trim: true },
    quantity: { type: Number, min: 1 },
    unitPrice: { type: Number, min: 0 },
    totalAmount: { type: Number, min: 0 },
  },
  { _id: false }
);

const registrationSchema = new mongoose.Schema(
  {
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
    status: {
      type: String,
      enum: REGISTRATION_STATUSES,
      default: "REGISTERED",
      required: true,
    },
    teamName: { type: String, trim: true },
    responses: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
    merchPurchase: { type: merchandisePurchaseSchema },
    attended: { type: Boolean, default: false },
    attendedAt: { type: Date, default: null },
    attendanceMarkedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    registeredAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

registrationSchema.index({ participantId: 1, eventId: 1 }, { unique: true });
registrationSchema.index({ eventId: 1, status: 1 });
registrationSchema.index({ participantId: 1, registeredAt: -1 });
registrationSchema.index({ status: 1, registeredAt: -1 });
registrationSchema.index({ eventId: 1, attended: 1 });

const Registration = mongoose.model("Registration", registrationSchema);

const objectIdSchema = z.string().refine(
  (val) => mongoose.Types.ObjectId.isValid(val),
  { message: "Invalid MongoDB ObjectId" }
);

const merchPurchaseZodSchema = z.object({
  itemId: z.string().trim().min(1),
  variantId: z.string().trim().min(1),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0),
  totalAmount: z.number().min(0),
});

const registrationZodSchema = z.object({
  participantId: objectIdSchema,
  eventId: objectIdSchema,
  status: z.enum(REGISTRATION_STATUSES).optional().default("REGISTERED"),
  teamName: z.string().trim().optional(),
  responses: z.record(z.string(), z.any()).optional(),
  merchPurchase: merchPurchaseZodSchema.optional(),
  attended: z.boolean().optional(),
  attendedAt: z.coerce.date().nullable().optional(),
  attendanceMarkedBy: objectIdSchema.optional(),
  registeredAt: z.coerce.date().optional(),
});

const createNormalRegistrationZodSchema = z.object({
  eventId: objectIdSchema,
  responses: z.record(z.string(), z.any()),
  teamName: z.string().trim().optional(),
});

const createMerchPurchaseZodSchema = z.object({
  eventId: objectIdSchema,
  itemId: z.string().trim().min(1),
  variantId: z.string().trim().min(1),
  quantity: z.number().int().min(1),
});

export {
  Registration,
  merchPurchaseZodSchema,
  registrationZodSchema,
  createNormalRegistrationZodSchema,
  createMerchPurchaseZodSchema,
};
