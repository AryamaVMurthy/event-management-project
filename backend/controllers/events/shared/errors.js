import { z } from "zod";
import { errors } from "../../../utils/Errors.js";

export const handleControllerError = (err, next) => {
  if (err instanceof z.ZodError) {
    const message = err.issues?.[0]?.message || "Validation error";
    return next(errors.badRequest(message));
  }
  return next(err);
};
