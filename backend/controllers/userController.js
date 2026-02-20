// backend/controllers/userController.js
import bcrypt from "bcryptjs";
import { User, Interest, Organizer, OrganizationCategory } from "../models/User.js";
import { Registration } from "../models/Registration.js";
import { Ticket } from "../models/Ticket.js";
import { errors } from "../utils/Errors.js";

const toUniqueIdStrings = (values = []) =>
  [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];

// GET /api/user/me - Get current user profile
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    
    if (!user) {
      return next(errors.notFound("User not found"));
    }
    
    return res.status(200).json({ user });
  } catch (err) {
    return next(err);
  }
};

// GET /api/user/my-events - Get participant dashboard event data
export const getMyEvents = async (req, res, next) => {
  try {
    const isParticipant =
      req.user.role === "IIIT_PARTICIPANT" || req.user.role === "NON_IIIT_PARTICIPANT";

    if (!isParticipant) {
      return next(errors.forbidden("Only participants can access my events"));
    }

    const registrations = await Registration.find({ participantId: req.user._id })
      .populate({
        path: "eventId",
        select: "name type organizerId startDate endDate",
        populate: {
          path: "organizerId",
          select: "organizerName email",
        },
      })
      .sort({ registeredAt: -1 })
      .lean();

    const registrationIds = registrations.map((registration) => registration._id);

    const tickets = registrationIds.length
      ? await Ticket.find({ registrationId: { $in: registrationIds } })
          .select("registrationId ticketId")
          .lean()
      : [];

    const ticketMap = new Map(
      tickets.map((ticket) => [String(ticket.registrationId), ticket.ticketId])
    );

    const now = new Date();

    const records = registrations.map((registration) => {
      const event = registration.eventId;
      const organizer = event?.organizerId;

      return {
        registrationId: String(registration._id),
        eventId: event?._id ? String(event._id) : null,
        eventName: event?.name ?? null,
        eventType: event?.type || null,
        organizerName: organizer?.organizerName ?? organizer?.email ?? null,
        schedule: {
          startDate: event?.startDate || null,
          endDate: event?.endDate || null,
        },
        participationStatus: registration.status,
        teamName: registration.teamName || null,
        ticketId: ticketMap.get(String(registration._id)) || null,
        registeredAt: registration.registeredAt,
      };
    });

    const upcomingEvents = records.filter((record) => {
      if (record.participationStatus !== "REGISTERED" || !record.schedule.startDate) {
        return false;
      }
      return new Date(record.schedule.startDate) > now;
    });

    const historyRows = records.filter((record) => !upcomingEvents.includes(record));

    const history = {
      normal: historyRows.filter(
        (record) =>
          record.eventType === "NORMAL" &&
          !["COMPLETED", "CANCELLED", "REJECTED"].includes(record.participationStatus)
      ),
      merchandise: historyRows.filter(
        (record) =>
          record.eventType === "MERCHANDISE" &&
          !["COMPLETED", "CANCELLED", "REJECTED"].includes(record.participationStatus)
      ),
      completed: historyRows.filter((record) => record.participationStatus === "COMPLETED"),
      cancelledRejected: historyRows.filter((record) =>
        ["CANCELLED", "REJECTED"].includes(record.participationStatus)
      ),
    };

    return res.status(200).json({
      upcomingEvents,
      history,
    });
  } catch (err) {
    return next(err);
  }
};


// PUT /api/user/profile - Update user profile
export const updateProfile = async (req, res, next) => {
  try {
    const user = req.user;
    const currentUser = await User.findById(user._id);
    if (!currentUser) {
      return next(errors.notFound("User not found"));
    }
    
    // Common fields for all users (none except password which is handled separately)
    
    // Participant-specific fields
    if (user.role === "IIIT_PARTICIPANT" || user.role === "NON_IIIT_PARTICIPANT") {
      const { firstName, lastName, contactNumber, collegeOrgName, batch } = req.body;
      
      if (firstName !== undefined) currentUser.firstName = firstName;
      if (lastName !== undefined) currentUser.lastName = lastName;
      if (contactNumber !== undefined) currentUser.contactNumber = contactNumber;
      if (collegeOrgName !== undefined) currentUser.collegeOrgName = collegeOrgName;
      if (batch !== undefined && user.role === "IIIT_PARTICIPANT") currentUser.batch = batch;
    }
    
    // Organizer-specific fields
    if (user.role === "organizer") {
      const { organizerName, description, contactNumber, category, discordWebhookUrl } = req.body;
      
      if (organizerName !== undefined) currentUser.organizerName = organizerName;
      if (description !== undefined) currentUser.description = description;
      if (contactNumber !== undefined) currentUser.contactNumber = contactNumber;
      if (category !== undefined) {
        const existingCategory = await OrganizationCategory.findById(category);
        if (!existingCategory) {
          return next(errors.badRequest("Invalid category"));
        }
        currentUser.category = category;
      }
      if (discordWebhookUrl !== undefined) {
        const value = String(discordWebhookUrl || "").trim();
        if (!value) {
          currentUser.discordWebhookUrl = "";
        } else {
          try {
            const parsed = new URL(value);
            if (parsed.protocol !== "https:") {
              return next(errors.badRequest("discordWebhookUrl must use https"));
            }
            currentUser.discordWebhookUrl = value;
          } catch {
            return next(errors.badRequest("discordWebhookUrl must be a valid URL"));
          }
        }
      }
    }

    await currentUser.save();
    const updatedUser = await User.findById(user._id).select("-password");
    
    return res.status(200).json({
      message: "Profile updated successfully",
      user: updatedUser
    });
  } catch (err) {
    return next(err);
  }
};

