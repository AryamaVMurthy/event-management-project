import { errors } from "../../../utils/Errors.js";

export const validateNormalResponses = (event, responses) => {
  const fields = event.customFormSchema || [];
  const safeResponses =
    responses && typeof responses === "object" && !Array.isArray(responses)
      ? responses
      : {};

  for (const field of fields) {
    const value = safeResponses[field.id];
    const isMissing =
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0);

    if (field.required && isMissing) {
      throw errors.badRequest(`${field.label} is required`);
    }

    if (value === undefined || value === null) {
      continue;
    }

    if (field.type === "text") {
      if (typeof value !== "string") {
        throw errors.badRequest(`${field.label} must be text`);
      }
      continue;
    }

    if (field.type === "dropdown") {
      if (typeof value !== "string") {
        throw errors.badRequest(`${field.label} must be a single option`);
      }
      if (!field.options.includes(value)) {
        throw errors.badRequest(`${field.label} has invalid option`);
      }
      continue;
    }

    if (field.type === "checkbox") {
      if (!Array.isArray(value)) {
        throw errors.badRequest(`${field.label} must be a list of options`);
      }
      const hasInvalid = value.some((option) => !field.options.includes(option));
      if (hasInvalid) {
        throw errors.badRequest(`${field.label} has invalid option`);
      }
      continue;
    }

    if (field.type === "file") {
      if (typeof value !== "object" || Array.isArray(value)) {
        throw errors.badRequest(`${field.label} must be a file`);
      }
      const fileName = String(value.fileName || "").trim();
      const fileId = String(value.fileId || "").trim();
      const mimeType = String(value.mimeType || "").trim();
      const size = Number(value.size || 0);

      if (!fileName || !fileId || !mimeType || !Number.isFinite(size) || size < 1) {
        throw errors.badRequest(`${field.label} file data is invalid`);
      }

      const allowed = Array.isArray(field.allowedMimeTypes)
        ? field.allowedMimeTypes.filter(Boolean)
        : [];
      if (allowed.length > 0 && !allowed.includes(mimeType)) {
        throw errors.badRequest(`${field.label} file type is not allowed`);
      }

      const maxBytes = Number(field.maxFileSizeMB || 5) * 1024 * 1024;
      if (size > maxBytes) {
        throw errors.badRequest(`${field.label} file exceeds max size limit`);
      }
    }
  }

  return safeResponses;
};

export const collectFileIdsFromResponses = (responses) => {
  if (!responses || typeof responses !== "object") return [];
  const fileIds = [];
  for (const value of Object.values(responses)) {
    if (value && typeof value === "object" && !Array.isArray(value) && value.fileId) {
      fileIds.push(String(value.fileId));
    }
  }
  return [...new Set(fileIds)];
};

export const getRegistrationFilesFromResponses = (registration) => {
  const responses = registration?.responses || {};
  const schema = Array.isArray(registration?.eventId?.customFormSchema)
    ? registration.eventId.customFormSchema
    : [];
  const fileLabelByFieldId = new Map(
    schema
      .filter((field) => field?.type === "file" && field?.id)
      .map((field) => [String(field.id), String(field.label || field.id)])
  );

  const files = [];
  for (const [fieldId, value] of Object.entries(responses)) {
    if (!value || typeof value !== "object" || Array.isArray(value) || !value.fileId) {
      continue;
    }
    files.push({
      fieldId: String(fieldId),
      label: fileLabelByFieldId.get(String(fieldId)) || String(fieldId),
      fileId: String(value.fileId),
      fileName: String(value.fileName || ""),
      mimeType: String(value.mimeType || ""),
      size: Number(value.size || 0),
    });
  }

  files.sort((left, right) => left.label.localeCompare(right.label));
  return files;
};
