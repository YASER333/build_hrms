import mongoose from "mongoose";

const handoverTaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
  },
  { _id: true }
);

const resignationSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reason: { type: String, required: true, trim: true },
    comments: { type: String, default: "" },
    resignationDate: { type: Date, default: Date.now },
    requestedLastWorkingDate: { type: Date, required: true },
    approvedLastWorkingDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "WITHDRAWN"],
      default: "PENDING",
      index: true,
    },
    approvalRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ApprovalRequest",
      default: null,
    },
    handoverTasks: [handoverTaskSchema],
    exitInterview: {
      feedback: { type: String, default: "" },
      reasonForLeavingCategory: { type: String, default: "" },
      wouldRejoin: { type: Boolean, default: true },
      completedAt: { type: Date, default: null },
    },
    fullAndFinalSettlementStatus: {
      type: String,
      enum: ["PENDING", "IN_PROCESS", "SETTLED"],
      default: "PENDING",
    },
    relievingLetterStatus: {
      type: String,
      enum: ["PENDING", "ISSUED"],
      default: "PENDING",
    },
  },
  { timestamps: true }
);

const Resignation = mongoose.model("Resignation", resignationSchema);

export default Resignation;
