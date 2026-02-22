import { Event } from "../../../models/Event.js";
import { errors } from "../../../utils/Errors.js";
import {
  handleControllerError,
  isParticipantRole,
  getBaseEventSummary,
  appendBlockingStatusForEvent,
  isObjectId,
} from "../shared/index.js";

export const getEventDetails = async (req, res, next) => {
  try {
    if (!isParticipantRole(req.user.role)) {
      return next(errors.forbidden("Only participants can view event details"));
    }

    if (!isObjectId(req.params.id)) {
      return next(errors.badRequest("Invalid event id"));
    }

    const event = await Event.findById(req.params.id)
      .populate("organizerId", "organizerName email accountStatus")
      .lean();

    if (!event) {
      return next(errors.notFound("Event not found"));
    }

    if (event.status === "DRAFT") {
      return next(errors.notFound("Event not found"));
    }

    const organizerStatus = event.organizerId?.accountStatus || "ACTIVE";
    if (!event.organizerId || organizerStatus !== "ACTIVE") {
      return next(errors.notFound("Event not available"));
    }

    const status = await appendBlockingStatusForEvent(
      event,
      req.user._id,
      req.user.role
    );

    return res.status(200).json({
      event: {
        ...getBaseEventSummary(event),
        customFormSchema: event.customFormSchema || [],
        items: event.items || [],
        ...status,
      },
    });
  } catch (err) {
    return handleControllerError(err, next);
  }
};
