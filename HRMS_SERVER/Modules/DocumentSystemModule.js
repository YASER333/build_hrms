import mongoose from "mongoose";

const documentSystemSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    module: {
      type: String,
      required: true,
      enum: [
        "ONBOARDING",
        "RECRUITMENT",
        "LEAVE",
        "ATTENDANCE",
        "REIMBURSEMENT",
        "PERFORMANCE",
        "TRAINING",
        "ASSET",
        "RESIGNATION",
        "OFFBOARDING",
        "PAYROLL",
        "PROJECT",
        "PROFILE",
      ],
      index: true,
    },
    entityType: {
      type: String,
      required: true,
      trim: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    documentType: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    category: {
      type: String,
      default: "GENERAL",
      trim: true,
    },
    originalFileName: {
      type: String,
      required: true,
    },
    storageKey: {
      type: String,
      required: true, // Cloudinary public_id
    },
    fileUrl: {
      type: String,
      required: true, // Cloudinary secure_url
    },
    mimeType: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    verificationStatus: {
      type: String,
      enum: ["UPLOADED", "PENDING_VERIFICATION", "VERIFIED", "REJECTED"],
      default: "PENDING_VERIFICATION",
      index: true,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    expiryDate: {
      type: Date,
      default: null,
      index: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    previousVersionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DocumentSystem",
      default: null,
    },
    isRequired: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

documentSystemSchema.index({ employeeId: 1, module: 1, documentType: 1 });
documentSystemSchema.index({ entityType: 1, entityId: 1 });

const DocumentSystem = mongoose.model("DocumentSystem", documentSystemSchema);

export default DocumentSystem;
