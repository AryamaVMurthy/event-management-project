// Payment Proof Controller: Controller level logic for the feature area.
import { Registration } from "../../../models/Registration.js";
import { MERCH_PAYMENT_STATUSES } from "../../../models/constants.js";
import { errors } from "../../../utils/Errors.js";
import {
  uploadBufferToGridFS,
  deleteGridFSFile,
  getGridFSFileInfo,
  openGridFSDownloadStream,
} from "../../../utils/gridfs.js";
import {
  handleControllerError,
  isObjectId,
  isParticipantRole,
} from "../shared/index.js";

const PAYMENT_PROOF_ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);

// Can Access Payment Proof: Can access payment proof. Inputs: registration, reqUser. Returns: a function result.
const canAccessPaymentProof = (registration, reqUser) => {
  if (isParticipantRole(reqUser.role)) {
    return String(registration.participantId) === String(reqUser._id);
  }

  if (reqUser.role === "organizer") {
    return String(registration.eventId?.organizerId) === String(reqUser._id);
  }

  if (reqUser.role === "admin") {
    return true;
  }

  return false;
};

// Get Registration With Event Or404: Loads registration payload and the linked event, failing if missing. Inputs: registrationId. Returns: a Promise with payload data.
const getRegistrationWithEventOr404 = async (registrationId) => {
  if (!isObjectId(registrationId)) {
    throw errors.badRequest("Invalid registration id");
  }

  const registration = await Registration.findById(registrationId)
    .populate({
      path: "eventId",
      select: "type organizerId",
    })
    .populate("participantId", "firstName lastName email")
    .populate("merchPurchase.reviewedBy", "email role");

  if (!registration) {
    throw errors.notFound("Registration not found");
  }

  if (!registration.eventId) {
    throw errors.notFound("Event not found");
  }

  if (registration.eventId.type !== "MERCHANDISE" || !registration.merchPurchase) {
    throw errors.badRequest("Payment proof is only supported for merchandise orders");
  }

  return registration;
};

// To Proof Metadata: Extracts standardized metadata from stored proof files. Inputs: registration. Returns: a function result.
const toProofMetadata = (registration) => ({
  registrationId: String(registration._id),
  eventId: String(registration.eventId?._id || registration.eventId),
  paymentStatus: registration.merchPurchase?.paymentStatus || "PAYMENT_PENDING",
  paymentProof: registration.merchPurchase?.paymentProof
    ? {
        fileName: registration.merchPurchase.paymentProof.fileName,
        mimeType: registration.merchPurchase.paymentProof.mimeType,
        size: registration.merchPurchase.paymentProof.size,
        uploadedAt: registration.merchPurchase.paymentProof.uploadedAt,
        downloadUrl: `/api/events/registrations/${String(registration._id)}/payment-proof?download=true`,
      }
    : null,
  reviewedAt: registration.merchPurchase?.reviewedAt || null,
  reviewComment: registration.merchPurchase?.reviewComment || "",
  reviewedBy: registration.merchPurchase?.reviewedBy
    ? {
        id: String(registration.merchPurchase.reviewedBy._id),
        email: registration.merchPurchase.reviewedBy.email,
        role: registration.merchPurchase.reviewedBy.role,
      }
    : null,
});

// Assert Participant Owns Registration: Guards operations on registrations to enforce user ownership. Inputs: registration, reqUser. Returns: a function result.
const assertParticipantOwnsRegistration = (registration, reqUser) => {
  if (!isParticipantRole(reqUser.role)) {
    throw errors.forbidden("Only participants can upload payment proof");
  }

  if (String(registration.participantId?._id || registration.participantId) !== String(reqUser._id)) {
    throw errors.forbidden("You can upload payment proof only for your own order");
  }
};

// Assert Upload Allowed For Status: Checks whether the current registration status accepts uploads. Inputs: status. Returns: a function result.
const assertUploadAllowedForStatus = (status) => {
  if (status === "PENDING_APPROVAL") {
    throw errors.conflict("Payment proof already submitted and pending review");
  }
  if (status === "APPROVED") {
    throw errors.conflict("Order is already approved");
  }
  if (!MERCH_PAYMENT_STATUSES.includes(status)) {
    throw errors.badRequest("Invalid payment status");
  }
};

// Upload Payment Proof: Uploads payment proof to storage. Inputs: req, res, next. Returns: a function result.
export const uploadPaymentProof = async (req, res, next) => {
  try {
    const registration = await getRegistrationWithEventOr404(req.params.registrationId);
    assertParticipantOwnsRegistration(registration, req.user);
    assertUploadAllowedForStatus(registration.merchPurchase?.paymentStatus || "PAYMENT_PENDING");

    const file = req.file;
    if (!file) {
      return next(errors.badRequest("paymentProof file is required"));
    }

    if (!PAYMENT_PROOF_ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return next(errors.badRequest("Unsupported payment proof file type"));
    }

    const uploaded = await uploadBufferToGridFS({
      buffer: file.buffer,
      filename: file.originalname,
      contentType: file.mimetype,
      metadata: {
        kind: "payment_proof",
        registrationId: String(registration._id),
        eventId: String(registration.eventId?._id || registration.eventId),
        participantId: String(registration.participantId?._id || registration.participantId),
      },
    });

    const previousProofFileId = registration.merchPurchase?.paymentProof?.fileId;

    registration.merchPurchase.paymentProof = {
      fileId: String(uploaded.fileId),
      fileName: uploaded.fileName,
      mimeType: uploaded.mimeType,
      size: uploaded.size,
      uploadedAt: new Date(),
    };
    registration.merchPurchase.paymentStatus = "PENDING_APPROVAL";
    registration.merchPurchase.reviewedBy = null;
    registration.merchPurchase.reviewedAt = null;
    registration.merchPurchase.reviewComment = "";

    await registration.save();

    if (previousProofFileId && previousProofFileId !== String(uploaded.fileId)) {
      await deleteGridFSFile(previousProofFileId);
    }

    return res.status(200).json({
      message: "Payment proof uploaded and sent for organizer approval",
      order: toProofMetadata(registration),
    });
  } catch (err) {
    return handleControllerError(err, next);
  }
};

// Get Payment Proof: Gets payment proof from persistence or request payload. Inputs: req, res, next. Returns: a Promise with payload data.
export const getPaymentProof = async (req, res, next) => {
  try {
    const registration = await getRegistrationWithEventOr404(req.params.registrationId);

    if (!canAccessPaymentProof(registration, req.user)) {
      return next(errors.forbidden("You do not have permission to access this payment proof"));
    }

    const paymentProof = registration.merchPurchase?.paymentProof;
    if (!paymentProof?.fileId) {
      return next(errors.notFound("Payment proof not uploaded"));
    }

    if (String(req.query.download || "").toLowerCase() !== "true") {
      return res.status(200).json({
        order: toProofMetadata(registration),
      });
    }

    const fileInfo = await getGridFSFileInfo(paymentProof.fileId);
    if (!fileInfo) {
      return next(errors.notFound("Payment proof file not found"));
    }

    const fileName = paymentProof.fileName || fileInfo.filename || "payment-proof";
    const contentType =
      paymentProof.mimeType || fileInfo.contentType || "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${String(fileName).replace(/"/g, "")}"`
    );

    const stream = openGridFSDownloadStream(paymentProof.fileId);
    stream.on("error", (err) => next(err));
    return stream.pipe(res);
  } catch (err) {
    return handleControllerError(err, next);
  }
};
