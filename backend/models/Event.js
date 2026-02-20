import mongoose from "mongoose";
import { z } from "zod";
import {
  ELIGIBILITY_TYPES,
  EVENT_STATUSES,
  EVENT_TYPES,
  FORM_FIELD_TYPES,
} from "./constants.js";

const formFieldSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: FORM_FIELD_TYPES },
    label: { type: String, required: true, trim: true },
    required: { type: Boolean, default: false },
    options: { type: [{ type: String, trim: true }], default: [] },
    allowedMimeTypes: { type: [{ type: String, trim: true }], default: [] },
    maxFileSizeMB: { type: Number, min: 1, max: 25, default: 5 },
    order: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const variantSchema = new mongoose.Schema(
  {
    variantId: { type: String, required: true, trim: true },
    size: { type: String, trim: true },
    color: { type: String, trim: true },
    label: { type: String, required: true, trim: true },
    price: { type: Number, min: 0, default: 0 },
    stockQty: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const merchandiseItemSchema = new mongoose.Schema(
  {
    itemId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    purchaseLimitPerParticipant: { type: Number, required: true, min: 1 },
    variants: { type: [variantSchema], default: [] },
  },
  { _id: false }
);

const eventSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: EVENT_TYPES },
    eligibility: { type: String, required: true, enum: ELIGIBILITY_TYPES },
    registrationDeadline: { type: Date, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    registrationLimit: { type: Number, required: true, min: 1 },
    registrationFee: { type: Number, required: true, min: 0, default: 0 },
    organizerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tags: [{ type: String, trim: true }],
    status: { type: String, enum: EVENT_STATUSES, default: "DRAFT" },
    customFormSchema: { type: [formFieldSchema], default: [] },
    items: { type: [merchandiseItemSchema], default: [] },
  },
  { timestamps: true }
);

eventSchema.pre("validate", function validateEvent() {
  if (
    this.registrationDeadline &&
    this.startDate &&
    this.registrationDeadline > this.startDate
  ) {
    this.invalidate(
      "registrationDeadline",
      "Registration deadline must be before or equal to start date"
    );
  }

  if (this.startDate && this.endDate && this.startDate > this.endDate) {
    this.invalidate("startDate", "Event start date must be before or equal to end date");
  }

  if (this.type === "NORMAL") {
    if (Array.isArray(this.items) && this.items.length > 0) {
      this.invalidate("items", "NORMAL events cannot have merchandise items");
    }
    for (const field of this.customFormSchema || []) {
      const hasOptions = Array.isArray(field.options) && field.options.length > 0;
      if ((field.type === "text" || field.type === "file") && hasOptions) {
        this.invalidate("customFormSchema", `${field.type} fields cannot have options`);
        break;
      }
      if ((field.type === "checkbox" || field.type === "dropdown") && !hasOptions) {
        this.invalidate("customFormSchema", "Checkbox/Dropdown fields must have options");
        break;
      }
    }
  }

  if (this.type === "MERCHANDISE" && Array.isArray(this.customFormSchema) && this.customFormSchema.length > 0) {
    this.invalidate("customFormSchema", "MERCHANDISE events cannot have custom form schema");
  }
});

eventSchema.index({ organizerId: 1, status: 1 });
eventSchema.index({ startDate: 1 });
eventSchema.index({ type: 1, status: 1 });
eventSchema.index({ name: "text", tags: "text" });

const Event = mongoose.model("Event", eventSchema);

const objectIdSchema = z.string().refine(
  (val) => mongoose.Types.ObjectId.isValid(val),
  { message: "Invalid MongoDB ObjectId" }
);

const eventFormFieldZodSchema = z
  .object({
    id: z.string().trim().min(1),
    type: z.enum(FORM_FIELD_TYPES),
    label: z.string().trim().min(1),
    required: z.boolean().optional(),
    options: z.array(z.string().trim().min(1)).optional().default([]),
    allowedMimeTypes: z.array(z.string().trim().min(1)).optional().default([]),
    maxFileSizeMB: z.number().int().min(1).max(25).optional().default(5),
    order: z.number().int().min(0),
  })
  .superRefine((field, ctx) => {
    const hasOptions = Array.isArray(field.options) && field.options.length > 0;

    if ((field.type === "text" || field.type === "file") && hasOptions) {
      ctx.addIssue({
        code: z.custom,
        path: ["options"],
        message: `${field.type} fields cannot have options`,
      });
    }

    if ((field.type === "checkbox" || field.type === "dropdown") && !hasOptions) {
      ctx.addIssue({
        code: z.custom,
        path: ["options"],
        message: "Checkbox/Dropdown fields must have options",
      });
    }
  });

const eventMerchVariantZodSchema = z.object({
  variantId: z.string().trim().min(1),
  size: z.string().trim().optional(),
  color: z.string().trim().optional(),
  label: z.string().trim().min(1),
  price: z.number().min(0).optional().default(0),
  stockQty: z.number().int().min(0),
});

const eventMerchItemZodSchema = z.object({
  itemId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  purchaseLimitPerParticipant: z.number().int().min(1),
  variants: z.array(eventMerchVariantZodSchema).min(1),
});

const eventBaseZodSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
  type: z.enum(EVENT_TYPES),
  eligibility: z.enum(ELIGIBILITY_TYPES),
  registrationDeadline: z.coerce.date(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  registrationLimit: z.number().int().min(1),
  registrationFee: z.number().min(0),
  organizerId: objectIdSchema,
  tags: z.array(z.string().trim().min(1)).optional().default([]),
  status: z.enum(EVENT_STATUSES).optional().default("DRAFT"),
  customFormSchema: z.array(eventFormFieldZodSchema).optional().default([]),
  items: z.array(eventMerchItemZodSchema).optional().default([]),
});

const createEventZodSchema = eventBaseZodSchema.superRefine((event, ctx) => {
  if (event.registrationDeadline > event.startDate) {
    ctx.addIssue({
      code: z.custom,
      path: ["registrationDeadline"],
      message: "Registration deadline must be before or equal to start date",
    });
  }

  if (event.startDate > event.endDate) {
    ctx.addIssue({
      code: z.custom,
      path: ["startDate"],
      message: "Event start date must be before or equal to end date",
    });
  }

  if (event.type === "NORMAL" && event.items.length > 0) {
    ctx.addIssue({
      code: z.custom,
      path: ["items"],
      message: "NORMAL events cannot include merchandise items",
    });
  }

  if (event.type === "MERCHANDISE" && event.customFormSchema.length > 0) {
    ctx.addIssue({
      code: z.custom,
      path: ["customFormSchema"],
      message: "MERCHANDISE events cannot include custom form schema",
    });
  }
});

const updateEventZodSchema = eventBaseZodSchema.partial();

export {
  Event,
  eventFormFieldZodSchema,
  eventMerchVariantZodSchema,
  eventMerchItemZodSchema,
  createEventZodSchema,
  updateEventZodSchema,
};
