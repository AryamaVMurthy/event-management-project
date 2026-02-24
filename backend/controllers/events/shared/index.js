// Index: Controller level logic for the feature area.
export {
  isObjectId,
  getEventOr404,
  assertOrganizerOwnsEvent,
  getEventForOrganizerOrAdminOr404,
  getEventForParticipantOr404,
  getOrganizerEventOr404,
  getRegistrationForFileAccessOr404,
} from "./access.js";

export {
  canEditFieldInPublished,
  normalizeCreatePayload,
  normalizeUpdatePayload,
} from "./payloadNormalization.js";

export {
  listEventsQuerySchema,
  parseListEventsQuery,
  fuzzyTokenSearchWithFuse,
} from "./queryAndSearch.js";

export {
  isParticipantRole,
  getEligibilityBlockedReason,
  getBaseEventSummary,
  appendBlockingStatusForEvent,
  assertEventOpen,
  assertParticipantEligibility,
  assertCapacityAvailable,
  assertNoExistingRegistration,
} from "./eligibility.js";

export {
  validateNormalResponses,
  collectFileIdsFromResponses,
  getRegistrationFilesFromResponses,
} from "./registrationValidation.js";

export { createTicketForRegistration } from "./ticketing.js";

export { buildParticipantRows, toCsv } from "./participantsTable.js";

export { handleControllerError } from "./errors.js";
