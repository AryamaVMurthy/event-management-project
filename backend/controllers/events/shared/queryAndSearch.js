// Query And Search: Controller level logic for the feature area.
import Fuse from "fuse.js";
import { z } from "zod";
import { ELIGIBILITY_TYPES, EVENT_TYPES } from "../../../models/constants.js";

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

// Parse List Events Query: Parses list query parameters into typed filters. Inputs: query. Returns: a function result.
export const parseListEventsQuery = (query) => listEventsQuerySchema.parse(query);

// To Search Blob: ToSearchBlob. Converts search blob into a new representation. Inputs: event. Returns: a function result.
const toSearchBlob = (event) =>
  `${String(event.name || "")} ${String(event.organizerId?.organizerName || "")}`
    .trim()
    .toLowerCase();

// Fuzzy Token Search With Fuse: Runs Fuzzy token search with fuse flow. Inputs: events, searchText. Returns: a function result.
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
