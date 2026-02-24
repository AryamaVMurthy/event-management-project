// Discord Webhook: Module level logic for the feature area.
import { errors } from "./Errors.js";

// Post New Event To Discord: Runs Post new event to discord flow. Inputs: {, organizerName, event. Returns: a function result.
export const postNewEventToDiscord = async ({ webhookUrl, organizerName, event }) => {
  const url = String(webhookUrl || "").trim();
  if (!url) return;

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw errors.badRequest("Invalid Discord webhook URL");
  }

  if (parsed.protocol !== "https:") {
    throw errors.badRequest("Discord webhook URL must be https");
  }

  const lines = [
    `New event published by ${organizerName || "Organizer"}`,
    `Name: ${event.name}`,
    `Type: ${event.type}`,
    `Eligibility: ${event.eligibility}`,
    `Registration Deadline: ${new Date(event.registrationDeadline).toLocaleString()}`,
    `Start: ${new Date(event.startDate).toLocaleString()}`,
    `End: ${new Date(event.endDate).toLocaleString()}`,
  ];

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: lines.join("\n") }),
    });
  } catch {
    throw errors.badRequest("Discord webhook delivery failed");
  }

  if (!response.ok) {
    throw errors.badRequest("Discord webhook delivery failed");
  }
};
