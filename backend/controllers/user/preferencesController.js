// Preferences Controller: Controller level logic for the feature area.
import { User, Interest, Organizer } from "../../models/User.js";
import { errors } from "../../utils/Errors.js";
import { toUniqueIdStrings } from "./utils.js";

// Update Interests: Persists selected interests for the current user. Inputs: req, res, next. Returns: side effects and response to caller.
export const updateInterests = async (req, res, next) => {
  try {
    const user = req.user;

    if (user.role !== "IIIT_PARTICIPANT" && user.role !== "NON_IIIT_PARTICIPANT") {
      return next(errors.forbidden("Only participants can update interests"));
    }

    const { interests } = req.body;

    if (!Array.isArray(interests)) {
      return next(errors.badRequest("Interests must be an array"));
    }

    const normalizedInterests = toUniqueIdStrings(interests);

    if (normalizedInterests.length > 0) {
      const validInterests = await Interest.find({
        _id: { $in: normalizedInterests },
        isActive: true,
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
      user: updatedUser,
    });
  } catch (err) {
    return next(err);
  }
};

// Update Followed Clubs: Persists selected followed clubs for the current user. Inputs: req, res, next. Returns: side effects and response to caller.
export const updateFollowedClubs = async (req, res, next) => {
  try {
    const user = req.user;

    if (user.role !== "IIIT_PARTICIPANT" && user.role !== "NON_IIIT_PARTICIPANT") {
      return next(errors.forbidden("Only participants can follow clubs"));
    }

    const { followedClubs } = req.body;

    if (!Array.isArray(followedClubs)) {
      return next(errors.badRequest("Followed clubs must be an array"));
    }

    const normalizedFollowedClubs = toUniqueIdStrings(followedClubs);

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
      user: updatedUser,
    });
  } catch (err) {
    return next(err);
  }
};
