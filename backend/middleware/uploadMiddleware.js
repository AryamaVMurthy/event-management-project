import multer from "multer";
import { errors } from "../utils/Errors.js";
import { env } from "../config/env.js";

const MAX_UPLOAD_MB = env.MAX_UPLOAD_MB;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_MB * 1024 * 1024,
    files: 20,
  },
});

export const uploadRegistrationFiles = upload.any();

export const handleUploadError = (err, req, res, next) => {
  if (!err) return next();
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return next(errors.badRequest(`File too large. Max allowed size is ${MAX_UPLOAD_MB} MB`));
    }
    return next(errors.badRequest(err.message));
  }
  return next(err);
};
