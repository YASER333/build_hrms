import mongoose from "mongoose";

const toTitleCase = (str) => {
  if (!str) return str;
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const educationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    // ===== SSLC (Mandatory) =====
    sslcSchoolName: { type: String, required: true, trim: true, set: toTitleCase },
    sslcBoard: { type: String, required: true, trim: true, set: toTitleCase },
    sslcYearOfPassing: { type: Number, required: true, min: 1900 },
    sslcPercentage: { type: Number, required: true, min: 0, max: 100 },
    sslcDocumentUrl: { type: String, default: "", required: false },
    sslcDoc: { type: String, default: "", required: false },
    sslcCertificate: { type: String, default: "", required: false },

    // ===== HSC (Mandatory) =====
    hscSchoolName: { type: String, required: true, trim: true, set: toTitleCase },
    hscBoard: { type: String, required: true, trim: true, set: toTitleCase },
    hscYearOfPassing: { type: Number, required: true, min: 1900 },
    hscPercentage: { type: Number, required: true, min: 0, max: 100 },
    hscDocumentUrl: { type: String, default: "", required: false },
    hscDoc: { type: String, default: "", required: false },
    hscCertificate: { type: String, default: "", required: false },

    // ===== ITI / Diploma / Polytechnic (Optional) =====
    itiinstituteName: { type: String, trim: true, set: toTitleCase },
    iticourse: { type: String, trim: true, set: toTitleCase },
    itiduration: { type: String, trim: true, set: toTitleCase },
    itiyearOfPassing: { type: Number, min: 1900 },
    itipercentage: { type: Number, min: 0, max: 100 },
    itiDocumentUrl: { type: String, default: "", required: false },

    diplomainstitution: { type: String, trim: true, set: toTitleCase },
    diplomacourse: { type: String, trim: true, set: toTitleCase },
    diplomaduration: { type: String, trim: true, set: toTitleCase },
    diplomayearOfPassing: { type: Number, min: 1900 },
    diplomapercentage: { type: Number, min: 0, max: 100 },
    diplomaDocumentUrl: { type: String, default: "", required: false },

    // ===== UG (Mandatory) =====
    ugInstituteName: { type: String, required: true, trim: true, set: toTitleCase },
    ugUniversityName: { type: String, required: true, trim: true, set: toTitleCase },
    ugDegree: { type: String, required: true, trim: true, set: toTitleCase },
    ugDepartmentCourse: { type: String, required: true, trim: true, set: toTitleCase },
    ugYearOfPassing: { type: Number, required: true, min: 1900 },
    ugCgpa: { type: Number, required: true, min: 0, max: 10 },
    ugDocumentUrl: { type: String, default: "", required: false },
    ugDoc: { type: String, default: "", required: false },
    ugCertificate: { type: String, default: "", required: false },

    // ===== PG (Optional) =====
    pgInstituteName: { type: String, trim: true, set: toTitleCase },
    pgUniversityName: { type: String, trim: true, set: toTitleCase },
    pgDegree: { type: String, trim: true, set: toTitleCase },
    pgDepartmentCourse: { type: String, trim: true, set: toTitleCase },
    pgYearOfPassing: { type: Number, min: 1900 },
    pgCgpa: { type: Number, min: 0, max: 10 },
    pgDocumentUrl: { type: String, default: "", required: false },
    pgDoc: { type: String, default: "", required: false },
    pgCertificate: { type: String, default: "", required: false },

    // ===== PhD (Optional) =====
    phdInstituteName: { type: String, trim: true, set: toTitleCase },
    phdUniversityName: { type: String, trim: true, set: toTitleCase },
    phdResearchArea: { type: String, trim: true, set: toTitleCase },
    phdYearOfPassing: { type: Number, min: 1900 },
    phdDocumentUrl: { type: String, default: "", required: false },
    phdDoc: { type: String, default: "", required: false },
    phdCertificate: { type: String, default: "", required: false },

    // ===== DOCUMENTS LIST (Optional) =====
    documents: [{
      qualification: {
        type: String,
        enum: ["SSLC", "HSC", "ITI", "DIPLOMA", "UG", "PG", "PhD", "OTHER"],
        default: "UG",
      },
      documentType: {
        type: String,
        default: "MARKSHEET_OR_CERTIFICATE",
      },
      fileUrl: { type: String, default: "" },
      fileName: { type: String, default: "" },
      uploadedAt: { type: Date, default: Date.now }
    }],

    // ===== SYSTEM FIELDS =====
    highestQualification: {
      type: String,
      enum: ["SSLC", "HSC", "ITI", "DIPLOMA", "UG", "PG", "PhD"],
      default: "UG",
    },
    isVerified: { type: Boolean, default: false },
    remarks: { type: String, trim: true },
  },
  { timestamps: true }
);

export default mongoose.model("Education", educationSchema);
