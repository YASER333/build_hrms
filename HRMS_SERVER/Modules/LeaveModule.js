import mongoose from "mongoose";
import { Schema } from "mongoose";

const toTitleCase = (str) => {
    if (!str) return str;
    return str
        .toLowerCase()
        .split(" ")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
};

const LeaveSchema = new Schema(
    {
        employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        leaveType: {
            type: String,
            enum: ["CL", "SL", "PL", "LOP"],
            required: true
        },

        startDate: {
            type: Date,
            required: true,
            index: true
        },

        endDate: {
            type: Date,
            required: true
        },

        totalDays: {
            type: Number,
            required: true,
            min: 0.5
        },

        isHalfDay: {
            type: Boolean,
            default: false
        },

        halfDayPeriod: {
            type: String,
            enum: ["Morning", "Afternoon", null],
            default: null
        },

        title: {
            type: String,
            default: "Leave Application",
            trim: true,
            set: toTitleCase
        },

        reason: {
            type: String,
            required: true,
            trim: true,
            minlength: 5,
            set: toTitleCase
        },

        status: {
            type: String,
            enum: ["Pending", "Approved", "Rejected", "Cancelled"],
            default: "Pending",
            index: true
        },

        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },

        approvedAt: {
            type: Date
        },

        rejectionReason: {
            type: String,
            default: null
        },

        balanceBefore: {
            type: Number
        },

        balanceAfter: {
            type: Number
        },

        auditTrail: [
            {
                action: { type: String, required: true },
                oldStatus: { type: String, default: null },
                newStatus: { type: String, required: true },
                performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
                performedByName: { type: String },
                reason: { type: String, default: null },
                performedAt: { type: Date, default: Date.now }
            }
        ],

        appliedOn: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

const Leave = mongoose.model("Leave", LeaveSchema);
export default Leave;
