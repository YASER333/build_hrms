import mongoose from 'mongoose';

const toTitleCase = (str) => {
    if (!str) return str;
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const experienceSchema = new mongoose.Schema({
    userId: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    companyName: {
        type: String,
        required: true,
        trim: true,
        set: toTitleCase
    },
    designation: {
        type: String,
        required: true,
        trim: true,
        set: toTitleCase
    },
    description: {
        type: String,
        default: "",
        required: false
    },
    salary: {
        type: String,
        default: "0",
        trim: true,
    },
    startDate: {
        type: String,
        required: true
    },
    endDate: {
        type: String,
        required: false,
        default: ""
    },
    isCurrentJob: {
        type: Boolean,
        default: false
    },
    noticePeriod: {
        type: String,
        default: "",
        trim: true,
    },
    expectedLastWorkingDate: {
        type: Date,
        default: null,
    },
    employmentStatus: {
        type: String,
        enum: [
            "CURRENTLY_EMPLOYED",
            "RESIGNED",
            "RELIEVED",
            "NOT_APPLICABLE",
        ],
        default: "RELIEVED",
    },
    experience: {
        type: String,
        required: true
    },
    // Optional Document Uploads / URLs
    experienceLetter: {
        type: String,
        default: "",
        required: false
    },
    experienceLetterUrl: {
        type: String,
        default: "",
        required: false
    },
    payslip: {
        type: String,
        default: "",
        required: false
    },
    payslipUrl: {
        type: String,
        default: "",
        required: false
    },
    relievingLetter: {
        type: String,
        default: "",
        required: false
    },
    relievingLetterUrl: {
        type: String,
        default: "",
        required: false
    },
    documentUrl: {
        type: String,
        default: "",
        required: false
    },
    documentType: {
        type: String,
        enum: [
            "CURRENT_EMPLOYMENT_LETTER",
            "OFFER_LETTER",
            "APPOINTMENT_LETTER",
            "PAYSLIP",
            "RESIGNATION_ACKNOWLEDGEMENT",
            "EXPERIENCE_LETTER",
            "RELIEVING_LETTER",
            "OTHER",
            ""
        ],
        default: "",
        required: false
    },
    documents: [{
        documentType: {
            type: String,
            enum: [
                "CURRENT_EMPLOYMENT_LETTER",
                "OFFER_LETTER",
                "APPOINTMENT_LETTER",
                "PAYSLIP",
                "RESIGNATION_ACKNOWLEDGEMENT",
                "EXPERIENCE_LETTER",
                "RELIEVING_LETTER",
                "OTHER"
            ],
            required: true,
        },
        fileUrl: { type: String, required: true },
        fileName: { type: String, default: "" },
        uploadedAt: { type: Date, default: Date.now },
        verificationStatus: {
            type: String,
            enum: ["PENDING", "VERIFIED", "REJECTED"],
            default: "PENDING",
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
            default: "",
        },
    }]
}, {
    timestamps: true
});

const Experience = mongoose.model('Experience', experienceSchema);
export default Experience;