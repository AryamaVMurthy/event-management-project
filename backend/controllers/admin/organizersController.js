// Organizers Controller: Controller level logic for the feature area.
import { z } from "zod";
import { Organizer } from "../../models/User.js";
import { errors } from "../../utils/Errors.js";

const organizerStatusSchema = z.object({
  accountStatus: z.enum(["ACTIVE", "DISABLED", "ARCHIVED"]),
  statusReason: z.string().trim().optional(),
});

const objectIdSchema = z.string().trim().refine((value) => /^[a-fA-F0-9]{24}$/.test(value), {
  message: "Invalid id",
});

// Get Admin Organizers: Lists organizers with aggregate counts for admin oversight. Inputs: req, res, next. Returns: a Promise with payload data.
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

// Update Organizer Status: Approves, suspends, or updates organizer active status. Inputs: req, res, next. Returns: side effects and response to caller.
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

// Delete Organizer Permanent: Permanently removes organizer and related data. Inputs: req, res, next. Returns: side effects and response to caller.
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
