import { Registration } from "../../../models/Registration.js";
import { Ticket } from "../../../models/Ticket.js";

export const buildParticipantRows = async (event, query = {}) => {
  const findQuery = { eventId: event._id };
  if (query.status) {
    findQuery.status = query.status;
  }

  const registrations = await Registration.find(findQuery)
    .populate("participantId", "firstName lastName email")
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

  const searchText = String(query.search || "").trim().toLowerCase();
  const attendanceFilter = String(query.attendance || "").trim().toLowerCase();

  const rows = registrations.map((registration) => {
    const participant = registration.participantId || {};
    const firstName = participant.firstName || "";
    const lastName = participant.lastName || "";
    const fullName = `${firstName} ${lastName}`.trim() || "Unknown";
    const paymentAmount =
      registration.merchPurchase?.totalAmount ?? event.registrationFee ?? 0;

    return {
      registrationId: String(registration._id),
      participantName: fullName,
      email: participant.email || "",
      registeredAt: registration.registeredAt,
      participationStatus: registration.status,
      teamName: registration.teamName || null,
      paymentAmount,
      attended: Boolean(registration.attended),
      attendedAt: registration.attendedAt || null,
      ticketId: ticketMap.get(String(registration._id)) || null,
    };
  });

  return rows.filter((row) => {
    if (searchText) {
      const target = `${row.participantName} ${row.email}`.toLowerCase();
      if (!target.includes(searchText)) {
        return false;
      }
    }

    if (attendanceFilter === "present" && !row.attended) {
      return false;
    }
    if (attendanceFilter === "absent" && row.attended) {
      return false;
    }

    return true;
  });
};

export const toCsv = (headers, rows) => {
  const escapeCell = (value) => {
    const text = String(value ?? "");
    if (text.includes(",") || text.includes('"') || text.includes("\n")) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const lines = [];
  lines.push(headers.map(escapeCell).join(","));
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(","));
  }
  return lines.join("\n");
};
