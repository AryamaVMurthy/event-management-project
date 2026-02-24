// Lifecycle Controller: Controller level logic for the feature area.
import {
  Event,
  createEventZodSchema,
  updateEventZodSchema,
} from "../../../models/Event.js";
import { Registration } from "../../../models/Registration.js";
import { Organizer } from "../../../models/User.js";
import { errors } from "../../../utils/Errors.js";
import { postNewEventToDiscord } from "../../../utils/discordWebhook.js";
import {
  canEditFieldInPublished,
  handleControllerError,
  getEventOr404,
  assertOrganizerOwnsEvent,
  normalizeCreatePayload,
  normalizeUpdatePayload,
} from "../shared/index.js";

// Create Event: Creates event from input data. Inputs: req, res, next. Returns: side effects and response to caller.
export const createEvent = async (req, res, next) => {
  try {
    const payload = normalizeCreatePayload(req.body, req.user._id);
    const parsed = createEventZodSchema.parse(payload);
    const event = await Event.create(parsed);
    return res.status(201).json({ event });
  } catch (err) {
    return handleControllerError(err, next);
  }
};

// Update Event: Applies partial updates to event fields and persist them. Inputs: req, res, next. Returns: side effects and response to caller.
export const updateEvent = async (req, res, next) => {
  try {
    const event = await getEventOr404(req.params.id);
    assertOrganizerOwnsEvent(event, req.user._id);

    const payload = normalizeUpdatePayload(req.body);
    const parsed = updateEventZodSchema.parse(payload);

    if (event.status === "DRAFT") {
      Object.assign(event, parsed);
      await event.save();
      return res.status(200).json({ event });
    }

    if (event.status === "PUBLISHED") {
      const keys = Object.keys(parsed);
      const hasCustomFormSchemaChange = keys.includes("customFormSchema");
      const hasDisallowedField = keys.some((field) => {
        if (field === "customFormSchema") return false;
        return !canEditFieldInPublished.has(field);
      });
      if (hasDisallowedField) {
        return next(
          errors.forbidden(
            "Published events allow only description, deadline, registration limit, and tags updates"
          )
        );
      }

      if (
        parsed.registrationDeadline &&
        new Date(parsed.registrationDeadline) < new Date(event.registrationDeadline)
      ) {
        return next(
          errors.badRequest("You can only extend registration deadline")
        );
      }

      if (
        parsed.registrationLimit !== undefined &&
        parsed.registrationLimit < event.registrationLimit
      ) {
        return next(errors.badRequest("You can only increase registration limit"));
      }

      if (hasCustomFormSchemaChange) {
        const hasRegistrations = await Registration.exists({ eventId: event._id });
        if (hasRegistrations) {
          return next(errors.forbidden("Form schema is locked after first registration"));
        }
      }

      Object.assign(event, parsed);
      await event.save();
      return res.status(200).json({ event });
    }

    return next(
      errors.forbidden("Only DRAFT or PUBLISHED events can be edited")
    );
  } catch (err) {
    return handleControllerError(err, next);
  }
};

// Delete Event: Deletes event from persistent storage. Inputs: req, res, next. Returns: side effects and response to caller.
export const deleteEvent = async (req, res, next) => {
  try {
    const event = await getEventOr404(req.params.id);
    assertOrganizerOwnsEvent(event, req.user._id);

    if (event.status !== "DRAFT") {
      return next(errors.forbidden("Only DRAFT events can be deleted"));
    }

    await Event.findByIdAndDelete(event._id);
    return res.status(200).json({ message: "Event deleted" });
  } catch (err) {
    return handleControllerError(err, next);
  }
};

// Publish Event: Runs Publish event flow. Inputs: req, res, next. Returns: a function result.
export const publishEvent = async (req, res, next) => {
  try {
    const event = await getEventOr404(req.params.id);
    assertOrganizerOwnsEvent(event, req.user._id);

    if (event.status !== "DRAFT") {
      return next(errors.badRequest("Only DRAFT events can be published"));
    }

    const organizer = await Organizer.findById(req.user._id).lean();
    if (!organizer) {
      return next(errors.notFound("Organizer not found"));
    }

    if (organizer.discordWebhookUrl) {
      await postNewEventToDiscord({
        webhookUrl: organizer.discordWebhookUrl,
        organizerName: organizer.organizerName,
        event,
      });
    }

    event.status = "PUBLISHED";
    await event.save();

    return res.status(200).json({ event });
  } catch (err) {
    return handleControllerError(err, next);
  }
};

// Start Event: Starts event. Inputs: req, res, next. Returns: a function result.
export const startEvent = async (req, res, next) => {
  try {
    const event = await getEventOr404(req.params.id);
    assertOrganizerOwnsEvent(event, req.user._id);

    if (event.status !== "PUBLISHED") {
      return next(errors.badRequest("Only PUBLISHED events can be started"));
    }

    event.status = "ONGOING";
    await event.save();
    return res.status(200).json({ event });
  } catch (err) {
    return handleControllerError(err, next);
  }
};

// Close Event: Runs Close event flow. Inputs: req, res, next. Returns: a function result.
export const closeEvent = async (req, res, next) => {
  try {
    const event = await getEventOr404(req.params.id);
    assertOrganizerOwnsEvent(event, req.user._id);

    if (event.status !== "PUBLISHED" && event.status !== "ONGOING") {
      return next(
        errors.badRequest("Only PUBLISHED or ONGOING events can be closed")
      );
    }

    event.status = "CLOSED";
    await event.save();

    return res.status(200).json({ event });
  } catch (err) {
    return handleControllerError(err, next);
  }
};

// Complete Event: Runs Complete event flow. Inputs: req, res, next. Returns: a function result.
export const completeEvent = async (req, res, next) => {
  try {
    const event = await getEventOr404(req.params.id);
    assertOrganizerOwnsEvent(event, req.user._id);

    if (event.status !== "ONGOING" && event.status !== "CLOSED") {
      return next(
        errors.badRequest("Only ONGOING or CLOSED events can be completed")
      );
    }

    event.status = "COMPLETED";
    await event.save();

    return res.status(200).json({ event });
  } catch (err) {
    return handleControllerError(err, next);
  }
};
