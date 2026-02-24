// Events Controller: Controller level logic for the feature area.
import { Registration } from "../../models/Registration.js";
import { Ticket } from "../../models/Ticket.js";
import { errors } from "../../utils/Errors.js";

// Get My Events: Loads a participant-facing upcoming and past event payload. Inputs: req, res, next. Returns: a Promise with payload data.
export const getMyEvents = async (req, res, next) => {
  try {
    const isParticipant =
      req.user.role === "IIIT_PARTICIPANT" || req.user.role === "NON_IIIT_PARTICIPANT";

    if (!isParticipant) {
      return next(errors.forbidden("Only participants can access my events"));
    }

    const registrations = await Registration.find({ participantId: req.user._id })
      .populate({
        path: "eventId",
        select: "name type organizerId startDate endDate",
        populate: {
          path: "organizerId",
          select: "organizerName email",
        },
      })
      .sort({ registeredAt: -1 })
      .lean();

    const registrationIds = registrations.map((registration) => registration._id);

    const tickets = registrationIds.length
      ? await Ticket.find({ registrationId: { $in: registrationIds } })
          .select("registrationId ticketId")
          .lean()
      : [];

    const ticketMap = new Map(
      tickets.map((ticket) => [String(ticket.registrationId), ticket.ticketId])
    );

    const now = new Date();

    const records = registrations.map((registration) => {
      const event = registration.eventId;
      const organizer = event?.organizerId;

      return {
        registrationId: String(registration._id),
        eventId: event?._id ? String(event._id) : null,
        eventName: event?.name ?? null,
        eventType: event?.type || null,
        organizerName: organizer?.organizerName ?? organizer?.email ?? null,
        schedule: {
          startDate: event?.startDate || null,
          endDate: event?.endDate || null,
        },
        participationStatus: registration.status,
        teamName: registration.teamName || null,
        ticketId: ticketMap.get(String(registration._id)) || null,
        registeredAt: registration.registeredAt,
      };
    });

    const upcomingEvents = records.filter((record) => {
      if (record.participationStatus !== "REGISTERED" || !record.schedule.startDate) {
        return false;
      }
      return new Date(record.schedule.startDate) > now;
    });

    const historyRows = records.filter((record) => !upcomingEvents.includes(record));

    const history = {
      normal: historyRows.filter(
        (record) =>
          record.eventType === "NORMAL" &&
          !["COMPLETED", "CANCELLED", "REJECTED"].includes(record.participationStatus)
      ),
      merchandise: historyRows.filter(
        (record) =>
          record.eventType === "MERCHANDISE" &&
          !["COMPLETED", "CANCELLED", "REJECTED"].includes(record.participationStatus)
      ),
      completed: historyRows.filter((record) => record.participationStatus === "COMPLETED"),
      cancelledRejected: historyRows.filter((record) =>
        ["CANCELLED", "REJECTED"].includes(record.participationStatus)
      ),
    };

    return res.status(200).json({
      upcomingEvents,
      history,
    });
  } catch (err) {
    return next(err);
  }
};
