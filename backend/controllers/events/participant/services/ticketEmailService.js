import { User } from "../../../../models/User.js";
import { errors } from "../../../../utils/Errors.js";
import { sendTicketEmail } from "../../../../utils/ticketEmail.js";

export const sendTicketEmailStrict = async ({
  participantId,
  event,
  registration,
  ticket,
  flow,
}) => {
  try {
    const participant = await User.findById(participantId)
      .select("firstName lastName email")
      .lean();

    if (!participant?.email) {
      throw errors.emailDeliveryFailed();
    }

    const delivery = await sendTicketEmail({
      participant,
      event,
      registration,
      ticket,
      flow,
    });

    return {
      sent: true,
      mode: delivery.mode,
      messageId: delivery.messageId || null,
    };
  } catch (err) {
    if (err?.code === "EMAIL_DELIVERY_FAILED") {
      throw err;
    }
    console.error("Ticket email failed:", err.message);
    throw errors.emailDeliveryFailed();
  }
};
