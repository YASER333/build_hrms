import mongoose from "mongoose";

const clearanceSchema = new mongoose.Schema(
  {
    department: {
      type: String,
      enum: ["IT", "FINANCE", "HR", "DEPARTMENT"],
      required: true,
    },
    clearedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    isCleared: { type: Boolean, default: false },
    clearedAt: { type: Date, default: null },
    remarks: { type: String, default: "" },
  },
  { _id: true }
);

const offboardingSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    exitType: {
      type: String,
      enum: ["RESIGNATION", "TERMINATION", "RETIREMENT", "CONTRACT_END", "OTHER"],
      required: true,
    },
    resignationRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Resignation",
      default: null,
    },
    lastWorkingDay: { type: Date, required: true },
    status: {
      type: String,
      enum: ["INITIATED", "CLEARANCE_IN_PROGRESS", "COMPLETED", "CANCELLED"],
      default: "INITIATED",
      index: true,
    },
    clearances: [clearanceSchema],
    assetsReturned: { type: Boolean, default: false },
    accessRevoked: { type: Boolean, default: false },
    finalSettlementAmount: { type: Number, default: 0 },
    settlementPaidDate: { type: Date, default: null },
    experienceLetterUrl: { type: String, default: "" },
    relievingLetterUrl: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

const Offboarding = mongoose.model("Offboarding", offboardingSchema);

export default Offboarding;
