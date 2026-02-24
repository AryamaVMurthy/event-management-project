import nodemailer from "nodemailer";
import { env } from "../config/env.js";

let cachedTransporter = null;
let verifiedAt = null;
const emailDisabledReason = "EMAIL_MODE=disabled";

const createTransporter = () =>
  nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

const getTransporter = () => {
  if (!cachedTransporter) {
    cachedTransporter = createTransporter();
  }
  return cachedTransporter;
};

export const initMailer = async () => {
  if (env.EMAIL_MODE === "disabled") {
    verifiedAt = null;
    return {
      ok: false,
      mode: "disabled",
      verifiedAt: null,
      host: null,
      port: null,
      fallback_reason: emailDisabledReason,
    };
  }

  const transporter = getTransporter();
  try {
    await transporter.verify();
    verifiedAt = new Date().toISOString();
    return {
      ok: true,
      mode: "smtp",
      verifiedAt,
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
    };
  } catch (err) {
    const error = new Error("SMTP verification failed");
    error.code = "SMTP_VERIFY_FAILED";
    error.cause = err;
    throw error;
  }
};

export const sendEmail = async ({ to, subject, text, html }) => {
  if (env.EMAIL_MODE === "disabled") {
    return {
      mode: "disabled",
      messageId: null,
      accepted: [],
      rejected: [],
      fallback_reason: emailDisabledReason,
      skipped: true,
    };
  }

  const transporter = getTransporter();

  if (env.EMAIL_FORCE_FAIL_SEND) {
    const forced = new Error("Forced SMTP send failure");
    forced.code = "SMTP_SEND_FAILED";
    throw forced;
  }

  try {
    const info = await transporter.sendMail({
      from: env.SMTP_FROM,
      to,
      subject,
      text,
      html,
    });

    return {
      mode: "smtp",
      messageId: info.messageId || null,
      accepted: info.accepted || [],
      rejected: info.rejected || [],
    };
  } catch (err) {
    const error = new Error("SMTP email delivery failed");
    error.code = "SMTP_SEND_FAILED";
    error.cause = err;
    throw error;
  }
};

export const getMailerStatus = () => ({
  ok: env.EMAIL_MODE === "disabled" ? false : Boolean(verifiedAt),
  mode: env.EMAIL_MODE === "disabled" ? "disabled" : "smtp",
  verifiedAt,
  host: env.EMAIL_MODE === "disabled" ? null : env.SMTP_HOST,
  port: env.EMAIL_MODE === "disabled" ? null : env.SMTP_PORT,
  fallback_reason: env.EMAIL_MODE === "disabled" ? emailDisabledReason : null,
});

export const resetMailerForTests = () => {
  cachedTransporter = null;
  verifiedAt = null;
};
