import mongoose from "mongoose";
import { z } from "zod";
import { PASSWORD_RESET_STATUSES } from "./constants.js";

const passwordResetRequestSchema = new mongoose.Schema(
  {
    organizerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    requestedAt: { type: Date, default: Date.now, required: true },
    reason: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: PASSWORD_RESET_STATUSES,
      default: "PENDING",
      required: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: { type: Date, default: null },
    adminComment: { type: String, trim: true },
    generatedTempPasswordHash: { type: String, select: false },
  },
  { timestamps: true }
);

passwordResetRequestSchema.index({ organizerId: 1, requestedAt: -1 });
passwordResetRequestSchema.index({ status: 1, requestedAt: -1 });

const PasswordResetRequest = mongoose.model(
  "PasswordResetRequest",
  passwordResetRequestSchema
);

const objectIdSchema = z.string().refine(
  (val) => mongoose.Types.ObjectId.isValid(val),
  { message: "Invalid MongoDB ObjectId" }
);

const createPasswordResetRequestZodSchema = z.object({
  organizerId: objectIdSchema,
  reason: z.string().trim().min(1),
});

const reviewPasswordResetRequestZodSchema = z.object({
  status: z.enum(PASSWORD_RESET_STATUSES),
  adminComment: z.string().trim().optional(),
});

const passwordResetRequestZodSchema = z.object({
  organizerId: objectIdSchema,
  requestedAt: z.coerce.date().optional(),
  reason: z.string().trim().min(1),
  status: z.enum(PASSWORD_RESET_STATUSES).optional().default("PENDING"),
  reviewedBy: objectIdSchema.optional(),
  reviewedAt: z.coerce.date().optional(),
  adminComment: z.string().trim().optional(),
  generatedTempPasswordHash: z.string().min(1).optional(),
});

export {
  PasswordResetRequest,
  createPasswordResetRequestZodSchema,
  reviewPasswordResetRequestZodSchema,
  passwordResetRequestZodSchema,
};
