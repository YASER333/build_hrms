import mongoose from "mongoose";

const assignmentHistorySchema = new mongoose.Schema(
  {
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignedDate: { type: Date, default: Date.now },
    returnedDate: { type: Date, default: null },
    conditionOnAssign: { type: String, default: "NEW" },
    conditionOnReturn: { type: String, default: null },
    remarks: { type: String, default: "" },
  },
  { _id: true }
);

const assetSchema = new mongoose.Schema(
  {
    assetCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ["LAPTOP", "DESKTOP", "MOBILE", "MONITOR", "PERIPHERAL", "VEHICLE", "OTHER"],
      required: true,
    },
    serialNumber: { type: String, required: true, unique: true, trim: true },
    modelName: { type: String, default: "" },
    manufacturer: { type: String, default: "" },
    purchaseDate: { type: Date, default: null },
    warrantyExpiryDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ["AVAILABLE", "ASSIGNED", "DAMAGED", "UNDER_REPAIR", "RETIRED"],
      default: "AVAILABLE",
      index: true,
    },
    currentAssignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    assignmentHistory: [assignmentHistorySchema],
  },
  { timestamps: true }
);

const Asset = mongoose.model("Asset", assetSchema);

export default Asset;
