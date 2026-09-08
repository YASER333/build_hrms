import mongoose from "mongoose";

const reimbursementSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ["TRAVEL", "FOOD", "MEDICAL", "OFFICE_SUPPLIES", "INTERNET", "CLIENT_ENTERTAINMENT", "OTHER"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [1, "Amount must be greater than 0"],
    },
    expenseDate: {
      type: Date,
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    receiptUrl: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "PAID"],
      default: "PENDING",
      index: true,
    },
    approvalRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ApprovalRequest",
      default: null,
    },
    paidDate: {
      type: Date,
      default: null,
    },
    paymentReference: {
      type: String,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

reimbursementSchema.index({ employeeId: 1, status: 1 });

const Reimbursement = mongoose.model("Reimbursement", reimbursementSchema);

export default Reimbursement;
