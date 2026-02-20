// backend/controllers/interestController.js
import { Interest } from "../models/User.js";
import { errors } from "../utils/Errors.js";
import { restrictTo } from "../middleware/authMiddleware.js";

export const getAllInterests = async (req, res, next) => {
  try {
    const interests = await Interest.find({ isActive: true });
    return res.status(200).json({ interests });
  } catch (err) {
    return next(err);
  }
};

export const createInterest = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const interest = await Interest.create({ name, description });
    return res.status(201).json({ interest });
  } catch (err) {
    return next(err);
  }
};

export const updateInterest = async (req, res, next) => {
  try {
    const { name, description, isActive } = req.body;
    const interest = await Interest.findByIdAndUpdate(
      req.params.id,
      { name, description, isActive },
      { new: true, runValidators: true }
    );
    if (!interest) return next(errors.notFound("Interest not found"));
    return res.status(200).json({ interest });
  } catch (err) {
    return next(err);
  }
};

export const deleteInterest = async (req, res, next) => {
  try {
    // Soft delete - set isActive to false incase other users are linked to this interest
    const interest = await Interest.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!interest) return next(errors.notFound("Interest not found"));
    return res.status(200).json({ message: "Interest deleted" });
  } catch (err) {
    return next(err);
  }
};
