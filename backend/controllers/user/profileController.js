import { User, OrganizationCategory } from "../../models/User.js";
import { errors } from "../../utils/Errors.js";

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

export const updateProfile = async (req, res, next) => {
  try {
    const user = req.user;
    const currentUser = await User.findById(user._id);
    if (!currentUser) {
      return next(errors.notFound("User not found"));
    }

    if (user.role === "IIIT_PARTICIPANT" || user.role === "NON_IIIT_PARTICIPANT") {
      const { firstName, lastName, contactNumber, collegeOrgName, batch } = req.body;

      if (firstName !== undefined) currentUser.firstName = firstName;
      if (lastName !== undefined) currentUser.lastName = lastName;
      if (contactNumber !== undefined) currentUser.contactNumber = contactNumber;
      if (collegeOrgName !== undefined) currentUser.collegeOrgName = collegeOrgName;
      if (batch !== undefined && user.role === "IIIT_PARTICIPANT") currentUser.batch = batch;
    }

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
      user: updatedUser,
    });
  } catch (err) {
    return next(err);
  }
};
