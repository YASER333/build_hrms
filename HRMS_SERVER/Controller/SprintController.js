import Sprint from "../Modules/SprintModule.js";
import Project from "../Modules/ProjectModule.js";
import Task from "../Modules/TaskModule.js";
import { isOwnerOrAdminUser } from "./ProjectController.js";

// Helper: PM / Admin-Owner check
const canManageSprint = (req, project) => {
    if (!req.user) return false;
    const userId = req.user.id ? req.user.id.toString() : null;
    const userPriority = req.user.priority ?? req.user.role?.priority;

    const isOwnerOrAdmin = userPriority <= 2 || isOwnerOrAdminUser(req.user);
    if (isOwnerOrAdmin) return true;

    const isAssignedPM = project.projectManager && project.projectManager.toString() === userId;
    if (isAssignedPM) {
        const userPermissions = req.user.permissions || [];
        return userPermissions.includes("*") || userPermissions.includes("project.update");
    }

    return false;
};

export const createSprint = async (req, res) => {
    try {
        const { projectId, sprintName, description, startDate, endDate, status } = req.body;

        if (!projectId || !sprintName || !startDate || !endDate) {
            return res.status(400).json({ success: false, message: "projectId, sprintName, startDate, and endDate are required" });
        }

        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ success: false, message: "Project not found" });
        }

        if (!canManageSprint(req, project)) {
            return res.status(403).json({ success: false, message: "Only Project Manager, Team Lead, or Admin can create sprints" });
        }

        if (new Date(startDate) >= new Date(endDate)) {
            return res.status(400).json({ success: false, message: "Start date must be before end date" });
        }

        const overlappingSprint = await Sprint.findOne({
            projectId,
            $or: [
                { startDate: { $lte: endDate }, endDate: { $gte: startDate } }
            ]
        });

        if (overlappingSprint) {
            return res.status(400).json({ success: false, message: "Sprint dates overlap with an existing sprint in this project" });
        }

        const newSprint = new Sprint({
            projectId,
            sprintName,
            description,
            startDate,
            endDate,
            status: status || "Planned",
        });

        await newSprint.save();

        return res.status(201).json({ success: true, message: "Sprint created successfully", data: newSprint });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const updateSprintStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ["Planned", "Active", "In Progress", "Completed"];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`
            });
        }

        const sprint = await Sprint.findById(id);
        if (!sprint) {
            return res.status(404).json({ success: false, message: "Sprint not found" });
        }

        const project = await Project.findById(sprint.projectId);
        if (!project) {
            return res.status(404).json({ success: false, message: "Project not found" });
        }

        if (!canManageSprint(req, project)) {
            return res.status(403).json({ success: false, message: "Only Project Manager, Team Lead, or Admin can update sprint status" });
        }

        if (status === "Completed") {
            const pendingTasks = await Task.countDocuments({
                sprintId: id,
                status: { $ne: "Completed" }
            });
            if (pendingTasks > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot complete sprint — ${pendingTasks} task(s) still pending`
                });
            }
        }

        sprint.status = status;
        await sprint.save();

        return res.status(200).json({
            success: true,
            message: "Sprint status updated successfully",
            data: sprint,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getProjectSprints = async (req, res) => {
    try {
        const projectId = req.params.projectId || req.params.id;
        const sprints = await Sprint.find({ projectId }).sort({ startDate: 1 });
        return res.status(200).json({ success: true, data: sprints });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getSprintTasks = async (req, res) => {
    try {
        const sprintId = req.params.sprintId || req.params.id;
        const tasks = await Task.find({ sprintId })
            .populate("assignedTo", "firstName lastName email")
            .populate("assignedBy", "firstName lastName email")
            .sort({ createdAt: -1 });

        return res.status(200).json({ success: true, data: tasks });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getSprintById = async (req, res) => {
    try {
        const { id } = req.params;
        const sprint = await Sprint.findById(id).populate("projectId", "projectName");

        if (!sprint) return res.status(404).json({ success: false, message: "Sprint not found" });

        return res.status(200).json({ success: true, data: sprint });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const updateSprint = async (req, res) => {
    try {
        const { id } = req.params;
        const { sprintName, description, startDate, endDate, status } = req.body;

        const sprint = await Sprint.findById(id);
        if (!sprint) return res.status(404).json({ success: false, message: "Sprint not found" });

        const project = await Project.findById(sprint.projectId);
        if (!project) {
            return res.status(404).json({ success: false, message: "Project not found" });
        }

        if (!canManageSprint(req, project)) {
            return res.status(403).json({ success: false, message: "Only Project Manager, Team Lead, or Admin can update this sprint" });
        }

        const newStartDate = startDate !== undefined ? startDate : sprint.startDate;
        const newEndDate = endDate !== undefined ? endDate : sprint.endDate;

        if (new Date(newStartDate) >= new Date(newEndDate)) {
            return res.status(400).json({ success: false, message: "Start date must be before end date" });
        }

        const overlappingSprint = await Sprint.findOne({
            _id: { $ne: id },
            projectId: sprint.projectId,
            $or: [
                { startDate: { $lte: newEndDate }, endDate: { $gte: newStartDate } }
            ]
        });

        if (overlappingSprint) {
            return res.status(400).json({ success: false, message: "Sprint dates overlap with an existing sprint in this project" });
        }

        if (status === "Completed" && sprint.status !== "Completed") {
            const pendingTasks = await Task.countDocuments({
                sprintId: id,
                status: { $ne: "Completed" }
            });
            if (pendingTasks > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot complete sprint — ${pendingTasks} task(s) still pending`
                });
            }
        }

        if (sprintName !== undefined) sprint.sprintName = sprintName;
        if (description !== undefined) sprint.description = description;
        if (startDate !== undefined) sprint.startDate = startDate;
        if (endDate !== undefined) sprint.endDate = endDate;
        if (status !== undefined) sprint.status = status;

        await sprint.save();

        return res.status(200).json({
            success: true,
            message: "Sprint updated successfully",
            data: sprint,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteSprint = async (req, res) => {
    try {
        const { id } = req.params;

        const sprint = await Sprint.findById(id);
        if (!sprint) return res.status(404).json({ success: false, message: "Sprint not found" });

        const project = await Project.findById(sprint.projectId);
        if (!project) {
            return res.status(404).json({ success: false, message: "Project not found" });
        }

        if (!canManageSprint(req, project)) {
            return res.status(403).json({ success: false, message: "Only Project Manager, Team Lead, or Admin can delete this sprint" });
        }

        const pendingTasks = await Task.countDocuments({
            sprintId: id,
            status: { $ne: "Completed" }
        });
        if (pendingTasks > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete sprint — ${pendingTasks} task(s) still pending. Reassign or complete them first.`
            });
        }

        await Sprint.findByIdAndDelete(id);

        return res.status(200).json({ success: true, message: "Sprint deleted successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};