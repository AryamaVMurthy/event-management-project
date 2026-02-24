// Analytics Controller: Controller level logic for the feature area.
import { Registration } from "../../../models/Registration.js";
import {
  handleControllerError,
  getOrganizerEventOr404,
} from "../shared/index.js";

// Get Organizer Event Analytics: Returns event dashboard stats and attendance/registration breakdown. Inputs: req, res, next. Returns: a Promise with payload data.
export const getOrganizerEventAnalytics = async (req, res, next) => {
  try {
    const event = await getOrganizerEventOr404(req.params.id, req.user._id);
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

    const byStatus = {
      REGISTERED: 0,
      CANCELLED: 0,
      REJECTED: 0,
      COMPLETED: 0,
    };
    let teamCompletionCount = 0;
    registrations.forEach((reg) => {
      if (byStatus[reg.status] !== undefined) {
        byStatus[reg.status] += 1;
      }
      if (reg.teamName && reg.status === "COMPLETED") {
        teamCompletionCount += 1;
      }
    });

    const teamCompletionRate =
      registrationsCount === 0 ? 0 : Number(((teamCompletionCount / registrationsCount) * 100).toFixed(2));

    return res.status(200).json({
      analytics: {
        registrations: registrationsCount,
        merchSales: merchSalesCount,
        revenue,
        attendance: attendanceCount,
        byStatus,
        teamCompletionCount,
        teamCompletionRate,
      },
    });
  } catch (err) {
    return handleControllerError(err, next);
  }
};
