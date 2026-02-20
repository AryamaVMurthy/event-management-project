import nodemailer from "nodemailer";
import { env } from "../config/env.js";

let cachedTransporter = null;
let verifiedAt = null;

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
  ok: Boolean(verifiedAt),
  mode: "smtp",
  verifiedAt,
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
});

export const resetMailerForTests = () => {
  cachedTransporter = null;
  verifiedAt = null;
};
