import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    module: {
      type: String,
      required: true,
      enum: [
        "USER",
        "USER_MANAGEMENT",
        "ROLE",
        "ROLE_MANAGEMENT",
        "ONBOARDING",
        "RESIGNATION",
        "OFFBOARDING",
        "REIMBURSEMENT",
        "ASSET",
        "DOCUMENT",
        "APPROVAL_WORKFLOW",
        "LEAVE",
        "ATTENDANCE",
        "PROJECT",
        "PROJECTS",
      ],
      index: true,
    },
    resourceId: {
      type: String,
      default: null,
      index: true,
    },
    previousState: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    newState: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    details: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

auditLogSchema.index({ createdAt: -1 });

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;
