import mongoose from "mongoose";

const familyMemberSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    relationship: {
      type: String,
      required: true,
      enum: [
        "Father",
        "Mother",
        "Spouse",
        "Son",
        "Daughter",
        "Brother",
        "Sister",
        "Guardian",
        "Other",
      ],
    },

    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
    },

    occupation: {
      type: String,
      trim: true,
    },

    phone: {
      type: String,
      trim: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    isEmergencyContact: {
      type: Boolean,
      default: false,
    },

    emergencyContactPriority: {
      type: Number,
      min: 1,
    },

    address: {
      type: String,
      trim: true,
    },
  },
  { _id: true }
);

const familySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    familyMembers: [familyMemberSchema],

    remarks: {
      type: String,
      trim: true,
    },

    isVerified: {
      type: Boolean,
      default: false,
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
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Family", familySchema);
