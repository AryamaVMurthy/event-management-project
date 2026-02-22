import mongoose from "mongoose";

const ATTENDANCE_AUDIT_ACTIONS = [
  "SCAN_SUCCESS",
  "SCAN_DUPLICATE",
  "SCAN_INVALID",
  "MANUAL_OVERRIDE",
];

const attendanceAuditLogSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    registrationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Registration",
      default: null,
    },
    ticketId: {
      type: String,
      trim: true,
      default: null,
    },
    scannerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      enum: ATTENDANCE_AUDIT_ACTIONS,
      required: true,
    },
    reason: {
      type: String,
      trim: true,
      default: "",
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    occurredAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  { timestamps: true }
);

attendanceAuditLogSchema.index({ eventId: 1, occurredAt: -1 });
attendanceAuditLogSchema.index({ registrationId: 1, occurredAt: -1 });
attendanceAuditLogSchema.index({ action: 1, occurredAt: -1 });

const AttendanceAuditLog = mongoose.model("AttendanceAuditLog", attendanceAuditLogSchema);

export { AttendanceAuditLog, ATTENDANCE_AUDIT_ACTIONS };
