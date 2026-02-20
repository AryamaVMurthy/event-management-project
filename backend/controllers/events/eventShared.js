import mongoose from "mongoose";
import Fuse from "fuse.js";
import QRCode from "qrcode";
import { z } from "zod";
import { Event } from "../../models/Event.js";
import { Registration } from "../../models/Registration.js";
import { Ticket } from "../../models/Ticket.js";
import { ELIGIBILITY_TYPES, EVENT_TYPES } from "../../models/constants.js";
import { errors } from "../../utils/Errors.js";

export const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

export const canEditFieldInPublished = new Set([
  "description",
  "registrationDeadline",
  "registrationLimit",
  "tags",
]);

export const getEventOr404 = async (eventId) => {
  if (!isObjectId(eventId)) {
    throw errors.badRequest("Invalid event id");
  }

  const event = await Event.findById(eventId);
  if (!event) {
    throw errors.notFound("Event not found");
  }

  return event;
};

export const assertOrganizerOwnsEvent = (event, reqUserId) => {
  if (String(event.organizerId) !== String(reqUserId)) {
    throw errors.forbidden("You can only manage your own events");
  }
};

const toSlug = (value, fallback) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
};

const createUniqueId = (base, usedSet) => {
  let candidate = base;
  let counter = 2;

  while (usedSet.has(candidate)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }

  usedSet.add(candidate);
  return candidate;
};

const canonicalizeCustomFormSchema = (schema) => {
  if (!Array.isArray(schema)) return schema;

  const usedFieldIds = new Set();
  return schema.map((field, index) => {
    const normalizedField =
      field && typeof field === "object" && !Array.isArray(field) ? { ...field } : {};
    const idBase = toSlug(
      normalizedField.label || normalizedField.type || `field-${index + 1}`,
      "field"
    );
    const generatedId = createUniqueId(idBase, usedFieldIds);

    return {
      ...normalizedField,
      id: generatedId,
      order: index,
    };
  });
};

const canonicalizeMerchItems = (items) => {
  if (!Array.isArray(items)) return items;

  const usedItemIds = new Set();
  return items.map((item, itemIndex) => {
    const normalizedItem =
      item && typeof item === "object" && !Array.isArray(item) ? { ...item } : {};
    const itemIdBase = toSlug(normalizedItem.name || `item-${itemIndex + 1}`, "item");
    const generatedItemId = createUniqueId(itemIdBase, usedItemIds);

    const variants = Array.isArray(normalizedItem.variants) ? normalizedItem.variants : [];
    const usedVariantIds = new Set();
    const canonicalVariants = variants.map((variant, variantIndex) => {
      const normalizedVariant =
        variant && typeof variant === "object" && !Array.isArray(variant)
          ? { ...variant }
          : {};
      const variantIdSeed =
        normalizedVariant.label ||
        [normalizedVariant.size, normalizedVariant.color].filter(Boolean).join(" ") ||
        `${generatedItemId} variant ${variantIndex + 1}`;
      const variantIdBase = toSlug(variantIdSeed, `${generatedItemId}-variant`);
      const generatedVariantId = createUniqueId(variantIdBase, usedVariantIds);

      return {
        ...normalizedVariant,
        variantId: generatedVariantId,
      };
    });

    return {
      ...normalizedItem,
      itemId: generatedItemId,
      variants: canonicalVariants,
    };
  });
};

const canonicalizeEventInternals = (payload) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }

  const normalizedPayload = { ...payload };

  if (Array.isArray(normalizedPayload.customFormSchema)) {
    normalizedPayload.customFormSchema = canonicalizeCustomFormSchema(
      normalizedPayload.customFormSchema
    );
  }

  if (Array.isArray(normalizedPayload.items)) {
    normalizedPayload.items = canonicalizeMerchItems(normalizedPayload.items);
  }

  return normalizedPayload;
};

export const normalizeCreatePayload = (body, organizerId) =>
  canonicalizeEventInternals({
    ...body,
    organizerId: String(organizerId),
  });

