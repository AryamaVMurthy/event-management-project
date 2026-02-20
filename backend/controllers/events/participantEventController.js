import { Event } from "../../models/Event.js";
import { Registration } from "../../models/Registration.js";
import { Ticket } from "../../models/Ticket.js";
import { User } from "../../models/User.js";
import { errors } from "../../utils/Errors.js";
import { sendTicketEmail } from "../../utils/ticketEmail.js";
import {
  uploadBufferToGridFS,
  deleteGridFSFile,
  getGridFSFileInfo,
  openGridFSDownloadStream,
} from "../../utils/gridfs.js";
import {
  handleControllerError,
  isParticipantRole,
  getBaseEventSummary,
  parseListEventsQuery,
  fuzzyTokenSearchWithFuse,
  appendBlockingStatusForEvent,
  getEventForParticipantOr404,
  assertEventOpen,
  assertParticipantEligibility,
  assertCapacityAvailable,
  assertNoExistingRegistration,
  validateNormalResponses,
  createTicketForRegistration,
  isObjectId,
} from "./eventShared.js";

const sendTicketEmailStrict = async ({
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

const getTrendingEvents = async () => {
  const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const grouped = await Registration.aggregate([
    {
      $match: {
        registeredAt: { $gte: last24Hours },
        status: { $in: ["REGISTERED", "COMPLETED"] },
      },
    },
    {
      $group: {
        _id: "$eventId",
        registrationCount24h: { $sum: 1 },
        latestRegistrationAt: { $max: "$registeredAt" },
      },
    },
    { $sort: { registrationCount24h: -1, latestRegistrationAt: -1 } },
    { $limit: 100 },
  ]);

  if (grouped.length === 0) {
    return [];
  }

  const eventIds = grouped.map((row) => row._id);

  const events = await Event.find({
    _id: { $in: eventIds },
    status: { $in: ["PUBLISHED", "ONGOING"] },
  })
    .populate("organizerId", "organizerName email accountStatus")
    .lean();

  const eventMap = new Map(
    events
      .filter(
        (event) =>
          event.organizerId &&
          (event.organizerId.accountStatus || "ACTIVE") === "ACTIVE"
      )
      .map((event) => [String(event._id), event])
  );

  const trendingEvents = [];

  for (const row of grouped) {
    const event = eventMap.get(String(row._id));
    if (!event) continue;

    trendingEvents.push({
      ...getBaseEventSummary(event),
      registrationCount24h: row.registrationCount24h,
    });

    if (trendingEvents.length === 5) break;
  }

  return trendingEvents;
};

const parseResponsesInput = (rawResponses) => {
  if (rawResponses === undefined || rawResponses === null || rawResponses === "") {
    return {};
  }

  if (typeof rawResponses === "string") {
    try {
      const parsed = JSON.parse(rawResponses);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Invalid responses format");
      }
      return parsed;
    } catch {
      throw errors.badRequest("responses must be valid JSON object");
    }
  }

  if (typeof rawResponses === "object" && !Array.isArray(rawResponses)) {
    return rawResponses;
  }

  throw errors.badRequest("responses must be an object");
};

const validateUploadedFileForField = (field, file) => {
  const allowed = Array.isArray(field.allowedMimeTypes)
    ? field.allowedMimeTypes.filter(Boolean)
    : [];
  if (allowed.length > 0 && !allowed.includes(file.mimetype)) {
    throw errors.badRequest(`${field.label} file type is not allowed`);
  }

  const maxBytes = Number(field.maxFileSizeMB || 5) * 1024 * 1024;
  if (file.size > maxBytes) {
    throw errors.badRequest(`${field.label} file exceeds max size limit`);
  }
};

const buildFileResponsesFromUpload = async (event, files, participantId) => {
  const fileFields = (event.customFormSchema || []).filter((field) => field.type === "file");
  if (fileFields.length === 0 || !Array.isArray(files) || files.length === 0) {
    return { fileResponses: {}, uploadedFileIds: [] };
  }

  const supportedFieldNames = new Set();
  for (const field of fileFields) {
    supportedFieldNames.add(field.id);
    supportedFieldNames.add(`file_${field.id}`);
  }

  for (const file of files) {
    if (!supportedFieldNames.has(file.fieldname)) {
      throw errors.badRequest(`Unexpected file field: ${file.fieldname}`);
    }
  }

  const fileResponses = {};
  const uploadedFileIds = [];

  for (const field of fileFields) {
    const file =
      files.find((item) => item.fieldname === field.id) ||
      files.find((item) => item.fieldname === `file_${field.id}`);
    if (!file) continue;

    validateUploadedFileForField(field, file);

    const uploaded = await uploadBufferToGridFS({
      buffer: file.buffer,
      filename: file.originalname,
      contentType: file.mimetype,
      metadata: {
        fieldId: field.id,
        participantId: String(participantId),
        eventId: String(event._id),
      },
    });

    const fileId = String(uploaded.fileId);
    uploadedFileIds.push(fileId);

    fileResponses[field.id] = {
      kind: "file",
      fileId,
      fileName: uploaded.fileName,
      mimeType: uploaded.mimeType,
      size: uploaded.size,
    };
  }

  return { fileResponses, uploadedFileIds };
};

const rollbackGridFsFiles = async (fileIds) => {
  const safeIds = [...new Set((fileIds || []).map((id) => String(id)).filter(Boolean))];
  for (const fileId of safeIds) {
    try {
      await deleteGridFSFile(fileId);
    } catch (err) {
      console.error("Failed to rollback GridFS file:", fileId, err.message);
    }
  }
};

const normalizeTag = (value) => String(value || "").trim().toLowerCase();

// GET /api/events
export const listEvents = async (req, res, next) => {
  try {
    if (!isParticipantRole(req.user.role)) {
      return next(errors.forbidden("Only participants can browse events"));
    }

    const { search, type, eligibility, dateFrom, dateTo, followedOnly } =
      parseListEventsQuery(req.query);

    const events = await Event.find({ status: { $in: ["PUBLISHED", "ONGOING"] } })
      .populate("organizerId", "organizerName email accountStatus")
      .sort({ startDate: 1 })
      .lean();

    const trendingEvents = await getTrendingEvents();
    const trendingCountByEventId = new Map(
      trendingEvents.map((event) => [String(event.id), Number(event.registrationCount24h || 0)])
    );

    const participant = await User.findById(req.user._id)
      .select("followedClubs interests")
      .populate("interests", "name")
      .lean();

    const followedClubIds = (participant?.followedClubs || []).map((id) => String(id));
    const followedClubSet = new Set(followedClubIds);
    const participantInterestTags = new Set(
      (participant?.interests || [])
        .map((interest) => normalizeTag(interest?.name || interest))
        .filter(Boolean)
    );
    const personalizationApplied = followedClubIds.length > 0 || participantInterestTags.size > 0;

    if (followedOnly) {
      if (followedClubIds.length === 0) {
        return res.status(200).json({
          events: [],
          recommendedEvents: [],
          trendingEvents,
          meta: {
            followedOnly: true,
            followedClubCount: 0,
            noFollowedClubs: true,
            personalizationApplied,
          },
        });
      }
    }

    const filtered = events.filter((event) => {
      const organizerStatus = event.organizerId?.accountStatus || "ACTIVE";
      if (!event.organizerId || organizerStatus !== "ACTIVE") {
        return false;
      }

      if (followedOnly) {
        const organizerId = event.organizerId?._id
          ? String(event.organizerId._id)
          : String(event.organizerId);
        if (!followedClubSet.has(organizerId)) {
          return false;
        }
      }

      if (type && event.type !== type) {
        return false;
      }

      if (eligibility && event.eligibility !== eligibility) {
        return false;
      }

      if (dateFrom && new Date(event.startDate) < dateFrom) {
        return false;
      }

      if (dateTo && new Date(event.startDate) > dateTo) {
        return false;
      }

      return true;
    });

    const searched = search ? fuzzyTokenSearchWithFuse(filtered, search) : filtered;
    const scored = searched.map((event, baseOrder) => {
      const eventId = String(event._id);
      const organizerId = event.organizerId?._id
        ? String(event.organizerId._id)
        : String(event.organizerId || "");
      const followedOrganizer = followedClubSet.has(organizerId);
      const eventTags = new Set((event.tags || []).map((tag) => normalizeTag(tag)).filter(Boolean));
      const matchedTags = [...participantInterestTags].filter((tag) => eventTags.has(tag));
      const trendingBoost = Math.min(10, Number(trendingCountByEventId.get(eventId) || 0));
      const score =
        (followedOrganizer ? 100 : 0) +
        matchedTags.length * 20 +
        trendingBoost;

      return {
        event,
        baseOrder,
        personalization: {
          score,
          matchedTags,
          followedOrganizer,
        },
      };
    });

    scored.sort((left, right) => {
      if (right.personalization.score !== left.personalization.score) {
        return right.personalization.score - left.personalization.score;
      }
      if (left.baseOrder !== right.baseOrder) {
        return left.baseOrder - right.baseOrder;
      }
      return new Date(left.event.startDate) - new Date(right.event.startDate);
    });

    const mappedEvents = scored.map((row) => ({
      ...getBaseEventSummary(row.event),
      personalization: row.personalization,
    }));

    const recommendedEvents = scored
      .filter((row) => row.personalization.score > 0)
      .slice(0, 5)
      .map((row) => ({
        ...getBaseEventSummary(row.event),
        personalization: row.personalization,
      }));

    return res.status(200).json({
      events: mappedEvents,
      recommendedEvents,
      trendingEvents,
      meta: {
        followedOnly,
        followedClubCount: followedClubIds.length,
        noFollowedClubs: followedOnly && followedClubIds.length === 0,
        personalizationApplied,
      },
    });
  } catch (err) {
    return handleControllerError(err, next);
  }
};

// GET /api/events/:id
export const getEventDetails = async (req, res, next) => {
  try {
    if (!isParticipantRole(req.user.role)) {
      return next(errors.forbidden("Only participants can view event details"));
    }

    if (!isObjectId(req.params.id)) {
      return next(errors.badRequest("Invalid event id"));
    }

    const event = await Event.findById(req.params.id)
      .populate("organizerId", "organizerName email accountStatus")
      .lean();

    if (!event) {
      return next(errors.notFound("Event not found"));
    }

    if (event.status === "DRAFT") {
      return next(errors.notFound("Event not found"));
    }

    const organizerStatus = event.organizerId?.accountStatus || "ACTIVE";
    if (!event.organizerId || organizerStatus !== "ACTIVE") {
      return next(errors.notFound("Event not available"));
    }

    const status = await appendBlockingStatusForEvent(
      event,
      req.user._id,
      req.user.role
    );

    return res.status(200).json({
      event: {
        ...getBaseEventSummary(event),
        customFormSchema: event.customFormSchema || [],
        items: event.items || [],
        ...status,
      },
    });
  } catch (err) {
    return handleControllerError(err, next);
  }
};

// POST /api/events/:id/register
export const registerForEvent = async (req, res, next) => {
  let uploadedFileIds = [];
  try {
    if (!isParticipantRole(req.user.role)) {
      return next(errors.forbidden("Only participants can register"));
    }

    const event = await getEventForParticipantOr404(req.params.id);
    if (event.type !== "NORMAL") {
      return next(errors.badRequest("Use purchase endpoint for merchandise events"));
    }

    assertEventOpen(event);
    assertParticipantEligibility(event, req.user.role);
    await assertCapacityAvailable(event._id, event.registrationLimit);
    await assertNoExistingRegistration(req.user._id, event._id);

    const baseResponses = parseResponsesInput(req.body.responses);
    const { fileResponses, uploadedFileIds: newUploadedFileIds } = await buildFileResponsesFromUpload(
      event,
      req.files,
      req.user._id
    );
    uploadedFileIds = newUploadedFileIds;
    const responses = validateNormalResponses(event, {
      ...baseResponses,
      ...fileResponses,
    });
    const teamName =
      typeof req.body.teamName === "string" && req.body.teamName.trim()
        ? req.body.teamName.trim()
        : undefined;

    let registration = null;
    let ticket = null;
    let email = null;

    try {
      registration = await Registration.create({
        participantId: req.user._id,
        eventId: event._id,
        status: "REGISTERED",
        teamName,
        responses,
      });

      ticket = await createTicketForRegistration(registration);
      email = await sendTicketEmailStrict({
        participantId: req.user._id,
        event,
        registration,
        ticket,
        flow: "registration",
      });
    } catch (flowErr) {
      if (ticket?._id) {
        await Ticket.findByIdAndDelete(ticket._id);
      }
      if (registration?._id) {
        await Registration.findByIdAndDelete(registration._id);
      }
      await rollbackGridFsFiles(uploadedFileIds);
      uploadedFileIds = [];
      throw flowErr;
    }

    return res.status(201).json({
      message: "Registered successfully",
      registration,
      ticket: {
        ticketId: ticket.ticketId,
      },
      email,
    });
  } catch (err) {
    await rollbackGridFsFiles(uploadedFileIds);
    return handleControllerError(err, next);
  }
};

// POST /api/events/:id/purchase
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

// GET /api/events/files/:registrationId/:fieldId
export const downloadRegistrationFile = async (req, res, next) => {
  try {
    const { registrationId, fieldId } = req.params;
    if (!isObjectId(registrationId)) {
      return next(errors.badRequest("Invalid registration id"));
    }

    const registration = await Registration.findById(registrationId)
      .populate({
        path: "eventId",
        select: "organizerId",
      })
      .lean();

    if (!registration) {
      return next(errors.notFound("Registration not found"));
    }

    const isParticipant = isParticipantRole(req.user.role);
    if (isParticipant) {
      if (String(registration.participantId) !== String(req.user._id)) {
        return next(errors.forbidden("You can access only your own files"));
      }
    } else if (req.user.role === "organizer") {
      const organizerId = registration.eventId?.organizerId;
      if (!organizerId || String(organizerId) !== String(req.user._id)) {
        return next(errors.forbidden("You can access only files for your events"));
      }
    } else if (req.user.role !== "admin") {
      return next(errors.forbidden("You do not have permission"));
    }

    const responses = registration.responses || {};
    const fileMeta = responses[fieldId];
    if (
      !fileMeta ||
      typeof fileMeta !== "object" ||
      Array.isArray(fileMeta) ||
      !fileMeta.fileId
    ) {
      return next(errors.notFound("File not found"));
    }

    const fileInfo = await getGridFSFileInfo(fileMeta.fileId);
    if (!fileInfo) {
      return next(errors.notFound("File not found"));
    }

    const fileName = fileMeta.fileName || fileInfo.filename || "download";
    const contentType =
      fileMeta.mimeType || fileInfo.contentType || "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${String(fileName).replace(/"/g, "")}"`
    );

    const stream = openGridFSDownloadStream(fileMeta.fileId);
    stream.on("error", (err) => next(err));
    return stream.pipe(res);
  } catch (err) {
    return handleControllerError(err, next);
  }
};
