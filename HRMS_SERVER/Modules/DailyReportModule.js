import mongoose from "mongoose";
const { Schema } = mongoose;

const toTitleCase = (str) => {
    if (!str) return str;
    return str
        .toLowerCase()
        .split(" ")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
};

const DailyReportSchema = new Schema(
    {
        submittedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        projectId: {
            type: Schema.Types.ObjectId,
            ref: "Project",
            required: [true, "Project is required"],
            index: true
        },

        reportDate: {
            type: Date,
            required: [true, "Report date is required"],
            index: true
        },

        shift: {
            type: String,
            default: "FULL_DAY",
            trim: true
        },

        title: {
            type: String,
            required: false,
            default: "Work Update",
            trim: true,
            maxlength: [100, "Title cannot exceed 100 characters"],
            set: toTitleCase
        },

        description: {
            type: String,
            required: [true, "Description is required"],
            trim: true,
            minlength: [5, "Description must be at least 5 characters"],
            maxlength: [2000, "Description too long"],
            set: toTitleCase
        },

        preference: {
            type: Number,
            enum: {
                values: [1, 2, 3],
                message: "Preference must be 1 (WFH), 2 (On Site), or 3 (Client Visit)"
            }
        },

        referenceLink: {
            type: String,
            trim: true
        },

        comments: [
            {
                commentedBy: {
                    type: Schema.Types.ObjectId,
                    ref: "User",
                    required: true
                },
                commentText: {
                    type: String,
                    required: true,
                    trim: true
                },
                createdAt: {
                    type: Date,
                    default: Date.now
                }
            }
        ],

        submittedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

DailyReportSchema.index(
    { submittedBy: 1, projectId: 1, reportDate: 1, shift: 1 },
    { unique: true }
);

const DailyReport = mongoose.model("DailyReport", DailyReportSchema);
export default DailyReport;
