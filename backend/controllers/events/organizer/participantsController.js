// Participants Controller: Controller level logic for the feature area.
import { Registration } from "../../../models/Registration.js";
import { errors } from "../../../utils/Errors.js";
import {
  handleControllerError,
  getEventForOrganizerOrAdminOr404,
  getOrganizerEventOr404,
  buildParticipantRows,
  toCsv,
} from "../shared/index.js";

// Get Organizer Event Participants: Loads participant list payload and pagination for organizer event. Inputs: req, res, next. Returns: a Promise with payload data.
export const getOrganizerEventParticipants = async (req, res, next) => {
  try {
    const event = await getEventForOrganizerOrAdminOr404(req.params.id, req.user);
    const rows = await buildParticipantRows(event, req.query);
    return res.status(200).json({ participants: rows });
  } catch (err) {
    return handleControllerError(err, next);
  }
};

// Update Participant Attendance: Updates participant attendance based on input. Inputs: req, res, next. Returns: side effects and response to caller.
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

// Export Organizer Event Participants: Runs Export organizer event participants flow. Inputs: req, res, next. Returns: a function result.
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
