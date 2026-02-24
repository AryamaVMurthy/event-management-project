// Errors: Controller level logic for the feature area.
import { z } from "zod";
import { errors } from "../../../utils/Errors.js";

// Handle Controller Error: Handles controller error in the UI flow. Inputs: err, next. Returns: side effects and response to caller.
export const handleControllerError = (err, next) => {
  if (err instanceof z.ZodError) {
    const message = err.issues?.[0]?.message || "Validation error";
    return next(errors.badRequest(message));
  }
  return next(err);
};
