import mongoose from "mongoose";

const documentRequirementSchema = new mongoose.Schema(
  {
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
    documentType: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    applicableRoles: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
    }],
    applicableEmploymentTypes: [{
      type: String,
      enum: ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"],
    }],
    isRequired: {
      type: Boolean,
      default: false,
    },
    requiresVerification: {
      type: Boolean,
      default: true,
    },
    allowedMimeTypes: [{
      type: String,
      trim: true,
    }],
    maxFileSize: {
      type: Number,
      default: 10 * 1024 * 1024, // Default 10MB
    },
    maxFiles: {
      type: Number,
      default: 1,
    },
    expiryRequired: {
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
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

documentRequirementSchema.index({ module: 1, documentType: 1 }, { unique: true });

const DocumentRequirement = mongoose.model("DocumentRequirement", documentRequirementSchema);

export default DocumentRequirement;
