import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const boolFromString = z
  .string()
  .trim()
  .toLowerCase()
  .refine((value) => value === "true" || value === "false", {
    message: "Must be true or false",
  })
  .transform((value) => value === "true");

const baseSchema = z.object({
  PORT: z.coerce.number().int().positive("PORT must be a positive integer"),
  MONGO_URI: z.string().min(1, "MONGO_URI is required"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  JWT_EXPIRES_IN: z.string().min(1, "JWT_EXPIRES_IN is required"),
  ADMIN_EMAIL: z.string().email("ADMIN_EMAIL must be a valid email"),
  ADMIN_PASSWORD: z.string().min(1, "ADMIN_PASSWORD is required"),
  FRONTEND_URL: z.string().url("FRONTEND_URL must be a valid URL"),
  MAX_UPLOAD_MB: z.coerce
    .number()
    .int()
    .min(1, "MAX_UPLOAD_MB must be at least 1"),
  EMAIL_FORCE_FAIL_SEND: boolFromString,
  EMAIL_MODE: z.enum(["smtp", "disabled"]).default("smtp"),
});

const smtpSchema = z.object({
  SMTP_HOST: z.string().min(1, "SMTP_HOST is required"),
  SMTP_PORT: z.coerce.number().int().positive("SMTP_PORT must be a positive integer"),
  SMTP_SECURE: boolFromString,
  SMTP_USER: z.string().min(1, "SMTP_USER is required"),
  SMTP_PASS: z.string().min(1, "SMTP_PASS is required"),
  SMTP_FROM: z.string().email("SMTP_FROM must be a valid email"),
});

const baseParsed = baseSchema.safeParse(process.env);

if (!baseParsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of baseParsed.error.issues) {
    console.error(`- ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

let smtpConfig = {
  SMTP_HOST: null,
  SMTP_PORT: null,
  SMTP_SECURE: null,
  SMTP_USER: null,
  SMTP_PASS: null,
  SMTP_FROM: null,
};

if (baseParsed.data.EMAIL_MODE === "smtp") {
  const smtpParsed = smtpSchema.safeParse(process.env);
  if (!smtpParsed.success) {
    console.error("Invalid SMTP configuration (EMAIL_MODE=smtp):");
    for (const issue of smtpParsed.error.issues) {
      console.error(`- ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }
  smtpConfig = smtpParsed.data;
}

export const env = {
  ...baseParsed.data,
  ...smtpConfig,
};
