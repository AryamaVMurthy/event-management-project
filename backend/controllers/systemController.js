import { getMailerStatus } from "../utils/mailer.js";

// GET /api/system/email-health
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
