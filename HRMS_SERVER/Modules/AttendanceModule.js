import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    date: {
      type: String,
      required: true
    },

    loginTime: {
      type: Date,
      required: true
    },

    logoutTime: {
      type: Date
    },

    totalWorkingMinutes: {
      type: Number,
      default: 0
    },

    totalHours: {
      type: Number,
      default: 0
    },

    locationType: {
      type: String,
      enum: ["Office", "WFH"],
      required: true
    },

    status: {
      type: String,
      enum: ["Present", "Half Day", "Absent", "Leave", "Late", "Working"],
      default: "Present"
    },

    isLate: {
      type: Boolean,
      default: false
    },

    punchInLocation: {
      latitude: { type: Number },
      longitude: { type: Number },
      accuracy: { type: Number }
    },

    punchOutLocation: {
      latitude: { type: Number },
      longitude: { type: Number },
      accuracy: { type: Number }
    },

    auditHistory: [
      {
        modifiedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        },
        modifiedByName: { type: String },
        field: { type: String },
        oldValue: { type: String },
        newValue: { type: String },
        reason: { type: String },
        modifiedAt: {
          type: Date,
          default: Date.now
        }
      }
    ]
  },
  { timestamps: true }
);

attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

export default mongoose.model("Attendance", attendanceSchema);