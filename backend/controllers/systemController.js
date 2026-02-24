// System Controller: Controller level logic for the feature area.
import { getMailerStatus } from "../utils/mailer.js";

// GET /api/system/email-health
// Get Email Health: Gets email health from persistence or request payload. Inputs: req, res, next. Returns: a Promise with payload data.
export const getEmailHealth = async (req, res, next) => {
  try {
    const status = getMailerStatus();
    return res.status(200).json({
      ok: status.ok,
      mode: status.mode,
      verifiedAt: status.verifiedAt,
      host: status.host,
      port: status.port,
      fallback_reason: status.fallback_reason,
    });
  } catch (err) {
    return next(err);
  }
};
