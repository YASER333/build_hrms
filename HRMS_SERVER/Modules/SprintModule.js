import mongoose from "mongoose";

const sprintSchema = new mongoose.Schema(
    {
        projectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: true,
        },
        sprintName: {
            type: String,
            required: true,
        },
        description: {
            type: String,
        },
        startDate: {
            type: Date,
            required: true,
        },
        endDate: {
            type: Date,
            required: true,
        },
        status: {
            type: String,
            enum: ["Planned", "Active", "In Progress", "Completed"],
            default: "Planned",
        },
    },
    {
        timestamps: true,
    }
);

const Sprint = mongoose.model("Sprint", sprintSchema);
export default Sprint;
