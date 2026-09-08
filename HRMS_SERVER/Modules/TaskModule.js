import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
    {
        projectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: true,
        },
        // Newly added field: links a task to a specific sprint (optional)
        sprintId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Sprint",
        },
        taskName: {
            type: String,
            required: true,
        },
        description: {
            type: String,
        },
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        assignedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        priority: {
            type: String,
            enum: ["Low", "Medium", "High", "Critical"],
            default: "Medium",
        },
        status: {
            type: String,
            enum: ["To Do", "In Progress", "Testing", "Completed"],
            default: "To Do",
        },
        dueDate: {
            type: Date,
        },
        remarks: {
            type: String,
        },
        attachments: [
            {
                fileName: String,
                fileUrl: String,
                uploadedAt: { type: Date, default: Date.now }
            }
        ],
        storyPoints: {
            type: Number,
            default: 0,
        },
        estimatedHours: {
            type: Number,
            default: 0,
        },
        completedAt: {
            type: Date,
        },
        completedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        completionNote: {
            type: String,
        },
    },
    {
        timestamps: true,
    }
);

// Performance Index Strategy
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ projectId: 1, dueDate: 1 });

const Task = mongoose.model("Task", taskSchema);
export default Task;