// PUT /api/user/interests - Update user's interests
// Only for Participants (IIIT_PARTICIPANT, NON_IIIT_PARTICIPANT)

export const updateInterests = async (req, res, next) => {
  try {
    const user = req.user;
    
    // Check if user is a participant
    if (user.role !== "IIIT_PARTICIPANT" && user.role !== "NON_IIIT_PARTICIPANT") {
      return next(errors.forbidden("Only participants can update interests"));
    }
    
    const { interests } = req.body;
    
    if (!Array.isArray(interests)) {
      return next(errors.badRequest("Interests must be an array"));
    }

    const normalizedInterests = toUniqueIdStrings(interests);
    
    // Validate that all interest IDs exist
    if (normalizedInterests.length > 0) {
      const validInterests = await Interest.find({ 
        _id: { $in: normalizedInterests },
        isActive: true 
      });
      
      if (validInterests.length !== normalizedInterests.length) {
        return next(errors.badRequest("One or more interest IDs are invalid or inactive"));
      }
    }

    const currentUser = await User.findById(user._id);
    if (!currentUser) {
      return next(errors.notFound("User not found"));
    }

    currentUser.interests = normalizedInterests;
    await currentUser.save();
    const updatedUser = await User.findById(user._id).select("-password");
    
    return res.status(200).json({
      message: "Interests updated successfully",
      user: updatedUser
    });
  } catch (err) {
    return next(err);
  }
};

// PUT /api/user/followed-clubs - Update user's followed clubs
// Only for Participants (IIIT_PARTICIPANT, NON_IIIT_PARTICIPANT)
export const updateFollowedClubs = async (req, res, next) => {
  try {
    const user = req.user;
    
    // Check if user is a participant
    if (user.role !== "IIIT_PARTICIPANT" && user.role !== "NON_IIIT_PARTICIPANT") {
      return next(errors.forbidden("Only participants can follow clubs"));
    }
    
    const { followedClubs } = req.body;
    
    if (!Array.isArray(followedClubs)) {
      return next(errors.badRequest("Followed clubs must be an array"));
    }

    const normalizedFollowedClubs = toUniqueIdStrings(followedClubs);
    
    // Validate that all club IDs exist
    if (normalizedFollowedClubs.length > 0) {
      const validClubs = await Organizer.find({ _id: { $in: normalizedFollowedClubs } });
      
      if (validClubs.length !== normalizedFollowedClubs.length) {
        return next(errors.badRequest("One or more club IDs are invalid"));
      }
    }

    const currentUser = await User.findById(user._id);
    if (!currentUser) {
      return next(errors.notFound("User not found"));
    }

    currentUser.followedClubs = normalizedFollowedClubs;
    await currentUser.save();
    const updatedUser = await User.findById(user._id).select("-password");
    
    return res.status(200).json({
      message: "Followed clubs updated successfully",
      user: updatedUser
    });
  } catch (err) {
    return next(err);
  }
};

// PUT /api/user/password - Change user password
// Works for all roles
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return next(errors.badRequest("Current password and new password are required"));
    }
    
    if (newPassword.length < 6) {
      return next(errors.badRequest("New password must be at least 6 characters"));
    }
    
    // Get user with password
    const user = await User.findById(req.user._id).select("+password");
    
    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return next(errors.unauthorized("Current password is incorrect"));
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    await User.findByIdAndUpdate(req.user._id, { password: hashedPassword });
    
    return res.status(200).json({ message: "Password changed successfully" });
  } catch (err) {
    return next(err);
  }
};
