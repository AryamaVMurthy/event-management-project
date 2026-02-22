import {
  PasswordResetRequest,
  createPasswordResetRequestZodSchema,
} from "../../models/PasswordResetRequest.js";
import { errors } from "../../utils/Errors.js";

export const createOrganizerPasswordResetRequest = async (req, res, next) => {
  try {
    if (req.user.role !== "organizer") {
      return next(errors.forbidden("Only organizers can create password reset requests"));
    }

    const parsed = createPasswordResetRequestZodSchema.safeParse({
      organizerId: String(req.user._id),
      reason: req.body?.reason,
    });

    if (!parsed.success) {
      return next(errors.badRequest(parsed.error.issues?.[0]?.message || "Invalid payload"));
    }

    const existingPending = await PasswordResetRequest.findOne({
      organizerId: req.user._id,
      status: "PENDING",
    }).select("_id");

    if (existingPending) {
      return next(errors.conflict("A pending reset request already exists"));
    }

    const request = await PasswordResetRequest.create({
      organizerId: req.user._id,
      reason: parsed.data.reason,
      status: "PENDING",
    });

    await request.populate("organizerId", "organizerName email accountStatus");

    return res.status(201).json({
      message: "Password reset request submitted",
      request,
    });
  } catch (err) {
    return next(err);
  }
};

export const getOrganizerPasswordResetRequests = async (req, res, next) => {
  try {
    if (req.user.role !== "organizer") {
      return next(errors.forbidden("Only organizers can view password reset requests"));
    }

    const requests = await PasswordResetRequest.find({ organizerId: req.user._id })
      .populate("reviewedBy", "email role")
      .sort({ createdAt: -1 });

    return res.status(200).json({ requests });
  } catch (err) {
    return next(err);
  }
};
