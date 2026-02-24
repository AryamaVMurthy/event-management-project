// List Events Controller: Controller level logic for the feature area.
import { Event } from "../../../models/Event.js";
import { User } from "../../../models/User.js";
import { errors } from "../../../utils/Errors.js";
import {
  handleControllerError,
  isParticipantRole,
  getBaseEventSummary,
  parseListEventsQuery,
  fuzzyTokenSearchWithFuse,
  appendBlockingStatusForEvent,
} from "../shared/index.js";
import { getTrendingEvents, normalizeTag } from "./services/trendingService.js";

// List Events: Lists public/personal events based on filters and caller context. Inputs: req, res, next. Returns: a function result.
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
