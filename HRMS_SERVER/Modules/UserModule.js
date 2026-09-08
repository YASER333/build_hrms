import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    // =========================
    // PERSONAL INFORMATION
    // =========================

    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    middleName: {
      type: String,
      trim: true,
      maxlength: 50,
      default: null,
    },

    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    dob: {
      type: Date,
      required: true,
    },

    gender: {
      type: String,
      enum: ["Male", "Female", "Others"],
      required: true,
    },

    marriageStatus: {
      type: String,
      enum: ["Married", "Unmarried"],
      required: true,
    },

    bloodGroup: {
      type: String,
      enum: [
        "A+",
        "A-",
        "B+",
        "B-",
        "AB+",
        "AB-",
        "O+",
        "O-",
      ],
      default: null,
    },

    mobileNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // Profile Picture / Avatar (Cloudinary URL)
    avatarUrl: {
      type: String,
      default: "",
    },

    profilePic: {
      type: String,
      default: "",
    },

    profilePicUrl: {
      type: String,
      default: "",
    },

    profileImage: {
      type: String,
      default: "",
    },

    // =========================
    // AUTHENTICATION
    // =========================

    password: {
      type: String,
      required: true,
      select: false,
    },

    // =========================
    // EMPLOYEE INFORMATION
    // =========================

    employeeCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },

    // =========================
    // ROLE & REPORTING
    // =========================

    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },

    // Team Lead
    tlCode: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // =========================
    // ACCOUNT STATUS & PROVISIONING
    // =========================

    hasLoginAccess: {
      type: Boolean,
      default: false,
      index: true,
    },

    accountProvisionedAt: {
      type: Date,
      default: null,
    },

    accountProvisionedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    isBlocked: {
      type: Boolean,
      default: false,
    },

    // =========================
    // WORK FROM HOME
    // =========================

    wfh: {
      isApproved: {
        type: Boolean,
        default: false,
      },

      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },

      approvedAt: {
        type: Date,
        default: null,
      },
    },

    // =========================
    // LIFECYCLE & EMPLOYMENT
    // =========================

    lifecycleStatus: {
      type: String,
      enum: ["ONBOARDING", "ACTIVE", "NOTICE_PERIOD", "OFFBOARDED", "EXITED"],
      default: "ONBOARDING",
      index: true,
    },

    employmentType: {
      type: String,
      enum: ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"],
      default: "FULL_TIME",
    },

    joiningDate: {
      type: Date,
      default: Date.now,
    },

    department: {
      type: String,
      trim: true,
      default: "General",
    },

    designation: {
      type: String,
      trim: true,
      default: "Employee",
    },

    reportingManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    noticePeriodDays: {
      type: Number,
      default: 60,
    },

    resignationDate: {
      type: Date,
      default: null,
    },

    lastWorkingDate: {
      type: Date,
      default: null,
    },

    // =========================
    // BANK & STATUTORY DETAILS
    // =========================

    bankDetails: {
      accountNumber: { type: String, trim: true },
      ifscCode: { type: String, trim: true },
      ifsc: { type: String, trim: true },
      bankName: { type: String, trim: true },
      branchName: { type: String, trim: true },
    },

    statutoryDetails: {
      panNo: { type: String, trim: true, uppercase: true },
      aadhaarNo: { type: String, trim: true },
      pfUan: { type: String, trim: true },
      esiNo: { type: String, trim: true },
    },

    emergencyContact: {
      name: { type: String, trim: true },
      relationship: { type: String, trim: true },
      phone: { type: String, trim: true },
    },

    // =========================
    // LAST LOGIN
    // =========================

    lastLoginAt: {
      type: Date,
      default: null,
    },

    lastLoginLocation: {
      latitude: {
        type: Number,
        min: -90,
        max: 90,
      },

      longitude: {
        type: Number,
        min: -180,
        max: 180,
      },

      address: {
        type: String,
        trim: true,
      },

      timestamp: {
        type: Date,
      },
    },
  },
  {
    timestamps: true,
  }
);

// =========================
// INDEXES
// =========================

userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ tlCode: 1, isActive: 1 });
userSchema.index({ lifecycleStatus: 1, department: 1 });

const User = mongoose.model("User", userSchema);

export default User;