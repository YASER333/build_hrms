import mongoose from "mongoose";

const passwordResetRuleSchema = new mongoose.Schema(
  {
    requesterRole: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
      unique: true,
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
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const PasswordResetRule = mongoose.model(
  "PasswordResetRule",
  passwordResetRuleSchema
);

export default PasswordResetRule;
