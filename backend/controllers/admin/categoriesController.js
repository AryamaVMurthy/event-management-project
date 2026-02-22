import { OrganizationCategory } from "../../models/User.js";

export const getAdminCategories = async (req, res, next) => {
  try {
    const categories = await OrganizationCategory.find().sort({ name: 1 });
    return res.status(200).json({ categories });
  } catch (err) {
    return next(err);
  }
};
