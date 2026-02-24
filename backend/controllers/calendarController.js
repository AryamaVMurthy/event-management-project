// Calendar Controller: Controller level logic for the feature area.
import mongoose from "mongoose";
import { Registration } from "../models/Registration.js";
import { errors } from "../utils/Errors.js";
import { createCalendarIcs, formatIcsUtc } from "../utils/calendarIcs.js";

const PARTICIPANT_ROLES = new Set(["IIIT_PARTICIPANT", "NON_IIIT_PARTICIPANT"]);

const encode = encodeURIComponent;

// Assert Participant Role: Asserts participant role for safe execution. Inputs: role. Returns: a function result.
const assertParticipantRole = (role) => {
  if (!PARTICIPANT_ROLES.has(role)) {
    throw errors.forbidden("Only participants can access calendar exports");
  }
};

// Assert Valid Object Id: Asserts valid object id for safe execution. Inputs: value, fieldName. Returns: a function result.
const assertValidObjectId = (value, fieldName) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw errors.badRequest(`Invalid ${fieldName}`);
  }
};

// Get Owned Registration Or Throw: Loads a registration and verifies participant ownership. Inputs: registrationId, reqUser. Returns: a Promise with payload data.
const getOwnedRegistrationOrThrow = async (registrationId, reqUser) => {
  assertParticipantRole(reqUser.role);
  assertValidObjectId(registrationId, "registration id");

  const registration = await Registration.findById(registrationId).populate({
    path: "eventId",
    select: "name description startDate endDate organizerId",
    populate: {
      path: "organizerId",
      select: "organizerName email",
    },
  });

  if (!registration) {
    throw errors.notFound("Registration not found");
  }

  if (String(registration.participantId) !== String(reqUser._id)) {
    throw errors.forbidden("You can only access your own event calendar");
  }

  if (!registration.eventId) {
    throw errors.notFound("Event not found");
  }

  return registration;
};

// Build Event Description: Builds event description for response or export. Inputs: event. Returns: a function result.
const buildEventDescription = (event) => {
  const organizerName =
    event.organizerId?.organizerName || event.organizerId?.email || "Unknown organizer";
  return `${event.description || ""}\nOrganizer: ${organizerName}`.trim();
};

// To Calendar Entry: Converts an event/registration pair to a calendar event object. Inputs: registration. Returns: a function result.
const toCalendarEntry = (registration) => ({
  uid: `registration-${registration._id}@felicity.iiit.ac.in`,
  summary: registration.eventId?.name || "Felicity Event",
  description: buildEventDescription(registration.eventId),
  startDate: registration.eventId?.startDate,
  endDate: registration.eventId?.endDate,
  createdAt: registration.createdAt,
});

// Parse Reminder Minutes: Converts reminder string into validated number of minutes. Inputs: value. Returns: a function result.
const parseReminderMinutes = (value) => {
  if (value === undefined || value === null || value === "") {
    return 30;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10080) {
    throw errors.badRequest("reminderMinutes must be an integer between 1 and 10080");
  }
  return parsed;
};

// Parse Registration Ids Query: Parses registration IDs from query string into arrays. Inputs: rawValue. Returns: a function result.
const parseRegistrationIdsQuery = (rawValue) => {
  const value = String(rawValue || "").trim();
  if (!value) {
    throw errors.badRequest("registrationIds query parameter is required");
  }
  const ids = [...new Set(value.split(",").map((entry) => entry.trim()).filter(Boolean))];
  if (ids.length === 0) {
    throw errors.badRequest("registrationIds query parameter is required");
  }
  for (const id of ids) {
    assertValidObjectId(id, "registration id");
  }
  return ids;
};

// Build Provider Links: Builds provider links for response or export. Inputs: registration. Returns: a function result.
const buildProviderLinks = (registration) => {
  const event = registration.eventId;
  const title = event.name || "Felicity Event";
  const details = buildEventDescription(event);
  const startUtc = formatIcsUtc(event.startDate);
  const endUtc = formatIcsUtc(event.endDate);

  const google =
    "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    `&text=${encode(title)}` +
    `&details=${encode(details)}` +
    `&dates=${encode(`${startUtc}/${endUtc}`)}`;

  const outlook =
    "https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent" +
    `&subject=${encode(title)}` +
    `&body=${encode(details)}` +
    `&startdt=${encode(new Date(event.startDate).toISOString())}` +
    `&enddt=${encode(new Date(event.endDate).toISOString())}`;

  return { google, outlook };
};

// Get Registration Calendar Ics: Builds ICS export payload for one registration window. Inputs: req, res, next. Returns: a Promise with payload data.
export const getRegistrationCalendarIcs = async (req, res, next) => {
  try {
    const registration = await getOwnedRegistrationOrThrow(req.params.registrationId, req.user);
    const event = registration.eventId;

    const ics = createCalendarIcs({
      events: [
        {
          uid: `registration-${registration._id}@felicity.iiit.ac.in`,
          summary: event.name,
          description: buildEventDescription(event),
          startDate: event.startDate,
          endDate: event.endDate,
          createdAt: registration.createdAt,
        },
      ],
      calendarName: "Felicity Registrations",
      reminderMinutes: 30,
    });

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="registration-${String(registration._id)}.ics"`
    );

    return res.status(200).send(ics);
  } catch (err) {
    return next(err);
  }
};

// Get Registration Calendar Links: Builds event calendar links from registration timing metadata. Inputs: req, res, next. Returns: a Promise with payload data.
export const getRegistrationCalendarLinks = async (req, res, next) => {
  try {
    const registration = await getOwnedRegistrationOrThrow(req.params.registrationId, req.user);
    const links = buildProviderLinks(registration);

    return res.status(200).json({
      registrationId: String(registration._id),
      eventId: String(registration.eventId._id),
      links,
    });
  } catch (err) {
    return next(err);
  }
};

// Get My Events Calendar Ics: Gets my events calendar ics from persistence or request payload. Inputs: req, res, next. Returns: a Promise with payload data.
export const getMyEventsCalendarIcs = async (req, res, next) => {
  try {
    assertParticipantRole(req.user.role);

    const registrationIds = parseRegistrationIdsQuery(req.query.registrationIds);
    const reminderMinutes = parseReminderMinutes(req.query.reminderMinutes);

    const registrations = await Registration.find({
      _id: { $in: registrationIds },
      participantId: req.user._id,
    })
      .populate({
        path: "eventId",
        select: "name description startDate endDate organizerId",
        populate: {
          path: "organizerId",
          select: "organizerName email",
        },
      })
      .sort({ startDate: 1 });

    if (registrations.length !== registrationIds.length) {
      return next(errors.forbidden("One or more registrations are not accessible"));
    }

    for (const registration of registrations) {
      if (!registration.eventId) {
        return next(errors.notFound("Event not found"));
      }
    }

    const ics = createCalendarIcs({
      events: registrations.map(toCalendarEntry),
      calendarName: "Felicity My Events",
      reminderMinutes,
    });

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=\"my-events.ics\"");

    return res.status(200).send(ics);
  } catch (err) {
    return next(err);
  }
};
