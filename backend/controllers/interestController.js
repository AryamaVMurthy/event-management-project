// backend/controllers/interestController.js
// Interest Controller: Controller level logic for the feature area.
import { Interest } from "../models/User.js";
import { errors } from "../utils/Errors.js";

// Get All Interests: Returns all interest entries. Inputs: req, res, next. Returns: a Promise with payload data.
export const getAllInterests = async (req, res, next) => {
  try {
    const interests = await Interest.find({ isActive: true });
    return res.status(200).json({ interests });
  } catch (err) {
    return next(err);
  }
};

// POST /api/interests
// Create Interest: Creates a new interest taxonomy entry. Inputs: req, res, next. Returns: side effects and response to caller.
export const createInterest = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const normalizedName = String(name || "").trim();
    if (!normalizedName) {
      return next(errors.badRequest("Interest name is required"));
    }

    const existing = await Interest.findOne({ name: normalizedName });
    if (existing) {
      return next(errors.conflict("Interest already exists"));
    }

    const interest = await Interest.create({
      name: normalizedName,
      description,
      isActive: true,
    });

    return res.status(201).json({ interest });
  } catch (err) {
    return next(err);
  }
};

// Update Interest: Updates interest metadata. Inputs: req, res, next. Returns: side effects and response to caller.
export const updateInterest = async (req, res, next) => {
  try {
    const { name, description, isActive } = req.body;
    const update = {};

    if (name !== undefined) {
      const normalizedName = String(name).trim();
      if (!normalizedName) {
        return next(errors.badRequest("Interest name cannot be empty"));
      }
      update.name = normalizedName;
    }
    if (description !== undefined) update.description = description;
    if (isActive !== undefined) {
      if (typeof isActive !== "boolean") {
        return next(errors.badRequest("isActive must be true or false"));
      }
      update.isActive = isActive;
    }

    const interest = await Interest.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });

    if (!interest) {
      return next(errors.notFound("Interest not found"));
    }

    return res.status(200).json({ interest });
  } catch (err) {
    return next(err);
  }
};

// Delete Interest: Deletes an interest taxonomy record. Inputs: req, res, next. Returns: side effects and response to caller.
export const deleteInterest = async (req, res, next) => {
  try {
    const interest = await Interest.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!interest) {
      return next(errors.notFound("Interest not found"));
    }

    return res.status(200).json({ message: "Interest deleted" });
  } catch (err) {
    return next(err);
  }
};
