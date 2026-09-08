import mongoose from "mongoose";

const onboardingTaskSchema = new mongoose.Schema(
  {
    taskName: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    responsibleGroup: {
      type: String,
      enum: ["HR", "IT", "MANAGER", "EMPLOYEE"],
      default: "HR",
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    category: {
      type: String,
      enum: [
        "HR_DOCUMENT",
        "DOCUMENT_VERIFICATION",
        "EMPLOYMENT",
        "IT_PROVISIONING",
        "ASSET_ALLOCATION",
        "TRAINING",
        "OTHER",
      ],
      default: "OTHER",
    },
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      default: "MEDIUM",
    },
    dueDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ["PENDING", "IN_PROGRESS", "COMPLETED", "BLOCKED", "CANCELLED"],
      default: "PENDING",
    },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    notes: { type: String, default: "" },
    isMandatory: { type: Boolean, default: true },
  },
  { _id: true, timestamps: true }
);

const provisionedAccessSchema = new mongoose.Schema(
  {
    systemName: { type: String, required: true, trim: true },
    accessType: { type: String, default: "STANDARD", trim: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    status: {
      type: String,
      enum: ["REQUESTED", "APPROVED", "PROVISIONING", "ACTIVE", "REJECTED", "REVOKED"],
      default: "REQUESTED",
    },
    isProvisioned: { type: Boolean, default: false },
    provisionedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    provisionedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    notes: { type: String, default: "" },
    isMandatory: { type: Boolean, default: true },
  },
  { _id: true, timestamps: true }
);

const agreementSchema = new mongoose.Schema(
  {
    agreementType: {
      type: String,
      enum: [
        "OFFER_LETTER",
        "APPOINTMENT_LETTER",
        "EMPLOYMENT_AGREEMENT",
        "NDA",
        "COMPANY_POLICIES",
        "OTHER",
      ],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    documentUrl: { type: String, default: "" },
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: "DocumentSystem", default: null },
    isRequired: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "REJECTED"],
      default: "PENDING",
    },
    isAcknowledged: { type: Boolean, default: false },
    acknowledgedAt: { type: Date, default: null },
    acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: "" },
  },
  { _id: true, timestamps: true }
);

const orientationSchema = new mongoose.Schema(
  {
    trainingName: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    trainer: { type: String, default: "", trim: true },
    scheduledDate: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    mandatory: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "OVERDUE"],
      default: "NOT_STARTED",
    },
    completedAt: { type: Date, default: null },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    remarks: { type: String, default: "" },
  },
  { _id: true, timestamps: true }
);

const onboardingSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: [
        "ONBOARDING",
        "PENDING", // Backwards compatibility
        "IN_PROGRESS",
        "PENDING_VALIDATION",
        "VALIDATION_FAILED",
        "READY_FOR_COMPLETION",
        "COMPLETED",
        "REJECTED",
        "CANCELLED",
      ],
      default: "ONBOARDING",
      index: true,
    },
    startDate: { type: Date, default: Date.now },
    completedDate: { type: Date, default: null },
    targetJoiningDate: { type: Date, default: null },
    
    // Sub-modules
    tasks: [onboardingTaskSchema],
    assignedAssets: [{ type: mongoose.Schema.Types.ObjectId, ref: "Asset" }],
    provisionedAccess: [provisionedAccessSchema],
    agreements: [agreementSchema],
    orientations: [orientationSchema],

    // Payroll onboarding readiness
    payrollReadiness: {
      isBankProvided: { type: Boolean, default: false },
      isStatutoryProvided: { type: Boolean, default: false },
      isEligibleForPayroll: { type: Boolean, default: false },
      payrollSetupStatus: {
        type: String,
        enum: ["PENDING", "READY", "COMPLETED"],
        default: "PENDING",
      },
      setupCompletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      setupCompletedAt: { type: Date, default: null },
    },

    // Validation Status Engine Summary
    validationSummary: {
      lastValidatedAt: { type: Date, default: null },
      lastValidatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      isValid: { type: Boolean, default: false },
      missingRequirements: [{ type: String }],
      sectionStatuses: {
        employeeInformation: { type: Boolean, default: false },
        employment: { type: Boolean, default: false },
        documents: { type: Boolean, default: false },
        agreements: { type: Boolean, default: false },
        payroll: { type: Boolean, default: false },
        tasks: { type: Boolean, default: false },
        assets: { type: Boolean, default: false },
        systemAccess: { type: Boolean, default: false },
        orientation: { type: Boolean, default: false },
      },
    },

    // Activation record
    activationDetails: {
      activatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      activatedAt: { type: Date, default: null },
      previousStatus: { type: String, default: null },
      newStatus: { type: String, default: null },
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

const Onboarding = mongoose.model("Onboarding", onboardingSchema);

export default Onboarding;
