// Security Controller: Controller level logic for the feature area.
import bcrypt from "bcryptjs";
import { User } from "../../models/User.js";
import { errors } from "../../utils/Errors.js";

// Change Password: Runs Change password flow. Inputs: req, res, next. Returns: a function result.
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return next(errors.badRequest("Current password and new password are required"));
    }

    if (newPassword.length < 6) {
      return next(errors.badRequest("New password must be at least 6 characters"));
    }

    const user = await User.findById(req.user._id).select("+password");

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return next(errors.unauthorized("Current password is incorrect"));
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await User.findByIdAndUpdate(req.user._id, { password: hashedPassword });

    return res.status(200).json({ message: "Password changed successfully" });
  } catch (err) {
    return next(err);
  }
};
