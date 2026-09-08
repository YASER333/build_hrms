import Task from "../Modules/TaskModule.js";
import Project from "../Modules/ProjectModule.js";
import User from "../Modules/UserModule.js";
import Notification from "../Modules/NotificationModule.js";
import mongoose from "mongoose";
import {  isOwnerOrAdminUser } from "./ProjectController.js";

export const createTask = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const {
            projectId,
            sprintId,
            taskName,
            description,
            assignedTo,
            priority,
            dueDate,
            remarks,
            attachments,
            storyPoints,
            estimatedHours
        } = req.body;
        const assignedBy = req.user ? req.user.id : req.body.assignedBy;

        if (!projectId || !taskName) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: "projectId and taskName are required" });
        }

        const projectExists = await Project.findById(projectId);
        if (!projectExists) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ success: false, message: "Project not found" });
        }

        const userId = req.user ? req.user.id : null;
        if (userId) {
            const isOwner = isOwnerOrAdminUser(req.user);
            let isManager = false;
            const isAssignedPM = projectExists.projectManager && projectExists.projectManager.toString() === userId;
            const userPermissions = req.user.permissions || [];
            const hasProjectUpdate = userPermissions.includes("*") || userPermissions.includes("project.update");
            if (isAssignedPM && hasProjectUpdate) {
                isManager = true;
            }
            if (!isOwner && !isManager) {
                await session.abortTransaction();
                session.endSession();
                return res.status(403).json({ success: false, message: "Only assigned Project Manager (with update permission) or Owner/Admin can create tasks" });
            }
        }

        const newTask = new Task({
            projectId,
            sprintId,
            taskName,
            description,
            assignedTo,
            assignedBy,
            priority: priority || "Medium",
            dueDate,
            remarks,
            attachments,
            storyPoints: storyPoints || 0,
            estimatedHours: estimatedHours || 0,
        });

        await newTask.save({ session });

        if (assignedTo) {
            try {
                const notification = new Notification({
                    userId: assignedTo,
                    message: `You have been assigned a new task: ${taskName}`,
                    type: 'Task Assignment',
                    relatedEntityId: newTask._id
                });
                await notification.save({ session });
            } catch (notifErr) {
                console.error("Task assignment notification failed:", notifErr);
            }
        }

        await session.commitTransaction();
        session.endSession();

        return res.status(201).json({
            success: true,
            message: "Task created successfully",
            data: newTask,
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getTasksByProject = async (req, res) => {
    try {
        const projectId = req.params.projectId || req.params.id;
        const tasks = await Task.find({ projectId })
            .populate("assignedTo", "firstName lastName email")
            .populate("assignedBy", "firstName lastName email")
            .populate("completedBy", "firstName lastName email")
            .populate("sprintId", "sprintName status")
            .sort({ createdAt: -1 });

        return res.status(200).json({ success: true, data: tasks });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getTasksBySprint = async (req, res) => {
    try {
        const sprintId = req.params.sprintId || req.params.id;
        const tasks = await Task.find({ sprintId })
            .populate("assignedTo", "firstName lastName email")
            .populate("assignedBy", "firstName lastName email")
            .populate("completedBy", "firstName lastName email")
            .sort({ createdAt: -1 });

        return res.status(200).json({ success: true, data: tasks });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const updateTaskStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, completionNote } = req.body;
        const userId = req.user ? req.user.id : null;

        const validStatuses = ["To Do", "In Progress", "Testing", "Completed"];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Valid statuses: ${validStatuses.join(", ")}`
            });
        }

        const task = await Task.findById(id).populate("projectId");
        if (!task) return res.status(404).json({ success: false, message: "Task not found" });

        if (userId) {
            const isAssignee = task.assignedTo && task.assignedTo.toString() === userId;
            const isOwner = isOwnerOrAdminUser(req.user);

            let isManager = false;
            if (task.projectId) {
                const project = await Project.findById(task.projectId._id || task.projectId);
                if (project) {
                    const isAssignedPM = project.projectManager && project.projectManager.toString() === userId;
                    const userPermissions = req.user.permissions || [];
                    const hasProjectUpdate = userPermissions.includes("*") || userPermissions.includes("project.update");
                    if (isAssignedPM && hasProjectUpdate) {
                        isManager = true;
                    }
                }
            }

            if (!isAssignee && !isOwner && !isManager) {
                return res.status(403).json({ success: false, message: "Secure Rule Violation: You do not have permission to update status for this task" });
            }
        }

        const validTransitions = {
            "To Do": ["In Progress", "Completed"],
            "In Progress": ["Testing", "Completed", "To Do"],
            "Testing": ["Completed", "In Progress"],
            "Completed": ["In Progress"]
        };

        const isOwnerBypass = req.user && isOwnerOrAdminUser(req.user);
        if (!isOwnerBypass && status !== task.status) {
            const allowedNext = validTransitions[task.status] || [];
            if (!allowedNext.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot transition from "${task.status}" to "${status}"`,
                    allowedNext
                });
            }
        }

        task.status = status;

        if (status === "Completed") {
            task.completedAt = new Date();
            task.completedBy = userId || task.assignedTo;
            if (completionNote !== undefined) {
                task.completionNote = completionNote;
            }
        }

        await task.save();

        return res.status(200).json({ success: true, message: "Task status updated successfully", data: task });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const reassignTask = async (req, res) => {
    try {
        const { id } = req.params;
        const { assignedTo } = req.body;

        if (!assignedTo) {
            return res.status(400).json({ success: false, message: "assignedTo user ID is required" });
        }

        const targetUser = await User.findById(assignedTo);
        if (!targetUser) {
            return res.status(404).json({ success: false, message: "Assigned user not found" });
        }

        const task = await Task.findById(id);
        if (!task) return res.status(404).json({ success: false, message: "Task not found" });

        const userId = req.user ? req.user.id : null;
        if (userId) {
            const isOwner = isOwnerOrAdminUser(req.user);
            let isManager = false;
            if (task.projectId) {
                const project = await Project.findById(task.projectId);
                if (project) {
                    const isAssignedPM = project.projectManager && project.projectManager.toString() === userId;
                    const userPermissions = req.user.permissions || [];
                    const hasProjectUpdate = userPermissions.includes("*") || userPermissions.includes("project.update");
                    if (isAssignedPM && hasProjectUpdate) {
                        isManager = true;
                    }
                }
            }
            if (!isOwner && !isManager) {
                return res.status(403).json({ success: false, message: "Only assigned Project Manager (with update permission) or Owner/Admin can reassign tasks" });
            }
        }

        task.assignedTo = assignedTo;
        if (req.user) {
            task.assignedBy = req.user.id;
        }
        await task.save();

        try {
            const notification = new Notification({
                userId: assignedTo,
                message: `You have been reassigned to task: ${task.taskName}`,
                type: 'Task Assignment',
                relatedEntityId: task._id
            });
            await notification.save();
        } catch (notifErr) {
            console.error("Reassignment notification failed:", notifErr);
        }

        return res.status(200).json({
            success: true,
            message: "Task reassigned successfully",
            data: task,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getMyTasks = async (req, res) => {
    try {
        const userId = req.user.id;
        const { status } = req.query;

        const filter = { assignedTo: userId };
        if (status) filter.status = status;

        const tasks = await Task.find(filter)
            .populate("projectId", "projectName")
            .populate("assignedBy", "firstName lastName")
            .populate("completedBy", "firstName lastName email")
            .populate("sprintId", "sprintName status")
            .sort({ dueDate: 1 });

        return res.status(200).json({ success: true, data: tasks });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getTaskById = async (req, res) => {
    try {
        const { id } = req.params;

        const task = await Task.findById(id)
            .populate("projectId", "projectName")
            .populate("assignedTo", "firstName lastName email")
            .populate("assignedBy", "firstName lastName email")
            .populate("completedBy", "firstName lastName email")
            .populate("sprintId", "sprintName status");

        if (!task) return res.status(404).json({ success: false, message: "Task not found" });

        return res.status(200).json({ success: true, data: task });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const updateTask = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            taskName,
            description,
            assignedTo,
            priority,
            dueDate,
            sprintId,
            remarks,
            attachments,
            storyPoints,
            estimatedHours,
            status,
            completionNote
        } = req.body;
        const userId = req.user ? req.user.id : null;

        const task = await Task.findById(id).populate("projectId");
        if (!task) return res.status(404).json({ success: false, message: "Task not found" });

        if (userId) {
            const isOwner = isOwnerOrAdminUser(req.user);

            let isManager = false;
            if (task.projectId) {
                const project = await Project.findById(task.projectId._id || task.projectId);
                if (project) {
                    const isAssignedPM = project.projectManager && project.projectManager.toString() === userId;
                    const userPermissions = req.user.permissions || [];
                    const hasProjectUpdate = userPermissions.includes("*") || userPermissions.includes("project.update");
                    if (isAssignedPM && hasProjectUpdate) {
                        isManager = true;
                    }
                }
            }

            if (!isOwner && !isManager) {
                return res.status(403).json({ success: false, message: "Secure Rule Violation: Only assigned Project Manager (with update permission) or Owner/Admin can edit task details" });
            }
        }

        if (taskName !== undefined) task.taskName = taskName;
        if (description !== undefined) task.description = description;
        if (assignedTo !== undefined) task.assignedTo = assignedTo;
        if (priority !== undefined) task.priority = priority;
        if (dueDate !== undefined) task.dueDate = dueDate;
        if (sprintId !== undefined) task.sprintId = sprintId;
        if (remarks !== undefined) task.remarks = remarks;
        if (attachments !== undefined) task.attachments = attachments;
        if (storyPoints !== undefined) task.storyPoints = storyPoints;
        if (estimatedHours !== undefined) task.estimatedHours = estimatedHours;
        if (status !== undefined) {
            task.status = status;
            if (status === "Completed") {
                task.completedAt = new Date();
                task.completedBy = userId || task.assignedTo;
                if (completionNote !== undefined) task.completionNote = completionNote;
            }
        }

        await task.save();

        return res.status(200).json({ success: true, message: "Task updated successfully", data: task });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteTask = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user ? req.user.id : null;

        const task = await Task.findById(id).populate("projectId");
        if (!task) return res.status(404).json({ success: false, message: "Task not found" });

        if (userId) {
            const isOwner = isOwnerOrAdminUser(req.user);

            let isManager = false;
            if (task.projectId) {
                const project = await Project.findById(task.projectId._id || task.projectId);
                if (project) {
                    const isAssignedPM = project.projectManager && project.projectManager.toString() === userId;
                    const userPermissions = req.user.permissions || [];
                    const hasProjectUpdate = userPermissions.includes("*") || userPermissions.includes("project.update");
                    if (isAssignedPM && hasProjectUpdate) {
                        isManager = true;
                    }
                }
            }

            if (!isOwner && !isManager) {
                return res.status(403).json({ success: false, message: "Secure Rule Violation: Only assigned Project Manager (with update permission) or Owner/Admin can delete this task" });
            }
        }

        await Task.findByIdAndDelete(id);

        return res.status(200).json({ success: true, message: "Task deleted successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};