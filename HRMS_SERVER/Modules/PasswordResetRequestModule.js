import mongoose from "mongoose";

const passwordResetRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    requesterRole: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },
    approverRole: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      default: null,
    },
    approvalRequired: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Completed", "Expired"],
      default: "Pending",
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    resetTokenHash: {
      type: String,
      select: false,
      default: null,
    },
    resetTokenExpiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// High-performance compound indexes
passwordResetRequestSchema.index({ userId: 1, status: 1 });
passwordResetRequestSchema.index({ approverRole: 1, status: 1 });
passwordResetRequestSchema.index({ resetTokenHash: 1, status: 1 });

const PasswordResetRequest = mongoose.model(
  "PasswordResetRequest",
  passwordResetRequestSchema
);

export default PasswordResetRequest;
