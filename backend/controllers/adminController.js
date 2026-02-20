import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  Organizer,
  OrganizationCategory,
} from "../models/User.js";
import {
  PasswordResetRequest,
  createPasswordResetRequestZodSchema,
  reviewPasswordResetRequestZodSchema,
} from "../models/PasswordResetRequest.js";
import { errors } from "../utils/Errors.js";

const organizerStatusSchema = z.object({
  accountStatus: z.enum(["ACTIVE", "DISABLED", "ARCHIVED"]),
  statusReason: z.string().trim().optional(),
});

const objectIdSchema = z.string().trim().refine((value) => /^[a-fA-F0-9]{24}$/.test(value), {
  message: "Invalid id",
});

const generateRandomPassword = () =>
  String(Math.floor(100000 + Math.random() * 900000));

// GET /api/admin/organizers
export const getAdminOrganizers = async (req, res, next) => {
  try {
    const statusFilter = String(req.query.status || "ALL").toUpperCase();
    const q = String(req.query.q || "").trim();

    const query = {};
    if (statusFilter !== "ALL") {
      if (!["ACTIVE", "DISABLED", "ARCHIVED"].includes(statusFilter)) {
        return next(errors.badRequest("Invalid status filter"));
      }
      query.accountStatus = statusFilter;
    }

    if (q) {
      query.$or = [
        { organizerName: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ];
    }

    const organizers = await Organizer.find(query)
      .populate("category", "name description")
      .sort({ createdAt: -1 });

    return res.status(200).json({ organizers });
  } catch (err) {
    return next(err);
  }
};

// PATCH /api/admin/organizers/:id/status
export const updateOrganizerStatus = async (req, res, next) => {
  try {
    if (!objectIdSchema.safeParse(req.params.id).success) {
      return next(errors.badRequest("Invalid organizer id"));
    }

    const parsed = organizerStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(errors.badRequest(parsed.error.issues?.[0]?.message || "Invalid payload"));
    }

    const organizer = await Organizer.findById(req.params.id);
    if (!organizer) {
      return next(errors.notFound("Organizer not found"));
    }

    organizer.accountStatus = parsed.data.accountStatus;
    organizer.statusReason = parsed.data.statusReason || "";

    if (parsed.data.accountStatus === "DISABLED") {
      organizer.disabledAt = new Date();
      organizer.archivedAt = null;
    } else if (parsed.data.accountStatus === "ARCHIVED") {
      organizer.archivedAt = new Date();
      organizer.disabledAt = null;
    } else {
      organizer.disabledAt = null;
      organizer.archivedAt = null;
      organizer.statusReason = "";
    }

    await organizer.save();
    await organizer.populate("category", "name description");

    return res.status(200).json({
      message: "Organizer status updated",
      organizer,
    });
  } catch (err) {
    return next(err);
  }
};

// DELETE /api/admin/organizers/:id
export const deleteOrganizerPermanent = async (req, res, next) => {
  try {
    if (!objectIdSchema.safeParse(req.params.id).success) {
      return next(errors.badRequest("Invalid organizer id"));
    }

    const organizer = await Organizer.findByIdAndDelete(req.params.id);
    if (!organizer) {
      return next(errors.notFound("Organizer not found"));
    }

    return res.status(200).json({ message: "Organizer deleted permanently" });
  } catch (err) {
    return next(err);
  }
};

// POST /api/admin/password-reset-requests
export const createAdminPasswordResetRequest = async (req, res, next) => {
  try {
    const parsed = createPasswordResetRequestZodSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(errors.badRequest(parsed.error.issues?.[0]?.message || "Invalid payload"));
    }

    const organizer = await Organizer.findById(parsed.data.organizerId);
    if (!organizer) {
      return next(errors.notFound("Organizer not found"));
    }

    const request = await PasswordResetRequest.create({
      organizerId: organizer._id,
      reason: parsed.data.reason,
      status: "PENDING",
    });

    await request.populate("organizerId", "organizerName email accountStatus");

    return res.status(201).json({
      message: "Password reset request created",
      request,
    });
  } catch (err) {
    return next(err);
  }
};

// GET /api/admin/password-reset-requests
export const getAdminPasswordResetRequests = async (req, res, next) => {
  try {
    const statusFilter = String(req.query.status || "ALL").toUpperCase();
    const query = {};
    if (statusFilter !== "ALL") {
      if (!["PENDING", "APPROVED", "REJECTED"].includes(statusFilter)) {
        return next(errors.badRequest("Invalid status filter"));
      }
      query.status = statusFilter;
    }

    const requests = await PasswordResetRequest.find(query)
      .populate("organizerId", "organizerName email accountStatus")
      .populate("reviewedBy", "email role")
      .sort({ createdAt: -1 });

    return res.status(200).json({ requests });
  } catch (err) {
    return next(err);
  }
};

// PATCH /api/admin/password-reset-requests/:id/review
export const reviewAdminPasswordResetRequest = async (req, res, next) => {
  try {
    if (!objectIdSchema.safeParse(req.params.id).success) {
      return next(errors.badRequest("Invalid request id"));
    }

    const parsed = reviewPasswordResetRequestZodSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(errors.badRequest(parsed.error.issues?.[0]?.message || "Invalid payload"));
    }

    const request = await PasswordResetRequest.findById(req.params.id).populate(
      "organizerId",
      "email organizerName"
    );

    if (!request) {
      return next(errors.notFound("Password reset request not found"));
    }

    if (request.status !== "PENDING") {
      return next(errors.conflict("This request has already been reviewed"));
    }

    request.status = parsed.data.status;
    request.adminComment = parsed.data.adminComment || "";
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();

    let generatedCredentials = null;

    if (parsed.data.status === "APPROVED") {
      const organizer = await Organizer.findById(request.organizerId._id).select("+password");
      if (!organizer) {
        return next(errors.notFound("Organizer not found"));
      }

      const tempPassword = generateRandomPassword();
      const tempPasswordHash = await bcrypt.hash(tempPassword, 10);

      organizer.password = tempPasswordHash;
      await organizer.save();

      request.generatedTempPasswordHash = tempPasswordHash;
      generatedCredentials = {
        email: organizer.email,
        password: tempPassword,
      };
    }

    await request.save();
    await request.populate("reviewedBy", "email role");

    return res.status(200).json({
      message:
        parsed.data.status === "APPROVED"
          ? "Password reset approved"
          : "Password reset rejected",
      request,
      ...(generatedCredentials ? { generatedCredentials } : {}),
    });
  } catch (err) {
    return next(err);
  }
};

// GET /api/admin/categories
export const getAdminCategories = async (req, res, next) => {
  try {
    const categories = await OrganizationCategory.find().sort({ name: 1 });
    return res.status(200).json({ categories });
  } catch (err) {
    return next(err);
  }
};
