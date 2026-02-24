// List And Details Controller: Controller level logic for the feature area.
import { Event } from "../../../models/Event.js";
import { Registration } from "../../../models/Registration.js";
import { errors } from "../../../utils/Errors.js";
import {
  handleControllerError,
  isObjectId,
  getEventForOrganizerOrAdminOr404,
} from "../shared/index.js";

// Get Organizer Events: Loads organizer-created events for management screens. Inputs: req, res, next. Returns: a Promise with payload data.
export const getOrganizerEvents = async (req, res, next) => {
  try {
    const isAdmin = req.user.role === "admin";
    let organizerId = String(req.user._id);
    if (isAdmin) {
      organizerId = String(req.query.organizerId || "").trim();
      if (!organizerId) {
        return next(
          errors.badRequest("organizerId query is required for admin event listing")
        );
      }
      if (!isObjectId(organizerId)) {
        return next(errors.badRequest("Invalid organizerId query"));
      }
    }

    const query = { organizerId };
    if (req.query.status) {
      query.status = String(req.query.status).trim();
    }
    if (req.query.q) {
      query.name = { $regex: String(req.query.q).trim(), $options: "i" };
    }

    const events = await Event.find(query)
      .sort({ createdAt: -1 })
      .lean();

    const eventsWithCounts = await Promise.all(
      events.map(async (event) => {
        const registrations = await Registration.find({ eventId: event._id }).lean();

        const registrationsCount = registrations.length;
        const attendanceCount = registrations.filter((reg) => reg.attended).length;
        const merchSalesCount = registrations.filter((reg) => reg.merchPurchase).length;
        const revenue = registrations.reduce((total, reg) => {
          if (reg.merchPurchase?.totalAmount !== undefined) {
            return total + Number(reg.merchPurchase.totalAmount || 0);
          }
          return total + Number(event.registrationFee || 0);
        }, 0);

        return {
          ...event,
          counts: {
            registrations: registrationsCount,
            merchSales: merchSalesCount,
            revenue,
            attendance: attendanceCount,
          },
        };
      })
    );

    const includeCompletedSummary = String(req.query.includeCompletedSummary || "false") === "true";
    const completedSummary = {
      registrations: 0,
      sales: 0,
      revenue: 0,
      attendance: 0,
    };

    if (includeCompletedSummary) {
      for (const event of eventsWithCounts) {
        if (event.status !== "COMPLETED") continue;
        completedSummary.registrations += Number(event.counts.registrations || 0);
        completedSummary.sales += Number(event.counts.merchSales || 0);
        completedSummary.revenue += Number(event.counts.revenue || 0);
        completedSummary.attendance += Number(event.counts.attendance || 0);
      }
    }

    return res.status(200).json({
      events: eventsWithCounts,
      completedSummary,
    });
  } catch (err) {
    return handleControllerError(err, next);
  }
};

// Get Organizer Event Details: Returns composed event details used by organizer screens. Inputs: req, res, next. Returns: a Promise with payload data.
export const getOrganizerEventDetails = async (req, res, next) => {
  try {
    const event = await getEventForOrganizerOrAdminOr404(req.params.id, req.user);
    return res.status(200).json({ event });
  } catch (err) {
    return handleControllerError(err, next);
  }
};
