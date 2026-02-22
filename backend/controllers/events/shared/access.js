import mongoose from "mongoose";
import { Event } from "../../../models/Event.js";
import { Registration } from "../../../models/Registration.js";
import { errors } from "../../../utils/Errors.js";
import { isParticipantRole } from "./eligibility.js";

export const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

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

export const getEventForOrganizerOrAdminOr404 = async (eventId, reqUser) => {
  const event = await getEventOr404(eventId);
  if (reqUser.role === "admin") {
    return event;
  }
  assertOrganizerOwnsEvent(event, reqUser._id);
  return event;
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

export const getOrganizerEventOr404 = async (eventId, organizerId) => {
  const event = await getEventOr404(eventId);
  assertOrganizerOwnsEvent(event, organizerId);
  return event;
};

export const getRegistrationForFileAccessOr404 = async (registrationId, reqUser) => {
  if (!isObjectId(registrationId)) {
    throw errors.badRequest("Invalid registration id");
  }

  const registration = await Registration.findById(registrationId)
    .populate({
      path: "eventId",
      select: "organizerId customFormSchema",
    })
    .lean();

  if (!registration) {
    throw errors.notFound("Registration not found");
  }

  if (isParticipantRole(reqUser.role)) {
    if (String(registration.participantId) !== String(reqUser._id)) {
      throw errors.forbidden("You can access only your own files");
    }
    return registration;
  }

  if (reqUser.role === "organizer") {
    const organizerId = registration.eventId?.organizerId;
    if (!organizerId || String(organizerId) !== String(reqUser._id)) {
      throw errors.forbidden("You can access only files for your events");
    }
    return registration;
  }

  if (reqUser.role === "admin") {
    return registration;
  }

  throw errors.forbidden("You do not have permission");
};
