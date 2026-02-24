// File Access Controller: Controller level logic for the feature area.
import { errors } from "../../../utils/Errors.js";
import {
  getGridFSFileInfo,
  openGridFSDownloadStream,
} from "../../../utils/gridfs.js";
import {
  handleControllerError,
  getRegistrationForFileAccessOr404,
  getRegistrationFilesFromResponses,
} from "../shared/index.js";

// List Registration Files: Lists registration files for display and action. Inputs: req, res, next. Returns: a function result.
export const listRegistrationFiles = async (req, res, next) => {
  try {
    const { registrationId } = req.params;
    const registration = await getRegistrationForFileAccessOr404(registrationId, req.user);
    const files = getRegistrationFilesFromResponses(registration).map((file) => ({
      fieldId: file.fieldId,
      label: file.label,
      fileName: file.fileName || file.label,
      mimeType: file.mimeType || "application/octet-stream",
      size: file.size,
    }));

    return res.status(200).json({
      registrationId: String(registration._id),
      eventId: registration.eventId?._id
        ? String(registration.eventId._id)
        : String(registration.eventId),
      files,
    });
  } catch (err) {
    return handleControllerError(err, next);
  }
};

// Download Registration File: Downloads registration-scoped uploaded documents. Inputs: req, res, next. Returns: a function result.
export const downloadRegistrationFile = async (req, res, next) => {
  try {
    const { registrationId, fieldId } = req.params;
    const registration = await getRegistrationForFileAccessOr404(registrationId, req.user);
    const files = getRegistrationFilesFromResponses(registration);
    const fileMeta = files.find((file) => file.fieldId === String(fieldId));

    if (!fileMeta) {
      return next(errors.notFound("File not found"));
    }

    const fileInfo = await getGridFSFileInfo(fileMeta.fileId);
    if (!fileInfo) {
      return next(errors.notFound("File not found"));
    }

    const fileName = fileMeta.fileName || fileInfo.filename || "download";
    const contentType = fileMeta.mimeType || fileInfo.contentType || "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${String(fileName).replace(/"/g, "")}"`
    );

    const stream = openGridFSDownloadStream(fileMeta.fileId);
    stream.on("error", (err) => next(err));
    return stream.pipe(res);
  } catch (err) {
    return handleControllerError(err, next);
  }
};
