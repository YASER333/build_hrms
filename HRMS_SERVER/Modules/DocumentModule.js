import mongoose from "mongoose";

const { Schema, model, Types } = mongoose;

const documentSchema = new Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    bankName: {
      type: String,
      trim: true,
      default: "",
    },

    branchName: {
      type: String,
      trim: true,
      default: "",
    },

    accountNo: {
      type: String,
      required: true,
      trim: true,
      minlength: 9,
      maxlength: 18,
      match: /^[0-9]+$/,
    },

    // IFSC - exactly 11
    ifsc: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: 11,
      maxlength: 11,
      match: /^[A-Z]{4}0[A-Z0-9]{6}$/,
    },

    // Aadhaar - exactly 12
    aadhaarNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 12,
      maxlength: 12,
      match: /^[0-9]{12}$/,
    },

    // PAN - exactly 10
    panNo: {
      type: String,
      required: true,
      uppercase: true,
      unique: true,
      trim: true,
      minlength: 10,
      maxlength: 10,
      match: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
    },

    // Passport (India) - exactly 8
    passportNo: {
      type: String,
      uppercase: true,
      unique: true,
      sparse: true,
      trim: true,
      minlength: 8,
      maxlength: 8,
      match: /^[A-Z]{1}[0-9]{7}$/,
    },

    // UAN - exactly 12
    uanNo: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      minlength: 12,
      maxlength: 12,
      match: /^[0-9]{12}$/,
    },

    // PF No - variable length
    pfNo: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      minlength: 5,
      maxlength: 22,
    },

    // ESI - exactly 17
    esiNo: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      minlength: 17,
      maxlength: 17,
      match: /^[0-9]{17}$/,
    },

    // Additional Employee File Attachments & Verification
    attachments: [{
      category: {
        type: String,
        enum: [
          "OFFER_LETTER",
          "JOINING_DOC",
          "ID_PROOF",
          "CERTIFICATE",
          "EXPERIENCE_LETTER",
          "PAYSLIP",
          "RELIEVING_LETTER",
          "EXIT_DOC",
          "OTHER",
        ],
        required: true,
      },
      title: { type: String, required: true },
      fileUrl: { type: String, required: true },
      verificationStatus: {
        type: String,
        enum: ["PENDING", "VERIFIED", "REJECTED", "EXPIRED"],
        default: "PENDING",
      },
      verifiedBy: { type: Types.ObjectId, ref: "User", default: null },
      verifiedAt: { type: Date, default: null },
      expiryDate: { type: Date, default: null },
      rejectionReason: { type: String, default: null },
    }],
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export default model("Document", documentSchema);
