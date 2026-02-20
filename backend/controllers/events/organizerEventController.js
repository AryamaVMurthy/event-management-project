import {
  Event,
  createEventZodSchema,
  updateEventZodSchema,
} from "../../models/Event.js";
import { Registration } from "../../models/Registration.js";
import { Organizer } from "../../models/User.js";
import { errors } from "../../utils/Errors.js";
import { postNewEventToDiscord } from "../../utils/discordWebhook.js";
import {
  canEditFieldInPublished,
  getEventOr404,
  assertOrganizerOwnsEvent,
  normalizeCreatePayload,
  normalizeUpdatePayload,
  handleControllerError,
  getOrganizerEventOr404,
  buildParticipantRows,
  toCsv,
} from "./eventShared.js";

// GET /api/events/organizer/events
export const getOrganizerEvents = async (req, res, next) => {
  try {
    const query = { organizerId: req.user._id };
    if (req.query.status) {
      query.status = String(req.query.status).trim();
    }
    if (req.query.q) {
      query.name = { $regex: String(req.query.q).trim(), $options: "i" };
    }

    const events = await Event.find(query)
      .sort({ createdAt: -1 })
      .lean();

    const eventsWithCounts = await Promise.all(
      events.map(async (event) => {
        const registrations = await Registration.find({ eventId: event._id }).lean();

        const registrationsCount = registrations.length;
        const attendanceCount = registrations.filter((reg) => reg.attended).length;
        const merchSalesCount = registrations.filter((reg) => reg.merchPurchase).length;
        const revenue = registrations.reduce((total, reg) => {
          if (reg.merchPurchase?.totalAmount !== undefined) {
            return total + Number(reg.merchPurchase.totalAmount || 0);
          }
          return total + Number(event.registrationFee || 0);
        }, 0);

        return {
          ...event,
          counts: {
            registrations: registrationsCount,
            merchSales: merchSalesCount,
            revenue,
            attendance: attendanceCount,
          },
        };
      })
    );

    const includeCompletedSummary = String(req.query.includeCompletedSummary || "false") === "true";
    const completedSummary = {
      registrations: 0,
      sales: 0,
      revenue: 0,
      attendance: 0,
    };

    if (includeCompletedSummary) {
      for (const event of eventsWithCounts) {
        if (event.status !== "COMPLETED") continue;
        completedSummary.registrations += Number(event.counts.registrations || 0);
        completedSummary.sales += Number(event.counts.merchSales || 0);
        completedSummary.revenue += Number(event.counts.revenue || 0);
        completedSummary.attendance += Number(event.counts.attendance || 0);
      }
    }

    return res.status(200).json({
      events: eventsWithCounts,
      completedSummary,
    });
  } catch (err) {
    return handleControllerError(err, next);
  }
};

// GET /api/events/organizer/events/:id
export const getOrganizerEventDetails = async (req, res, next) => {
  try {
    const event = await getOrganizerEventOr404(req.params.id, req.user._id);
    return res.status(200).json({ event });
  } catch (err) {
    return handleControllerError(err, next);
  }
};

// GET /api/events/organizer/events/:id/analytics
export const getOrganizerEventAnalytics = async (req, res, next) => {
  try {
    const event = await getOrganizerEventOr404(req.params.id, req.user._id);
    const registrations = await Registration.find({ eventId: event._id }).lean();

    const registrationsCount = registrations.length;
    const attendanceCount = registrations.filter((reg) => reg.attended).length;
    const merchSalesCount = registrations.filter((reg) => reg.merchPurchase).length;
    const revenue = registrations.reduce((total, reg) => {
      if (reg.merchPurchase?.totalAmount !== undefined) {
        return total + Number(reg.merchPurchase.totalAmount || 0);
      }
      return total + Number(event.registrationFee || 0);
    }, 0);

    const byStatus = {
      REGISTERED: 0,
      CANCELLED: 0,
      REJECTED: 0,
      COMPLETED: 0,
    };
    let teamCompletionCount = 0;
    registrations.forEach((reg) => {
      if (byStatus[reg.status] !== undefined) {
        byStatus[reg.status] += 1;
      }
      if (reg.teamName && reg.status === "COMPLETED") {
        teamCompletionCount += 1;
      }
    });

    const teamCompletionRate =
      registrationsCount === 0 ? 0 : Number(((teamCompletionCount / registrationsCount) * 100).toFixed(2));

    return res.status(200).json({
      analytics: {
        registrations: registrationsCount,
        merchSales: merchSalesCount,
        revenue,
        attendance: attendanceCount,
        byStatus,
        teamCompletionCount,
        teamCompletionRate,
      },
    });
  } catch (err) {
    return handleControllerError(err, next);
  }
};

// GET /api/events/organizer/events/:id/participants
export const getOrganizerEventParticipants = async (req, res, next) => {
  try {
    const event = await getOrganizerEventOr404(req.params.id, req.user._id);
    const rows = await buildParticipantRows(event, req.query);
    return res.status(200).json({ participants: rows });
  } catch (err) {
    return handleControllerError(err, next);
  }
};

// PATCH /api/events/organizer/events/:id/participants/:registrationId/attendance
export const updateParticipantAttendance = async (req, res, next) => {
  try {
    await getOrganizerEventOr404(req.params.id, req.user._id);

    const registration = await Registration.findOne({
      _id: req.params.registrationId,
      eventId: req.params.id,
    });

    if (!registration) {
      return next(errors.notFound("Registration not found for this event"));
    }

    const { attended } = req.body;
    if (typeof attended !== "boolean") {
      return next(errors.badRequest("attended must be true or false"));
    }

    registration.attended = attended;
    registration.attendedAt = attended ? new Date() : null;
    registration.attendanceMarkedBy = attended ? req.user._id : null;
    await registration.save();

    return res.status(200).json({
      message: "Attendance updated",
      registration: {
        id: String(registration._id),
        attended: registration.attended,
        attendedAt: registration.attendedAt,
      },
    });
  } catch (err) {
    return handleControllerError(err, next);
  }
};

// GET /api/events/organizer/events/:id/participants/export
export const exportOrganizerEventParticipants = async (req, res, next) => {
  try {
    const event = await getOrganizerEventOr404(req.params.id, req.user._id);
    const rows = await buildParticipantRows(event, req.query);

    const headers = [
      "Participant Name",
      "Email",
      "Registration Date",
      "Status",
      "Team Name",
      "Payment Amount",
      "Attendance",
      "Ticket ID",
    ];

    const csvRows = rows.map((row) => [
      row.participantName,
      row.email,
      row.registeredAt ? new Date(row.registeredAt).toISOString() : "",
      row.participationStatus,
      row.teamName || "",
      row.paymentAmount,
      row.attended ? "Present" : "Absent",
      row.ticketId || "",
    ]);

    const csv = toCsv(headers, csvRows);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="event-${String(event._id)}-participants.csv"`
    );
    return res.status(200).send(csv);
  } catch (err) {
    return handleControllerError(err, next);
  }
};

// POST /api/events
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

// PUT /api/events/:id
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

// DELETE /api/events/:id
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

// POST /api/events/:id/publish
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

// POST /api/events/:id/start
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

// POST /api/events/:id/close
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

// POST /api/events/:id/complete
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
