// Categories Controller: Controller level logic for the feature area.
import { OrganizationCategory } from "../../models/User.js";

// Get Admin Categories: Lists all categories for admin management UI. Inputs: req, res, next. Returns: a Promise with payload data.
export const getAdminCategories = async (req, res, next) => {
  try {
    const categories = await OrganizationCategory.find().sort({ name: 1 });
    return res.status(200).json({ categories });
  } catch (err) {
    return next(err);
  }
};
