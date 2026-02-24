// Ticket Email: Module level logic for the feature area.
import { sendEmail } from "./mailer.js";

// Format Date Time: Converts date values into UI-facing formatted strings. Inputs: value. Returns: a function result.
const formatDateTime = (value) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "-";
  }
};

export const sendTicketEmail = async ({
  participant,
  event,
  registration,
  ticket,
  flow,
}) => {
  const participantName =
    [participant?.firstName, participant?.lastName].filter(Boolean).join(" ").trim() ||
    participant?.email ||
    "Participant";
  const flowLabel = flow === "purchase" ? "Purchase Confirmation" : "Registration Confirmation";
  const qrCodeDataUrl = ticket?.qrPayload?.qrCodeDataUrl || "";

  const subject = `[Felicity] ${flowLabel} - ${event?.name || "Event"}`;

  const text = [
    `Hello ${participantName},`,
    "",
    `${flowLabel} successful.`,
    `Event: ${event?.name ?? ""}`,
    `Type: ${event?.type ?? ""}`,
    `Start: ${formatDateTime(event?.startDate)}`,
    `End: ${formatDateTime(event?.endDate)}`,
    `Ticket ID: ${ticket?.ticketId ?? ""}`,
    `Registration ID: ${registration?._id ? String(registration._id) : ""}`,
    "",
    "Please keep this ticket for verification.",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <h2>${flowLabel}</h2>
      <p>Hello ${participantName},</p>
      <p>Your ticket has been generated.</p>
      <p><strong>Event:</strong> ${event?.name ?? ""}</p>
      <p><strong>Type:</strong> ${event?.type ?? ""}</p>
      <p><strong>Start:</strong> ${formatDateTime(event?.startDate)}</p>
      <p><strong>End:</strong> ${formatDateTime(event?.endDate)}</p>
      <p><strong>Ticket ID:</strong> ${ticket?.ticketId ?? ""}</p>
      <p><strong>Registration ID:</strong> ${
        registration?._id ? String(registration._id) : ""
      }</p>
      ${
        qrCodeDataUrl
          ? `<p><strong>QR Code:</strong></p><img src="${qrCodeDataUrl}" alt="Ticket QR" style="max-width:260px;" />`
          : ""
      }
    </div>
  `;

  return sendEmail({
    to: participant.email,
    subject,
    text,
    html,
  });
};
