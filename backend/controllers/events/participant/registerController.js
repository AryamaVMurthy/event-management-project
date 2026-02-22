import { Registration } from "../../../models/Registration.js";
import { Ticket } from "../../../models/Ticket.js";
import { errors } from "../../../utils/Errors.js";
import {
  handleControllerError,
  isParticipantRole,
  getEventForParticipantOr404,
  assertEventOpen,
  assertParticipantEligibility,
  assertCapacityAvailable,
  assertNoExistingRegistration,
  validateNormalResponses,
  createTicketForRegistration,
} from "../shared/index.js";
import {
  parseResponsesInput,
  buildFileResponsesFromUpload,
  rollbackGridFsFiles,
} from "./services/uploadedResponsesService.js";
import { sendTicketEmailStrict } from "./services/ticketEmailService.js";

export const registerForEvent = async (req, res, next) => {
  let uploadedFileIds = [];
  try {
    if (!isParticipantRole(req.user.role)) {
      return next(errors.forbidden("Only participants can register"));
    }

    const event = await getEventForParticipantOr404(req.params.id);
    if (event.type !== "NORMAL") {
      return next(errors.badRequest("Use purchase endpoint for merchandise events"));
    }

    assertEventOpen(event);
    assertParticipantEligibility(event, req.user.role);
    await assertCapacityAvailable(event._id, event.registrationLimit);
    await assertNoExistingRegistration(req.user._id, event._id);

    const baseResponses = parseResponsesInput(req.body.responses);
    const { fileResponses, uploadedFileIds: newUploadedFileIds } = await buildFileResponsesFromUpload(
      event,
      req.files,
      req.user._id
    );
    uploadedFileIds = newUploadedFileIds;
    const responses = validateNormalResponses(event, {
      ...baseResponses,
      ...fileResponses,
    });
    const teamName =
      typeof req.body.teamName === "string" && req.body.teamName.trim()
        ? req.body.teamName.trim()
        : undefined;

    let registration = null;
    let ticket = null;
    let email = null;

    try {
      registration = await Registration.create({
        participantId: req.user._id,
        eventId: event._id,
        status: "REGISTERED",
        teamName,
        responses,
      });

      ticket = await createTicketForRegistration(registration);
      email = await sendTicketEmailStrict({
        participantId: req.user._id,
        event,
        registration,
        ticket,
        flow: "registration",
      });
    } catch (flowErr) {
      if (ticket?._id) {
        await Ticket.findByIdAndDelete(ticket._id);
      }
      if (registration?._id) {
        await Registration.findByIdAndDelete(registration._id);
      }
      await rollbackGridFsFiles(uploadedFileIds);
      uploadedFileIds = [];
      throw flowErr;
    }

    return res.status(201).json({
      message: "Registered successfully",
      registration,
      ticket: {
        ticketId: ticket.ticketId,
      },
      email,
    });
  } catch (err) {
    await rollbackGridFsFiles(uploadedFileIds);
    return handleControllerError(err, next);
  }
};
