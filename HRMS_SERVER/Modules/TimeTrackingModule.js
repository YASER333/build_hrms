import mongoose from "mongoose";

const timeTrackingSchema = new mongoose.Schema(
    {
        taskId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Task",
            required: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        date: {
            type: Date,
            required: true,
            default: Date.now,
        },
        startTime: {
            type: String, // HH:MM format
            required: true,
        },
        endTime: {
            type: String, // HH:MM format
        },
        durationMinutes: {
            type: Number,
            default: 0,
        },
        description: {
            type: String,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

const TimeTracking = mongoose.model("TimeTracking", timeTrackingSchema);
export default TimeTracking;
