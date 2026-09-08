import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
    {
        projectName: {
            type: String,
            required: true,
        },
        description: {
            type: String,
        },
        startDate: {
            type: Date,
        },
        endDate: {
            type: Date,
        },
        status: {
            type: String,
            enum: ["Pending", "In Progress", "Completed", "On Hold"],
            default: "Pending",
        },
        projectManager: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        projectManagerAddedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        teamLeads: [
            {
                userId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                },
                addedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                },
            },
        ],
        softwareDevelopers: [
            {
                userId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                },
                addedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                },
            },
        ],
        interns: [
            {
                userId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                },
                addedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                },
            },
        ],
        completionNotes: {
            type: String,
        },
        completedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        completedAt: {
            type: Date,
        },
        estimatedBudget: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

const Project = mongoose.model("Project", projectSchema);
export default Project;
