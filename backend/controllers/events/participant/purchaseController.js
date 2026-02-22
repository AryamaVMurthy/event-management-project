import { Registration } from "../../../models/Registration.js";
import { Ticket } from "../../../models/Ticket.js";
import { errors } from "../../../utils/Errors.js";
import {
  handleControllerError,
  isParticipantRole,
  getEventForParticipantOr404,
  assertEventOpen,
  assertParticipantEligibility,
  assertCapacityAvailable,
  assertNoExistingRegistration,
  createTicketForRegistration,
} from "../shared/index.js";
import { sendTicketEmailStrict } from "./services/ticketEmailService.js";

export const purchaseMerchandise = async (req, res, next) => {
  try {
    if (!isParticipantRole(req.user.role)) {
      return next(errors.forbidden("Only participants can purchase"));
    }

    const event = await getEventForParticipantOr404(req.params.id);
    if (event.type !== "MERCHANDISE") {
      return next(errors.badRequest("Use register endpoint for normal events"));
    }

    assertEventOpen(event);
    assertParticipantEligibility(event, req.user.role);
    await assertCapacityAvailable(event._id, event.registrationLimit);
    await assertNoExistingRegistration(req.user._id, event._id);

    const { itemId, variantId, quantity } = req.body;
    const qty = Number(quantity);

    if (!itemId || !variantId || !Number.isInteger(qty) || qty < 1) {
      return next(
        errors.badRequest("itemId, variantId and positive integer quantity are required")
      );
    }

    const item = (event.items || []).find((it) => it.itemId === itemId);
    if (!item) {
      return next(errors.badRequest("Invalid itemId"));
    }

    const variant = (item.variants || []).find((vr) => vr.variantId === variantId);
    if (!variant) {
      return next(errors.badRequest("Invalid variantId"));
    }

    if (qty > item.purchaseLimitPerParticipant) {
      return next(
        errors.badRequest("Quantity exceeds purchase limit for this item")
      );
    }

    if (variant.stockQty < qty) {
      return next(errors.badRequest("Not enough stock available"));
    }

    variant.stockQty -= qty;
    await event.save();

    const unitPrice = Number(variant.price || event.registrationFee || 0);
    const totalAmount = unitPrice * qty;

    let registration = null;
    let ticket = null;
    let email = null;

    try {
      registration = await Registration.create({
        participantId: req.user._id,
        eventId: event._id,
        status: "REGISTERED",
        merchPurchase: {
          itemId,
          variantId,
          quantity: qty,
          unitPrice,
          totalAmount,
        },
      });

      ticket = await createTicketForRegistration(registration);
      email = await sendTicketEmailStrict({
        participantId: req.user._id,
        event,
        registration,
        ticket,
        flow: "purchase",
      });

      return res.status(201).json({
        message: "Purchase successful",
        registration,
        ticket: {
          ticketId: ticket.ticketId,
        },
        email,
      });
    } catch (createErr) {
      if (ticket?._id) {
        await Ticket.findByIdAndDelete(ticket._id);
      }
      if (registration?._id) {
        await Registration.findByIdAndDelete(registration._id);
      }
      variant.stockQty += qty;
      await event.save();
      throw createErr;
    }
  } catch (err) {
    return handleControllerError(err, next);
  }
};
