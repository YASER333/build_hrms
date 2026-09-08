import mongoose from "mongoose";

const approvalLevelSchema = new mongoose.Schema(
  {
    level: {
      type: Number,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    minimumPriority: {
      type: Number,
      required: true, // Lower number = higher authority e.g. Priority 4 = TL, Priority 3 = HR
    },
    requiredRole: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      default: null,
    },
    approvalType: {
      type: String,
      enum: ["ANY", "ALL"],
      default: "ANY",
    },
    requiredApprovals: {
      type: Number,
      default: 1,
    },
  },
  { _id: false }
);

const approvalWorkflowSchema = new mongoose.Schema(
  {
    module: {
      type: String,
      required: true,
      enum: ["RESIGNATION", "REIMBURSEMENT", "LEAVE", "OFFBOARDING"],
      unique: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    approvalLevels: [approvalLevelSchema],
    allowSelfApproval: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const ApprovalWorkflow = mongoose.model("ApprovalWorkflow", approvalWorkflowSchema);

export default ApprovalWorkflow;
