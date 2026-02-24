// Ticket Controller: Controller level logic for the feature area.
import { Ticket } from "../models/Ticket.js";
import { Event } from "../models/Event.js";
import { errors } from "../utils/Errors.js";

// Is Participant Role: Checks whether a role corresponds to participant variants. Inputs: role. Returns: a function result.
const isParticipantRole = (role) =>
  role === "IIIT_PARTICIPANT" || role === "NON_IIIT_PARTICIPANT";

// Get Ticket By Id: Gets ticket by id from persistence or request payload. Inputs: req, res, next. Returns: a Promise with payload data.
export const getTicketById = async (req, res, next) => {
  try {
    const ticketId = String(req.params.ticketId || "").trim();
    if (!ticketId) {
      return next(errors.badRequest("ticketId is required"));
    }

    const ticket = await Ticket.findOne({ ticketId })
      .populate("registrationId", "status teamName registeredAt")
      .populate("participantId", "firstName lastName email")
      .populate("eventId", "name type organizerId startDate endDate")
      .lean();

    if (!ticket) {
      return next(errors.notFound("Ticket not found"));
    }

    if (isParticipantRole(req.user.role)) {
      if (String(ticket.participantId?._id || ticket.participantId) !== String(req.user._id)) {
        return next(errors.forbidden("You can view only your own ticket"));
      }
    }

    if (req.user.role === "organizer") {
      const event = await Event.findById(ticket.eventId?._id || ticket.eventId)
        .select("organizerId")
        .lean();

      if (!event || String(event.organizerId) !== String(req.user._id)) {
        return next(errors.forbidden("You can view only tickets for your events"));
      }
    }

    const participant = ticket.participantId || {};
    const registration = ticket.registrationId || {};
    const event = ticket.eventId || {};

    return res.status(200).json({
      ticket: {
        ticketId: ticket.ticketId,
        issuedAt: ticket.issuedAt,
        qrCodeDataUrl: ticket.qrPayload?.qrCodeDataUrl ?? null,
        qrPayload: ticket.qrPayload ?? null,
        participant: {
          id: participant._id ? String(participant._id) : null,
          name:
            [participant.firstName, participant.lastName]
              .filter(Boolean)
              .join(" ")
              .trim() || null,
          email: participant.email ?? null,
        },
        event: {
          id: event._id ? String(event._id) : null,
          name: event.name ?? null,
          type: event.type ?? null,
          startDate: event.startDate ?? null,
          endDate: event.endDate ?? null,
        },
        registration: {
          id: registration._id ? String(registration._id) : null,
          status: registration.status ?? null,
          teamName: registration.teamName ?? null,
          registeredAt: registration.registeredAt ?? null,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
};
