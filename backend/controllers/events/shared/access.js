// Access: Controller level logic for the feature area.
import mongoose from "mongoose";
import { Event } from "../../../models/Event.js";
import { Registration } from "../../../models/Registration.js";
import { errors } from "../../../utils/Errors.js";
import { isParticipantRole } from "./eligibility.js";

// Is Object Id: Checks whether a supplied string is a valid MongoDB ObjectId. Inputs: value. Returns: a function result.
export const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

// Get Event Or404: Loads an event record and throws a 404-style domain error when absent. Inputs: eventId. Returns: a Promise with payload data.
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

// Assert Organizer Owns Event: Guards mutate/read actions with owner-based access checks. Inputs: event, reqUserId. Returns: a function result.
export const assertOrganizerOwnsEvent = (event, reqUserId) => {
  if (String(event.organizerId) !== String(reqUserId)) {
    throw errors.forbidden("You can only manage your own events");
  }
};

// Get Event For Organizer Or Admin Or404: Gets event for organizer or admin or404 from persistence or request payload. Inputs: eventId, reqUser. Returns: a Promise with payload data.
export const getEventForOrganizerOrAdminOr404 = async (eventId, reqUser) => {
  const event = await getEventOr404(eventId);
  if (reqUser.role === "admin") {
    return event;
  }
  assertOrganizerOwnsEvent(event, reqUser._id);
  return event;
};

// Get Event For Participant Or404: Gets event for participant or404 from persistence or request payload. Inputs: eventId. Returns: a Promise with payload data.
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

// Get Organizer Event Or404: Loads an organizer event and validates visibility to the owner. Inputs: eventId, organizerId. Returns: a Promise with payload data.
export const getOrganizerEventOr404 = async (eventId, organizerId) => {
  const event = await getEventOr404(eventId);
  assertOrganizerOwnsEvent(event, organizerId);
  return event;
};

// Get Registration For File Access Or404: Loads a registration to authorize file-access operations. Inputs: registrationId, reqUser. Returns: a Promise with payload data.
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
