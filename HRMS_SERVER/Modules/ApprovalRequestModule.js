import mongoose from "mongoose";

const approvalHistorySchema = new mongoose.Schema(
  {
    level: {
      type: Number,
      required: true,
    },
    approver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      enum: ["APPROVED", "REJECTED", "CANCELLED"],
      required: true,
    },
    comments: {
      type: String,
      default: "",
    },
    actionDate: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const approvalRequestSchema = new mongoose.Schema(
  {
    module: {
      type: String,
      required: true,
      enum: ["RESIGNATION", "REIMBURSEMENT", "LEAVE", "OFFBOARDING"],
      index: true,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    workflowConfig: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ApprovalWorkflow",
      required: true,
    },
    currentLevel: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"],
      default: "PENDING",
      index: true,
    },
    history: [approvalHistorySchema],
  },
  {
    timestamps: true,
  }
);

approvalRequestSchema.index({ module: 1, referenceId: 1 });

const ApprovalRequest = mongoose.model("ApprovalRequest", approvalRequestSchema);

export default ApprovalRequest;
