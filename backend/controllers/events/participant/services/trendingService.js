import { Event } from "../../../../models/Event.js";
import { Registration } from "../../../../models/Registration.js";
import { getBaseEventSummary } from "../../shared/index.js";

export const normalizeTag = (value) => String(value || "").trim().toLowerCase();

export const getTrendingEvents = async () => {
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
