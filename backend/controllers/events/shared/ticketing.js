// Ticketing: Controller level logic for the feature area.
import QRCode from "qrcode";
import { Ticket } from "../../../models/Ticket.js";
import { errors } from "../../../utils/Errors.js";

// Generate Ticket Id: Generates ticket id from existing data. Inputs: none. Returns: a function result.
const generateTicketId = async () => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const ticketId = `TKT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const exists = await Ticket.findOne({ ticketId }).select("_id");
    if (!exists) return ticketId;
  }
  throw errors.serverError("Could not generate ticket id");
};

// Create Ticket For Registration: Creates a ticket entity linked to a registration entry. Inputs: registration. Returns: side effects and response to caller.
export const createTicketForRegistration = async (registration) => {
  const ticketId = await generateTicketId();
  const qrRawPayload = {
    ticketId,
    registrationId: String(registration._id),
    participantId: String(registration.participantId),
    eventId: String(registration.eventId),
  };

  const qrCodeDataUrl = await QRCode.toDataURL(JSON.stringify(qrRawPayload), {
    width: 320,
    margin: 1,
  });

  return Ticket.create({
    ticketId,
    registrationId: registration._id,
    participantId: registration.participantId,
    eventId: registration.eventId,
    qrPayload: {
      ...qrRawPayload,
      qrCodeDataUrl,
    },
  });
};
