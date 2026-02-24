// User: Model level logic for the feature area.
import mongoose from "mongoose";
import { z } from "zod";
import { ORGANIZER_ACCOUNT_STATUSES } from "./constants.js";

const IIIT_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@(?:[a-zA-Z0-9-]+\.)*iiit\.ac\.in$/;

const objectIdSchema = z.string().refine(
  (val) => mongoose.Types.ObjectId.isValid(val),
  { message: "Invalid MongoDB ObjectId" }
);

// Interest - Areas of interest for participants
const interestSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  description: { type: String, trim: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });
const Interest = mongoose.model("Interest", interestSchema);

// OrganizationCategory - Category for clubs/organizers
const orgCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  description: { type: String, trim: true },
}, { timestamps: true });
const OrganizationCategory = mongoose.model("OrganizationCategory", orgCategorySchema);

// All users have email, password, role
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, trim: true, lowercase: true, unique: true },
  password: { type: String, required: true, select: false },
  role: {
    type: String,
    enum: ["IIIT_PARTICIPANT", "NON_IIIT_PARTICIPANT", "organizer", "admin"],
    required: true,
  },
}, { timestamps: true, discriminatorKey: "role" });
const User = mongoose.model("User", userSchema);

// Shared fields for all participants
const participantFields = {
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  contactNumber: { type: String, required: true, trim: true },
  collegeOrgName: { type: String, trim: true },
  interests: [{ type: mongoose.Schema.Types.ObjectId, ref: "Interest" }],
  followedClubs: [{ type: mongoose.Schema.Types.ObjectId, ref: "Organizer" }],
};

// IIIT Participant - Must use iiit email, batch optional
const iiitParticipantSchema = new mongoose.Schema({
  ...participantFields,
  batch: { type: String, trim: true },
});
const IIITParticipant = User.discriminator("IIIT_PARTICIPANT", iiitParticipantSchema);

const nonIiitParticipantSchema = new mongoose.Schema(participantFields);
const NonIIITParticipant = User.discriminator("NON_IIIT_PARTICIPANT", nonIiitParticipantSchema);

const organizerSchema = new mongoose.Schema({
  organizerName: { type: String, required: true, trim: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: "OrganizationCategory", required: true },
  description: { type: String, trim: true },
  contactNumber: { type: String, trim: true },
  discordWebhookUrl: { type: String, trim: true },
  accountStatus: {
    type: String,
    enum: ORGANIZER_ACCOUNT_STATUSES,
    default: "ACTIVE",
    required: true,
  },
  disabledAt: { type: Date, default: null },
  archivedAt: { type: Date, default: null },
  statusReason: { type: String, trim: true },
});
const Organizer = User.discriminator("organizer", organizerSchema);

const Admin = User.discriminator("admin", new mongoose.Schema({}));

const participantBaseSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  contactNumber: z.string().trim().min(6),
  password: z.string().min(6),
  interests: z.array(objectIdSchema).optional(),
  followedClubs: z.array(objectIdSchema).optional(),
});

const iiitZodSchema = participantBaseSchema.extend({
  participantType: z.literal("IIIT_PARTICIPANT"),
  email: z.string().regex(IIIT_EMAIL_REGEX, "Must be an IIIT email (@iiit.ac.in)"),
  batch: z.string().optional(),
  collegeOrgName: z.literal("IIIT Hyderabad").default("IIIT Hyderabad"),
});

const nonIiitZodSchema = participantBaseSchema.extend({
  participantType: z.literal("NON_IIIT_PARTICIPANT"),
  email: z.email("Valid email required"),
  collegeOrgName: z.string().min(1, "College/Organization Name is required"),
});

const participantZodSchema = z.discriminatedUnion("participantType", [iiitZodSchema, nonIiitZodSchema]);

const organizerZodSchema = z.object({
  role: z.literal("organizer"),
  email: z.email().trim(),
  password: z.string().min(6),
  organizerName: z.string().trim().min(1),
  contactNumber: z.string().trim().min(6).optional(),
  description: z.string().trim().optional(),
  category: objectIdSchema,
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export {
  User,
  IIITParticipant,
  NonIIITParticipant,
  Interest,
  OrganizationCategory,
  Organizer,
  Admin,
  participantZodSchema,
  organizerZodSchema,
  loginSchema,
};
