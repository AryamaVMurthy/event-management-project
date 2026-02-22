import { Registration } from "../../../models/Registration.js";
import { errors } from "../../../utils/Errors.js";

export const isParticipantRole = (role) =>
  role === "IIIT_PARTICIPANT" || role === "NON_IIIT_PARTICIPANT";

export const getEligibilityBlockedReason = (eligibility, role) => {
  if (eligibility === "IIIT_ONLY" && role !== "IIIT_PARTICIPANT") {
    return "NOT_ELIGIBLE";
  }
  if (eligibility === "NON_IIIT_ONLY" && role !== "NON_IIIT_PARTICIPANT") {
    return "NOT_ELIGIBLE";
  }
  return null;
};

export const getBaseEventSummary = (event) => ({
  id: String(event._id),
  name: event.name,
  description: event.description,
  type: event.type,
  eligibility: event.eligibility,
  status: event.status,
  registrationDeadline: event.registrationDeadline,
  startDate: event.startDate,
  endDate: event.endDate,
  registrationLimit: event.registrationLimit,
  registrationFee: event.registrationFee,
  tags: event.tags || [],
  organizer: {
    id: event.organizerId?._id ? String(event.organizerId._id) : null,
    organizerName: event.organizerId?.organizerName ?? null,
    email: event.organizerId?.email ?? null,
  },
});

export const appendBlockingStatusForEvent = async (event, userId, role) => {
  const blockedReasons = [];
  const now = new Date();

  if (event.status !== "PUBLISHED" && event.status !== "ONGOING") {
    blockedReasons.push("EVENT_NOT_OPEN");
  }

  if (event.registrationDeadline && new Date(event.registrationDeadline) < now) {
    blockedReasons.push("DEADLINE_PASSED");
  }

  const eligibilityReason = getEligibilityBlockedReason(event.eligibility, role);
  if (eligibilityReason) {
    blockedReasons.push(eligibilityReason);
  }

  const registrationCount = await Registration.countDocuments({
    eventId: event._id,
    status: { $in: ["REGISTERED", "COMPLETED"] },
  });

  if (registrationCount >= event.registrationLimit) {
    blockedReasons.push("REGISTRATION_FULL");
  }

  const existingRegistration = await Registration.findOne({
    participantId: userId,
    eventId: event._id,
  }).select("status");

  if (existingRegistration) {
    blockedReasons.push("ALREADY_REGISTERED");
  }

  if (event.type === "MERCHANDISE") {
    let hasStock = false;
    for (const item of event.items || []) {
      for (const variant of item.variants || []) {
        if (variant.stockQty > 0) {
          hasStock = true;
          break;
        }
      }
      if (hasStock) break;
    }
    if (!hasStock) {
      blockedReasons.push("STOCK_EXHAUSTED");
    }
  }

  const uniqueReasons = [...new Set(blockedReasons)];
  return {
    registrationCount,
    blockedReasons: uniqueReasons,
    canRegisterOrPurchase: uniqueReasons.length === 0,
  };
};

export const assertEventOpen = (event) => {
  if (event.status !== "PUBLISHED" && event.status !== "ONGOING") {
    throw errors.badRequest("Event is not open for registration");
  }

  if (event.registrationDeadline && new Date(event.registrationDeadline) < new Date()) {
    throw errors.badRequest("Registration deadline has passed");
  }
};

export const assertParticipantEligibility = (event, role) => {
  const reason = getEligibilityBlockedReason(event.eligibility, role);
  if (reason) {
    throw errors.forbidden("You are not eligible for this event");
  }
};

export const assertCapacityAvailable = async (eventId, registrationLimit) => {
  const current = await Registration.countDocuments({
    eventId,
    status: { $in: ["REGISTERED", "COMPLETED"] },
  });
  if (current >= registrationLimit) {
    throw errors.badRequest("Registration limit reached");
  }
};

export const assertNoExistingRegistration = async (participantId, eventId) => {
  const existing = await Registration.findOne({ participantId, eventId });
  if (existing) {
    throw errors.conflict("You are already registered for this event");
  }
};
