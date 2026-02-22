import { Registration } from "../../../models/Registration.js";
import { MERCH_PAYMENT_STATUSES } from "../../../models/constants.js";
import { Ticket } from "../../../models/Ticket.js";
import { errors } from "../../../utils/Errors.js";
import { sendTicketEmailStrict } from "../participant/services/ticketEmailService.js";
import {
  handleControllerError,
  getEventForOrganizerOrAdminOr404,
  isObjectId,
  createTicketForRegistration,
} from "../shared/index.js";

const parsePaymentStatusFilter = (query) => {
  const raw = String(query.paymentStatus || query.status || "ALL")
    .trim()
    .toUpperCase();
  if (raw === "ALL") {
    return null;
  }
  if (!MERCH_PAYMENT_STATUSES.includes(raw)) {
    throw errors.badRequest("Invalid paymentStatus filter");
  }
  return raw;
};

const toOrderRow = (registration) => {
  const participant = registration.participantId || {};
  const merch = registration.merchPurchase || {};
  const proof = merch.paymentProof || null;

  return {
    registrationId: String(registration._id),
    eventId: String(registration.eventId),
    participant: {
      id: participant._id ? String(participant._id) : null,
      name:
        [participant.firstName, participant.lastName]
          .filter(Boolean)
          .join(" ")
          .trim() || "Unknown",
      email: participant.email || null,
    },
    quantity: merch.quantity || 0,
    unitPrice: merch.unitPrice || 0,
    totalAmount: merch.totalAmount || 0,
    itemId: merch.itemId || null,
    variantId: merch.variantId || null,
    paymentStatus: merch.paymentStatus || "PAYMENT_PENDING",
    paymentProof: proof
      ? {
          fileName: proof.fileName,
          mimeType: proof.mimeType,
          size: proof.size,
          uploadedAt: proof.uploadedAt,
          downloadUrl: `/api/events/registrations/${String(registration._id)}/payment-proof?download=true`,
        }
      : null,
    reviewComment: merch.reviewComment || "",
    reviewedAt: merch.reviewedAt || null,
    registeredAt: registration.registeredAt,
    finalizedAt: merch.finalizedAt || null,
  };
};

export const getMerchOrderForOrganizerOrAdmin = async ({
  eventId,
  registrationId,
  reqUser,
}) => {
  if (!isObjectId(registrationId)) {
    throw errors.badRequest("Invalid registration id");
  }

  const event = await getEventForOrganizerOrAdminOr404(eventId, reqUser);
  if (event.type !== "MERCHANDISE") {
    throw errors.badRequest("This endpoint is only for merchandise events");
  }

  const registration = await Registration.findOne({
    _id: registrationId,
    eventId: event._id,
  })
    .populate("participantId", "firstName lastName email")
    .populate("merchPurchase.reviewedBy", "email role");

  if (!registration || !registration.merchPurchase) {
    throw errors.notFound("Merchandise order not found");
  }

  return { event, registration };
};

export const listMerchOrdersForOrganizerEvent = async (req, res, next) => {
  try {
    const event = await getEventForOrganizerOrAdminOr404(req.params.id, req.user);
    if (event.type !== "MERCHANDISE") {
      return res.status(200).json({ orders: [] });
    }

    const paymentStatus = parsePaymentStatusFilter(req.query);

    const query = {
      eventId: event._id,
      merchPurchase: { $exists: true },
    };

    if (paymentStatus) {
      query["merchPurchase.paymentStatus"] = paymentStatus;
    }

    const registrations = await Registration.find(query)
      .populate("participantId", "firstName lastName email")
      .sort({ registeredAt: -1 })
      .lean();

    return res.status(200).json({
      orders: registrations.map(toOrderRow),
    });
  } catch (err) {
    return handleControllerError(err, next);
  }
};

const parseReviewPayload = (body) => {
  const status = String(body?.status || "")
    .trim()
    .toUpperCase();
  if (status !== "APPROVED" && status !== "REJECTED") {
    throw errors.badRequest("status must be APPROVED or REJECTED");
  }

  const reviewComment =
    typeof body?.reviewComment === "string" ? body.reviewComment.trim() : "";

  return { status, reviewComment };
};

export const reviewMerchOrderForOrganizerEvent = async (req, res, next) => {
  try {
    const { event, registration } = await getMerchOrderForOrganizerOrAdmin({
      eventId: req.params.id,
      registrationId: req.params.registrationId,
      reqUser: req.user,
    });
    const decision = parseReviewPayload(req.body);

    const merch = registration.merchPurchase;
    if (merch.paymentStatus !== "PENDING_APPROVAL") {
      return next(errors.conflict("Only orders pending approval can be reviewed"));
    }

    const reviewTimestamp = new Date();

    if (decision.status === "REJECTED") {
      merch.paymentStatus = "REJECTED";
      merch.reviewedBy = req.user._id;
      merch.reviewedAt = reviewTimestamp;
      merch.reviewComment = decision.reviewComment;
      merch.finalizedAt = reviewTimestamp;
      await registration.save();

      return res.status(200).json({
        message: "Merchandise order rejected",
        order: toOrderRow(registration),
      });
    }

    const item = (event.items || []).find((entry) => entry.itemId === merch.itemId);
    if (!item) {
      return next(errors.badRequest("Invalid merchandise item for this order"));
    }

    const variant = (item.variants || []).find((entry) => entry.variantId === merch.variantId);
    if (!variant) {
      return next(errors.badRequest("Invalid merchandise variant for this order"));
    }

    const quantity = Number(merch.quantity || 0);
    if (!Number.isInteger(quantity) || quantity < 1) {
      return next(errors.badRequest("Invalid order quantity"));
    }

    if (variant.stockQty < quantity) {
      return next(errors.badRequest("Not enough stock available"));
    }

    const originalStock = variant.stockQty;
    const originalMerchSnapshot =
      typeof merch.toObject === "function" ? merch.toObject() : JSON.parse(JSON.stringify(merch));

    let ticket = null;
    try {
      variant.stockQty -= quantity;
      await event.save();

      ticket = await createTicketForRegistration(registration);

      const email = await sendTicketEmailStrict({
        participantId: registration.participantId,
        event,
        registration,
        ticket,
        flow: "purchase",
      });

      merch.paymentStatus = "APPROVED";
      merch.reviewedBy = req.user._id;
      merch.reviewedAt = reviewTimestamp;
      merch.reviewComment = decision.reviewComment;
      merch.finalizedAt = reviewTimestamp;
      await registration.save();

      return res.status(200).json({
        message: "Merchandise order approved",
        order: toOrderRow(registration),
        ticket: {
          ticketId: ticket.ticketId,
        },
        email,
      });
    } catch (approvalErr) {
      if (ticket?._id) {
        await Ticket.findByIdAndDelete(ticket._id);
      }
      variant.stockQty = originalStock;
      await event.save();
      registration.merchPurchase = originalMerchSnapshot;
      await registration.save();
      throw approvalErr;
    }
  } catch (err) {
    return handleControllerError(err, next);
  }
};
