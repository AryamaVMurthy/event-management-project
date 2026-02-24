// Calendar Ics: Module level logic for the feature area.
import crypto from "crypto";

const ICS_LINE_BREAK = "\r\n";

// To Utc Timestamp: Converts date values to a UTC timestamp string. Inputs: value. Returns: a function result.
const toUtcTimestamp = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
};

// Escape Text: Runs Escape text flow. Inputs: value. Returns: a function result.
const escapeText = (value) =>
  String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");

// Fold Line: Runs Fold line flow. Inputs: line. Returns: a function result.
const foldLine = (line) => {
  if (line.length <= 75) {
    return line;
  }

  const chunks = [];
  let remaining = line;
  while (remaining.length > 75) {
    chunks.push(remaining.slice(0, 75));
    remaining = ` ${remaining.slice(75)}`;
  }
  chunks.push(remaining);
  return chunks.join(ICS_LINE_BREAK);
};

// Build Reminder Block: Builds reminder block for response or export. Inputs: reminderMinutes. Returns: a function result.
const buildReminderBlock = (reminderMinutes) => {
  const parsed = Number(reminderMinutes);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return [];
  }

  return [
    "BEGIN:VALARM",
    `TRIGGER:-PT${parsed}M`,
    "ACTION:DISPLAY",
    "DESCRIPTION:Event reminder",
    "END:VALARM",
  ];
};

const buildEventLines = ({
  uid,
  summary,
  description,
  startDate,
  endDate,
  location,
  url,
  createdAt,
  reminderMinutes,
}) => {
  const nowTs = toUtcTimestamp(createdAt || new Date());
  const startTs = toUtcTimestamp(startDate);
  const endTs = toUtcTimestamp(endDate);

  const lines = [
    "BEGIN:VEVENT",
    `UID:${escapeText(uid || crypto.randomUUID())}`,
    `DTSTAMP:${nowTs}`,
    `DTSTART:${startTs}`,
    `DTEND:${endTs}`,
    `SUMMARY:${escapeText(summary || "Event")}`,
  ];

  if (description) {
    lines.push(`DESCRIPTION:${escapeText(description)}`);
  }
  if (location) {
    lines.push(`LOCATION:${escapeText(location)}`);
  }
  if (url) {
    lines.push(`URL:${escapeText(url)}`);
  }

  lines.push(...buildReminderBlock(reminderMinutes));
  lines.push("END:VEVENT");

  return lines;
};

export const formatIcsUtc = toUtcTimestamp;

export const createCalendarIcs = ({
  events,
  calendarName = "Felicity Events",
  reminderMinutes = 30,
}) => {
  if (!Array.isArray(events) || events.length === 0) {
    throw new Error("At least one calendar event is required");
  }

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "PRODID:-//Felicity//Event Management//EN",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ];

  for (const event of events) {
    lines.push(
      ...buildEventLines({
        ...event,
        reminderMinutes,
      })
    );
  }

  lines.push("END:VCALENDAR");

  return `${lines.map(foldLine).join(ICS_LINE_BREAK)}${ICS_LINE_BREAK}`;
};
