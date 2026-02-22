import { AttendanceAuditLog } from "../../../models/AttendanceAuditLog.js";
import { Registration } from "../../../models/Registration.js";
import { Ticket } from "../../../models/Ticket.js";
import { errors } from "../../../utils/Errors.js";
import {
  handleControllerError,
  getEventForOrganizerOrAdminOr404,
  isObjectId,
} from "../shared/index.js";

const parseQrPayload = (rawValue) => {
  if (!rawValue) {
    throw errors.badRequest("qrPayload is required");
  }

  if (typeof rawValue === "string") {
    try {
      const parsed = JSON.parse(rawValue);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Invalid qr payload format");
      }
      return parsed;
    } catch {
      throw errors.badRequest("qrPayload must be valid JSON");
    }
  }

  if (typeof rawValue === "object" && !Array.isArray(rawValue)) {
    return rawValue;
  }

  throw errors.badRequest("qrPayload must be an object");
};

const writeAuditLog = async ({
  eventId,
  registrationId = null,
  ticketId = null,
  scannerId,
  action,
  reason = "",
  payload = null,
}) => {
  await AttendanceAuditLog.create({
    eventId,
    registrationId,
    ticketId,
    scannerId,
    action,
    reason,
    payload,
    occurredAt: new Date(),
  });
};

const buildLiveSummary = async (eventId) => {
  const [totalRegistrations, attendedCount, recentLogs] = await Promise.all([
    Registration.countDocuments({ eventId }),
    Registration.countDocuments({ eventId, attended: true }),
    AttendanceAuditLog.find({ eventId })
      .sort({ occurredAt: -1 })
      .limit(20)
      .populate("scannerId", "email role")
      .lean(),
  ]);

  return {
    totalRegistrations,
    attendedCount,
    unattendedCount: totalRegistrations - attendedCount,
    recentLogs: recentLogs.map((entry) => ({
      id: String(entry._id),
      action: entry.action,
      reason: entry.reason || "",
      ticketId: entry.ticketId || null,
      registrationId: entry.registrationId ? String(entry.registrationId) : null,
      occurredAt: entry.occurredAt,
      scanner: {
        id: entry.scannerId?._id ? String(entry.scannerId._id) : null,
        email: entry.scannerId?.email || null,
        role: entry.scannerId?.role || null,
      },
    })),
  };
};

export const scanAttendanceByQr = async (req, res, next) => {
  try {
    const event = await getEventForOrganizerOrAdminOr404(req.params.id, req.user);
    const qrPayload = parseQrPayload(req.body?.qrPayload);

    const ticketId = String(qrPayload.ticketId || "").trim();
    const registrationId = String(qrPayload.registrationId || "").trim();
    const payloadEventId = String(qrPayload.eventId || "").trim();

    if (!ticketId || !registrationId || !payloadEventId) {
      return next(errors.badRequest("qrPayload must contain ticketId, registrationId and eventId"));
    }

    if (payloadEventId !== String(event._id)) {
      await writeAuditLog({
        eventId: event._id,
        scannerId: req.user._id,
        action: "SCAN_INVALID",
        reason: "QR payload event does not match route event",
        payload: qrPayload,
      });
      return next(errors.badRequest("Invalid QR payload for this event"));
    }

    const ticket = await Ticket.findOne({ ticketId, eventId: event._id });
    if (!ticket || String(ticket.registrationId) !== registrationId) {
      await writeAuditLog({
        eventId: event._id,
        scannerId: req.user._id,
        action: "SCAN_INVALID",
        ticketId,
        reason: "Ticket not found for this event",
        payload: qrPayload,
      });
      return next(errors.badRequest("Invalid ticket QR payload"));
    }

    const registration = await Registration.findOne({
      _id: registrationId,
      eventId: event._id,
    })
      .populate("participantId", "firstName lastName email")
      .lean();

    if (!registration) {
      await writeAuditLog({
        eventId: event._id,
        scannerId: req.user._id,
        action: "SCAN_INVALID",
        ticketId,
        reason: "Registration not found for scanned ticket",
        payload: qrPayload,
      });
      return next(errors.badRequest("Registration not found for scanned ticket"));
    }

    if (registration.attended) {
      await writeAuditLog({
        eventId: event._id,
        registrationId: registration._id,
        scannerId: req.user._id,
        ticketId,
        action: "SCAN_DUPLICATE",
        reason: "Duplicate scan attempt",
        payload: qrPayload,
      });
      return next(errors.conflict("Attendance already marked for this registration"));
    }

    await Registration.updateOne(
      { _id: registration._id },
      {
        $set: {
          attended: true,
          attendedAt: new Date(),
          attendanceMarkedBy: req.user._id,
        },
      }
    );

    await writeAuditLog({
      eventId: event._id,
      registrationId: registration._id,
      scannerId: req.user._id,
      ticketId,
      action: "SCAN_SUCCESS",
      reason: "Attendance marked by QR scan",
      payload: qrPayload,
    });

    return res.status(200).json({
      message: "Attendance marked via QR scan",
      registration: {
        registrationId: String(registration._id),
        participant: {
          id: registration.participantId?._id
            ? String(registration.participantId._id)
            : String(registration.participantId),
          name:
            `${registration.participantId?.firstName || ""} ${
              registration.participantId?.lastName || ""
            }`.trim() || "Unknown",
          email: registration.participantId?.email || null,
        },
      },
    });
  } catch (err) {
    return handleControllerError(err, next);
  }
};

export const manualAttendanceOverride = async (req, res, next) => {
  try {
    const event = await getEventForOrganizerOrAdminOr404(req.params.id, req.user);
    const registrationId = String(req.body?.registrationId || "").trim();
    const reason = String(req.body?.reason || "").trim();
    const attended =
      typeof req.body?.attended === "boolean" ? req.body.attended : true;

    if (!registrationId || !isObjectId(registrationId)) {
      return next(errors.badRequest("Valid registrationId is required"));
    }
    if (!reason) {
      return next(errors.badRequest("reason is required for manual override"));
    }

    const registration = await Registration.findOne({
      _id: registrationId,
      eventId: event._id,
    }).populate("participantId", "firstName lastName email");

    if (!registration) {
      return next(errors.notFound("Registration not found for this event"));
    }

    registration.attended = attended;
    registration.attendedAt = attended ? new Date() : null;
    registration.attendanceMarkedBy = attended ? req.user._id : null;
    await registration.save();

    await writeAuditLog({
      eventId: event._id,
      registrationId: registration._id,
      scannerId: req.user._id,
      ticketId: null,
      action: "MANUAL_OVERRIDE",
      reason,
      payload: {
        attended,
      },
    });

    return res.status(200).json({
      message: "Attendance updated via manual override",
      registration: {
        registrationId: String(registration._id),
        attended: registration.attended,
        attendedAt: registration.attendedAt,
        participant: {
          id: registration.participantId?._id
            ? String(registration.participantId._id)
            : String(registration.participantId),
          name:
            `${registration.participantId?.firstName || ""} ${
              registration.participantId?.lastName || ""
            }`.trim() || "Unknown",
          email: registration.participantId?.email || null,
        },
      },
    });
  } catch (err) {
    return handleControllerError(err, next);
  }
};

export const getLiveAttendanceSummary = async (req, res, next) => {
  try {
    const event = await getEventForOrganizerOrAdminOr404(req.params.id, req.user);
    const summary = await buildLiveSummary(event._id);

    return res.status(200).json({
      eventId: String(event._id),
      summary,
    });
  } catch (err) {
    return handleControllerError(err, next);
  }
};