export const normalizeUpdatePayload = (body) => {
  const payload = { ...body };
  delete payload.organizerId;
  delete payload.status;
  return canonicalizeEventInternals(payload);
};

export const handleControllerError = (err, next) => {
  if (err instanceof z.ZodError) {
    const message = err.issues?.[0]?.message || "Validation error";
    return next(errors.badRequest(message));
  }
  return next(err);
};

const optionalTrimmedStringSchema = z.preprocess((value) => {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text ? text : undefined;
}, z.string().optional());

const optionalDateSchema = z.preprocess((value) => {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text ? text : undefined;
}, z.coerce.date().optional());

const followedOnlySchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return false;
  if (typeof value === "boolean") return value;

  const text = String(value).trim().toLowerCase();
  if (text === "true") return true;
  if (text === "false") return false;
  return value;
}, z.boolean());

const optionalTypeSchema = z.preprocess((value) => {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text ? text : undefined;
}, z.enum(EVENT_TYPES).optional());

const optionalEligibilitySchema = z.preprocess((value) => {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text ? text : undefined;
}, z.enum(ELIGIBILITY_TYPES).optional());

export const listEventsQuerySchema = z
  .object({
    search: optionalTrimmedStringSchema,
    type: optionalTypeSchema,
    eligibility: optionalEligibilitySchema,
    dateFrom: optionalDateSchema,
    dateTo: optionalDateSchema,
    followedOnly: followedOnlySchema.optional().default(false),
  })
  .superRefine((query, ctx) => {
    if (query.dateFrom && query.dateTo && query.dateFrom > query.dateTo) {
      ctx.addIssue({
        code: z.custom,
        path: ["dateFrom"],
        message: "dateFrom cannot be after dateTo",
      });
    }
  });

export const parseListEventsQuery = (query) => listEventsQuerySchema.parse(query);

const toSearchBlob = (event) =>
  `${String(event.name || "")} ${String(event.organizerId?.organizerName || "")}`
    .trim()
    .toLowerCase();

export const fuzzyTokenSearchWithFuse = (events, searchText) => {
  const normalizedSearch = String(searchText || "").trim().toLowerCase();
  if (!normalizedSearch) {
    return events;
  }

  const tokens = normalizedSearch.split(/\s+/).filter((token) => token.length >= 2);
  if (tokens.length === 0) {
    return events;
  }

  const indexed = events.map((event) => ({
    id: String(event._id),
    event,
    eventName: String(event.name || "").trim().toLowerCase(),
    organizerName: String(event.organizerId?.organizerName || "")
      .trim()
      .toLowerCase(),
    searchBlob: toSearchBlob(event),
  }));

  const fuse = new Fuse(indexed, {
    keys: ["eventName", "organizerName"],
    includeScore: true,
    threshold: 0.35,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });

  let scoreByEventId = null;

  for (const token of tokens) {
    const tokenScores = new Map();
    const tokenResults = fuse.search(token);

    for (const result of tokenResults) {
      tokenScores.set(String(result.item.id), result.score ?? 1);
    }

    if (scoreByEventId === null) {
      scoreByEventId = tokenScores;
      continue;
    }

    for (const eventId of [...scoreByEventId.keys()]) {
      if (!tokenScores.has(eventId)) {
        scoreByEventId.delete(eventId);
        continue;
      }
      scoreByEventId.set(eventId, scoreByEventId.get(eventId) + tokenScores.get(eventId));
    }
  }

  if (!scoreByEventId || scoreByEventId.size === 0) {
    return [];
  }

  const rows = [...scoreByEventId.entries()]
    .map(([eventId, score]) => {
      const row = indexed.find((item) => item.id === eventId);
      if (!row) return null;
      return {
        event: row.event,
        score,
        exactMatch: row.searchBlob.includes(normalizedSearch),
      };
    })
    .filter(Boolean);

  rows.sort((a, b) => {
    if (a.exactMatch !== b.exactMatch) {
      return a.exactMatch ? -1 : 1;
    }
    if (a.score !== b.score) {
      return a.score - b.score;
    }
    return new Date(a.event.startDate) - new Date(b.event.startDate);
  });

  return rows.map((row) => row.event);
};

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

