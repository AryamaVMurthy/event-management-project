// Uploaded Responses Service: Controller level logic for the feature area.
import { errors } from "../../../../utils/Errors.js";
import {
  uploadBufferToGridFS,
  deleteGridFSFile,
} from "../../../../utils/gridfs.js";

// Parse Responses Input: Parses responses payload for dynamic custom field submissions. Inputs: rawResponses. Returns: a function result.
export const parseResponsesInput = (rawResponses) => {
  if (rawResponses === undefined || rawResponses === null || rawResponses === "") {
    return {};
  }

  if (typeof rawResponses === "string") {
    try {
      const parsed = JSON.parse(rawResponses);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Invalid responses format");
      }
      return parsed;
    } catch {
      throw errors.badRequest("responses must be valid JSON object");
    }
  }

  if (typeof rawResponses === "object" && !Array.isArray(rawResponses)) {
    return rawResponses;
  }

  throw errors.badRequest("responses must be an object");
};

// Validate Uploaded File For Field: Validates file response size/type for one dynamic form field. Inputs: field, file. Returns: a function result.
const validateUploadedFileForField = (field, file) => {
  const allowed = Array.isArray(field.allowedMimeTypes)
    ? field.allowedMimeTypes.filter(Boolean)
    : [];
  if (allowed.length > 0 && !allowed.includes(file.mimetype)) {
    throw errors.badRequest(`${field.label} file type is not allowed`);
  }

  const maxBytes = Number(field.maxFileSizeMB || 5) * 1024 * 1024;
  if (file.size > maxBytes) {
    throw errors.badRequest(`${field.label} file exceeds max size limit`);
  }
};

// Build File Responses From Upload: Builds file responses from upload for response or export. Inputs: event, files, participantId. Returns: a function result.
export const buildFileResponsesFromUpload = async (event, files, participantId) => {
  const fileFields = (event.customFormSchema || []).filter((field) => field.type === "file");
  if (fileFields.length === 0 || !Array.isArray(files) || files.length === 0) {
    return { fileResponses: {}, uploadedFileIds: [] };
  }

  const supportedFieldNames = new Set();
  for (const field of fileFields) {
    supportedFieldNames.add(field.id);
    supportedFieldNames.add(`file_${field.id}`);
  }

  for (const file of files) {
    if (!supportedFieldNames.has(file.fieldname)) {
      throw errors.badRequest(`Unexpected file field: ${file.fieldname}`);
    }
  }

  const fileResponses = {};
  const uploadedFileIds = [];

  for (const field of fileFields) {
    const file =
      files.find((item) => item.fieldname === field.id) ||
      files.find((item) => item.fieldname === `file_${field.id}`);
    if (!file) continue;

    validateUploadedFileForField(field, file);

    const uploaded = await uploadBufferToGridFS({
      buffer: file.buffer,
      filename: file.originalname,
      contentType: file.mimetype,
      metadata: {
        fieldId: field.id,
        participantId: String(participantId),
        eventId: String(event._id),
      },
    });

    const fileId = String(uploaded.fileId);
    uploadedFileIds.push(fileId);

    fileResponses[field.id] = {
      kind: "file",
      fileId,
      fileName: uploaded.fileName,
      mimeType: uploaded.mimeType,
      size: uploaded.size,
    };
  }

  return { fileResponses, uploadedFileIds };
};

// Rollback Grid Fs Files: Runs Rollback grid fs files flow. Inputs: fileIds. Returns: a function result.
export const rollbackGridFsFiles = async (fileIds) => {
  const safeIds = [...new Set((fileIds || []).map((id) => String(id)).filter(Boolean))];
  for (const fileId of safeIds) {
    try {
      await deleteGridFSFile(fileId);
    } catch (err) {
      console.error("Failed to rollback GridFS file:", fileId, err.message);
    }
  }
};