export const getEventForParticipantOr404 = async (eventId) => {
  if (!isObjectId(eventId)) {
    throw errors.badRequest("Invalid event id");
  }

  const event = await Event.findById(eventId).populate(
    "organizerId",
    "organizerName email accountStatus"
  );

  if (!event || event.status === "DRAFT") {
    throw errors.notFound("Event not found");
  }

  const organizerStatus = event.organizerId?.accountStatus || "ACTIVE";
  if (!event.organizerId || organizerStatus !== "ACTIVE") {
    throw errors.notFound("Event not available");
  }

  return event;
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

export const validateNormalResponses = (event, responses) => {
  const fields = event.customFormSchema || [];
  const safeResponses =
    responses && typeof responses === "object" && !Array.isArray(responses)
      ? responses
      : {};

  for (const field of fields) {
    const value = safeResponses[field.id];
    const isMissing =
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0);

    if (field.required && isMissing) {
      throw errors.badRequest(`${field.label} is required`);
    }

    if (value === undefined || value === null) {
      continue;
    }

    if (field.type === "text") {
      if (typeof value !== "string") {
        throw errors.badRequest(`${field.label} must be text`);
      }
      continue;
    }

    if (field.type === "dropdown") {
      if (typeof value !== "string") {
        throw errors.badRequest(`${field.label} must be a single option`);
      }
      if (!field.options.includes(value)) {
        throw errors.badRequest(`${field.label} has invalid option`);
      }
      continue;
    }

    if (field.type === "checkbox") {
      if (!Array.isArray(value)) {
        throw errors.badRequest(`${field.label} must be a list of options`);
      }
      const hasInvalid = value.some((option) => !field.options.includes(option));
      if (hasInvalid) {
        throw errors.badRequest(`${field.label} has invalid option`);
      }
      continue;
    }

    if (field.type === "file") {
      if (typeof value !== "object" || Array.isArray(value)) {
        throw errors.badRequest(`${field.label} must be a file`);
      }
      const fileName = String(value.fileName || "").trim();
      const fileId = String(value.fileId || "").trim();
      const mimeType = String(value.mimeType || "").trim();
      const size = Number(value.size || 0);

      if (!fileName || !fileId || !mimeType || !Number.isFinite(size) || size < 1) {
        throw errors.badRequest(`${field.label} file data is invalid`);
      }

      const allowed = Array.isArray(field.allowedMimeTypes)
        ? field.allowedMimeTypes.filter(Boolean)
        : [];
      if (allowed.length > 0 && !allowed.includes(mimeType)) {
        throw errors.badRequest(`${field.label} file type is not allowed`);
      }

      const maxBytes = Number(field.maxFileSizeMB || 5) * 1024 * 1024;
      if (size > maxBytes) {
        throw errors.badRequest(`${field.label} file exceeds max size limit`);
      }
    }
  }

  return safeResponses;
};

export const collectFileIdsFromResponses = (responses) => {
  if (!responses || typeof responses !== "object") return [];
  const fileIds = [];
  for (const value of Object.values(responses)) {
    if (value && typeof value === "object" && !Array.isArray(value) && value.fileId) {
      fileIds.push(String(value.fileId));
    }
  }
  return [...new Set(fileIds)];
};

const generateTicketId = async () => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const ticketId = `TKT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const exists = await Ticket.findOne({ ticketId }).select("_id");
    if (!exists) return ticketId;
  }
  throw errors.serverError("Could not generate ticket id");
};

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

export const getOrganizerEventOr404 = async (eventId, organizerId) => {
  const event = await getEventOr404(eventId);
  assertOrganizerOwnsEvent(event, organizerId);
  return event;
};

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
