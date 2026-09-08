import mongoose from "mongoose";
import Project from "../Modules/ProjectModule.js";
import User from "../Modules/UserModule.js";
import Task from "../Modules/TaskModule.js";
import Sprint from "../Modules/SprintModule.js";
import TimeTracking from "../Modules/TimeTrackingModule.js";
import RolePermission from "../Modules/RolePermissionModule.js";

export const ALL_PROJECT_PERMISSIONS = [
    "project.read",
    "project.create",
    "project.update",
    "project.delete",
    "project.add_member",
    "project.remove_member"
];

export const isProjectManagerUser = (user) => {
    if (!user) return false;
    const roleCode = user.roleCode || user.role?.roleCode;
    return roleCode === "PROJECT_MANAGER";
};

export const isOwnerOrAdminUser = (user) => {
    if (!user) return false;
    const priority = user.priority ?? user.role?.priority;
    return priority === 1 || priority === 2 || (user.permissions && user.permissions.includes("*"));
};

export const canPerformProjectAction = (req, project, requiredPermission) => {
    if (!req.user || !project) return false;

    // Step 1: Owner / Admin check
    if (isOwnerOrAdminUser(req.user)) {
        return true;
    }

    // Step 2: Check if logged-in user is the assigned Project Manager for this project
    const userId = req.user.id ? req.user.id.toString() : null;
    const isAssignedPM = project.projectManager && project.projectManager.toString() === userId;
    if (!isAssignedPM) {
        return false;
    }

    // Step 3: Check user's actual permissions for the required action
    const userPermissions = req.user.permissions || [];
    if (userPermissions.includes("*") || userPermissions.includes(requiredPermission)) {
        return true;
    }

    return false;
};

export const getEligibleProjectManagers = async (req, res) => {
    try {
        const users = await User.find({ isActive: true, isBlocked: false })
            .select("firstName lastName email role employeeCode")
            .populate({
                path: "role",
                select: "_id roleName roleCode priority isActive isBlock isBlocked"
            })
            .lean();

        const eligibleUsers = [];
        for (const user of users) {
            if (!user.role || !user.role.isActive || user.role.isBlock || user.role.isBlocked) continue;

            // Option A: Seeded Default PM Role
            if (user.role.roleCode === "PROJECT_MANAGER") {
                eligibleUsers.push(user);
                continue;
            }

            // Option B: Custom PM Role (priority === 3 AND has at least one active project.* permission)
            if (user.role.priority === 3) {
                const rolePermissionDocs = await RolePermission.find({ roleId: user.role._id })
                    .populate({ path: "permissionId", select: "permissionCode isActive" })
                    .lean();

                const activePerms = rolePermissionDocs
                    .filter(rp => rp.permissionId && rp.permissionId.isActive)
                    .map(rp => rp.permissionId.permissionCode);

                const hasAnyProjectPerm = activePerms.some(p => p && p.startsWith("project."));
                if (hasAnyProjectPerm) {
                    eligibleUsers.push(user);
                }
            }
        }

        return res.status(200).json({ success: true, data: eligibleUsers });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getCompanyUsersForProject = async (req, res) => {
    try {
        const users = await User.find({ isActive: true, isBlocked: false })
            .select("firstName lastName email role employeeCode")
            .populate({
                path: "role",
                select: "_id roleName roleCode priority"
            })
            .sort({ firstName: 1 })
            .lean();

        return res.status(200).json({ success: true, data: users });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const createProject = async (req, res) => {
    try {
        const { projectName, description, startDate, endDate, estimatedBudget, projectManager } = req.body;

        if (!projectName) {
            return res.status(400).json({ success: false, message: "Project Name is required" });
        }

        const newProject = new Project({
            projectName,
            description,
            startDate,
            endDate,
            estimatedBudget: estimatedBudget || 0,
            projectManager: projectManager || undefined,
            projectManagerAddedBy: projectManager && req.user ? req.user.id : undefined,
        });

        await newProject.save();

        return res.status(201).json({
            success: true,
            message: "Project created successfully",
            data: newProject,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const addProjectMember = async (req, res) => {
    try {
        const { projectId, newMemberId } = req.body;
        const requestorId = req.user ? req.user.id : null;

        const project = await Project.findById(projectId);
        if (!project) return res.status(404).json({ success: false, message: "Project not found" });

        const newMember = await User.findById(newMemberId).populate("role");
        if (!newMember || !newMember.role) return res.status(404).json({ success: false, message: "New member or their role not found" });

        if (requestorId) {
            let isAuthorized = canPerformProjectAction(req, project, "project.add_member");
            if (!isAuthorized) {
                const requestorRoleName = req.user.roleName?.toLowerCase() || "";
                const isTL = project.teamLeads && project.teamLeads.some(tl => tl.userId.toString() === requestorId);
                if (isTL || requestorRoleName === "team lead") {
                    const newMemberRoleName = newMember.role.roleName.toLowerCase();
                    if (!["software developer", "developer", "intern"].includes(newMemberRoleName)) {
                        isAuthorized = false;
                    }
                } else {
                    isAuthorized = false;
                }
            }

            if (!isAuthorized) {
                return res.status(403).json({ success: false, message: "You are not authorized to add this member to the project." });
            }
        }

        const newMemberRoleName = newMember.role.roleName.toLowerCase();

        if (newMemberRoleName === "team lead") {
            if (!project.teamLeads.some(m => m.userId.toString() === newMemberId)) {
                project.teamLeads.push({ userId: newMemberId, addedBy: requestorId });
            } else {
                return res.status(400).json({ success: false, message: "Member already exists in Team Leads" });
            }
        } else if (newMemberRoleName === "intern") {
            if (!project.interns.some(m => m.userId.toString() === newMemberId)) {
                project.interns.push({ userId: newMemberId, addedBy: requestorId });
            } else {
                return res.status(400).json({ success: false, message: "Member already exists in Interns" });
            }
        } else {
            // Default to software Developers array for developers and other member roles
            if (!project.softwareDevelopers.some(m => m.userId.toString() === newMemberId)) {
                project.softwareDevelopers.push({ userId: newMemberId, addedBy: requestorId });
            } else {
                return res.status(400).json({ success: false, message: "Member already exists in Project" });
            }
        }

        await project.save();

        return res.status(200).json({
            success: true,
            message: "Member added successfully",
            data: project
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getProjectDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const project = await Project.findById(id)
            .populate('projectManager', 'firstName lastName email')
            .populate('teamLeads.userId', 'firstName lastName email')
            .populate('softwareDevelopers.userId', 'firstName lastName email')
            .populate('interns.userId', 'firstName lastName email')
            .populate('completedBy', 'firstName lastName email');

        if (!project) return res.status(404).json({ success: false, message: "Project not found" });

        return res.status(200).json({ success: true, data: project });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getAllProjects = async (req, res) => {
    try {
        const projects = await Project.find()
            .populate('projectManager', 'firstName lastName email')
            .sort({ createdAt: -1 });

        return res.status(200).json({ success: true, data: projects });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getMyProjects = async (req, res) => {
    try {
        const userId = req.user.id;
        const userObjId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;

        const projects = await Project.find({
            $or: [
                { projectManager: userId },
                { projectManager: userObjId },
                { "teamLeads.userId": userId },
                { "teamLeads.userId": userObjId },
                { "softwareDevelopers.userId": userId },
                { "softwareDevelopers.userId": userObjId },
                { "interns.userId": userId },
                { "interns.userId": userObjId },
            ],
        })
            .populate('projectManager', 'firstName lastName email')
            .sort({ createdAt: -1 });

        return res.status(200).json({ success: true, data: projects });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const updateProject = async (req, res) => {
    try {
        const { id } = req.params;
        const { projectName, description, startDate, endDate, status, completionNotes, estimatedBudget } = req.body;
        const userId = req.user ? req.user.id : null;

        const project = await Project.findById(id);
        if (!project) return res.status(404).json({ success: false, message: "Project not found" });

        if (userId) {
            if (!canPerformProjectAction(req, project, "project.update")) {
                return res.status(403).json({ success: false, message: "Access denied. Only Owner/Admin or assigned Project Manager with 'project.update' permission can update this project." });
            }
        }

        // Project Completion Rule check if status is set to Completed
        if (status === "Completed") {
            const tasks = await Task.find({ projectId: id });
            const pendingTasks = tasks.filter(t => t.status !== "Completed");
            if (pendingTasks.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: "Cannot mark project as Completed while pending tasks exist",
                    totalTasks: tasks.length,
                    completedTasks: tasks.length - pendingTasks.length,
                    pendingTasks: pendingTasks.length,
                    canClose: false,
                    blockers: [`${pendingTasks.length} tasks are still pending`]
                });
            }
            project.completedBy = userId;
            project.completedAt = new Date();
            if (completionNotes !== undefined) project.completionNotes = completionNotes;
        }

        if (projectName !== undefined) project.projectName = projectName;
        if (description !== undefined) project.description = description;
        if (startDate !== undefined) project.startDate = startDate;
        if (endDate !== undefined) project.endDate = endDate;
        if (status !== undefined) project.status = status;
        if (estimatedBudget !== undefined) project.estimatedBudget = estimatedBudget;

        await project.save();

        return res.status(200).json({
            success: true,
            message: "Project updated successfully",
            data: project,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const updateProjectStatus = updateProject;

export const removeProjectMember = async (req, res) => {
    try {
        const { projectId, memberId, memberRole } = req.body;
        const requestorId = req.user ? req.user.id : null;

        const project = await Project.findById(projectId);
        if (!project) return res.status(404).json({ success: false, message: "Project not found" });

        if (requestorId) {
            let isAuthorized = canPerformProjectAction(req, project, "project.remove_member");
            if (!isAuthorized) {
                const requestorRoleName = req.user.roleName?.toLowerCase() || "";
                const isTL = project.teamLeads && project.teamLeads.some(tl => tl.userId.toString() === requestorId);
                if ((isTL || requestorRoleName === "team lead") && ["softwareDevelopers", "interns"].includes(memberRole)) {
                    isAuthorized = true;
                }
            }

            if (!isAuthorized) {
                return res.status(403).json({ success: false, message: "You are not authorized to remove this member" });
            }
        }

        if (memberRole === "projectManager") {
            if (project.projectManager && project.projectManager.toString() === memberId) {
                project.projectManager = undefined;
                project.projectManagerAddedBy = undefined;
            }
        } else if (memberRole === "teamLeads") {
            project.teamLeads = project.teamLeads.filter(m => m.userId.toString() !== memberId);
        } else if (memberRole === "softwareDevelopers") {
            project.softwareDevelopers = project.softwareDevelopers.filter(m => m.userId.toString() !== memberId);
        } else if (memberRole === "interns") {
            project.interns = project.interns.filter(m => m.userId.toString() !== memberId);
        } else {
            return res.status(400).json({ success: false, message: "Invalid memberRole. Use one of: projectManager, teamLeads, softwareDevelopers, interns" });
        }

        await project.save();

        return res.status(200).json({
            success: true,
            message: "Member removed successfully",
            data: project,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteProject = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user ? req.user.id : null;

        const project = await Project.findById(id);
        if (!project) return res.status(404).json({ success: false, message: "Project not found" });

        if (userId) {
            if (!canPerformProjectAction(req, project, "project.delete")) {
                return res.status(403).json({ success: false, message: "Access denied. Only Owner/Admin or assigned Project Manager with 'project.delete' permission can delete this project." });
            }
        }

        await Project.findByIdAndDelete(id);

        return res.status(200).json({ success: true, message: "Project deleted successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ==========================================
// FEATURE 4: PROJECT COMPLETION & CLOSURE
// ==========================================

export const getProjectCompletionStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const project = await Project.findById(id);
        if (!project) return res.status(404).json({ success: false, message: "Project not found" });

        const tasks = await Task.find({ projectId: id });
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.status === "Completed").length;
        const pendingTasksList = tasks.filter(t => t.status !== "Completed");
        const pendingTasks = pendingTasksList.length;
        const canClose = pendingTasks === 0;

        const blockers = canClose
            ? []
            : [`${pendingTasks} tasks are still pending`];

        return res.status(200).json({
            success: true,
            totalTasks,
            completedTasks,
            pendingTasks,
            canClose,
            blockers,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const completeProject = async (req, res) => {
    try {
        const { id } = req.params;
        const { completionNotes } = req.body;
        const userId = req.user ? req.user.id : req.body.completedBy;

        const project = await Project.findById(id);
        if (!project) return res.status(404).json({ success: false, message: "Project not found" });

        const tasks = await Task.find({ projectId: id });
        const pendingTasksList = tasks.filter(t => t.status !== "Completed");

        if (pendingTasksList.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Cannot complete project while pending tasks exist",
                totalTasks: tasks.length,
                completedTasks: tasks.length - pendingTasksList.length,
                pendingTasks: pendingTasksList.length,
                canClose: false,
                blockers: [`${pendingTasksList.length} tasks are still pending`]
            });
        }

        project.status = "Completed";
        project.completionNotes = completionNotes || project.completionNotes || "All deliverables completed";
        project.completedBy = userId;
        project.completedAt = new Date();

        await project.save();

        return res.status(200).json({
            success: true,
            message: "Project marked as Completed successfully",
            data: project
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ==========================================
// FEATURE 3: TIME SUMMARY FOR PROJECT
// ==========================================

export const getProjectTimeSummary = async (req, res) => {
    try {
        const projectId = req.params.projectId || req.params.id;
        const tasks = await Task.find({ projectId }).select("_id taskName status");
        const taskIds = tasks.map(t => t._id);

        const timeLogs = await TimeTracking.find({ taskId: { $in: taskIds } }).populate("userId", "firstName lastName");

        const totalDurationMinutes = timeLogs.reduce((acc, log) => acc + (log.durationMinutes || 0), 0);
        const totalHours = Math.round((totalDurationMinutes / 60) * 10) / 10;

        return res.status(200).json({
            success: true,
            projectId,
            totalDurationMinutes,
            totalHoursLogged: totalHours,
            totalLogs: timeLogs.length,
            timeLogs,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ==========================================
// FEATURE 5: PROJECT METRICS & ANALYTICS
// ==========================================

export const getProjectMetrics = async (req, res) => {
    try {
        const { id } = req.params;
        const project = await Project.findById(id)
            .populate('projectManager', 'firstName lastName email')
            .populate('teamLeads.userId', 'firstName lastName email')
            .populate('softwareDevelopers.userId', 'firstName lastName email')
            .populate('interns.userId', 'firstName lastName email');

        if (!project) return res.status(404).json({ success: false, message: "Project not found" });

        const tasks = await Task.find({ projectId: id });
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.status === "Completed").length;
        const inProgressTasks = tasks.filter(t => t.status === "In Progress" || t.status === "Testing").length;
        const pendingTasks = tasks.filter(t => t.status === "To Do").length;

        const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        // Team members calculation
        const teamMemberIds = new Set();
        if (project.projectManager) teamMemberIds.add(project.projectManager._id.toString());
        (project.teamLeads || []).forEach(m => m.userId && teamMemberIds.add(m.userId._id.toString()));
        (project.softwareDevelopers || []).forEach(m => m.userId && teamMemberIds.add(m.userId._id.toString()));
        (project.interns || []).forEach(m => m.userId && teamMemberIds.add(m.userId._id.toString()));

        // Total hours logged
        const taskIds = tasks.map(t => t._id);
        const timeLogs = await TimeTracking.find({ taskId: { $in: taskIds } });
        const totalDurationMinutes = timeLogs.reduce((acc, log) => acc + (log.durationMinutes || 0), 0);
        const totalHoursLogged = Math.round((totalDurationMinutes / 60) * 10) / 10;

        // Timeline status
        let timelineStatus = "On Track";
        if (project.status === "Completed") {
            timelineStatus = "Completed";
        } else if (project.endDate && new Date() > new Date(project.endDate) && completedTasks < totalTasks) {
            timelineStatus = "Overdue";
        } else if (project.endDate) {
            const daysRemaining = Math.ceil((new Date(project.endDate) - new Date()) / (1000 * 60 * 60 * 24));
            if (daysRemaining <= 3 && progress < 70) {
                timelineStatus = "At Risk";
            }
        }

        return res.status(200).json({
            success: true,
            data: {
                projectName: project.projectName,
                status: project.status,
                progress,
                totalTasks,
                completedTasks,
                inProgressTasks,
                pendingTasks,
                totalHoursLogged,
                estimatedBudget: project.estimatedBudget || 0,
                timelineStatus,
                teamCount: teamMemberIds.size,
                teamBreakdown: {
                    projectManagers: project.projectManager ? 1 : 0,
                    teamLeads: (project.teamLeads || []).length,
                    developers: (project.softwareDevelopers || []).length,
                    interns: (project.interns || []).length,
                }
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getProjectSprintMetrics = async (req, res) => {
    try {
        const { id } = req.params;
        const project = await Project.findById(id);
        if (!project) return res.status(404).json({ success: false, message: "Project not found" });

        const sprints = await Sprint.find({ projectId: id }).sort({ startDate: 1 });
        const activeSprint = sprints.find(s => s.status === "Active") || sprints[sprints.length - 1] || null;

        const tasks = await Task.find({ projectId: id });
        const totalPoints = tasks.reduce((acc, t) => acc + (t.storyPoints || 0), 0);
        const completedPoints = tasks.filter(t => t.status === "Completed").reduce((acc, t) => acc + (t.storyPoints || 0), 0);

        // Sprint velocity: average completed story points per completed sprint
        const completedSprints = sprints.filter(s => s.status === "Completed");
        let velocity = 0;
        if (completedSprints.length > 0) {
            const completedSprintsIds = completedSprints.map(s => s._id);
            const sprintTasks = tasks.filter(t => t.sprintId && completedSprintsIds.some(sid => sid.toString() === t.sprintId.toString()) && t.status === "Completed");
            const sprintCompletedPoints = sprintTasks.reduce((acc, t) => acc + (t.storyPoints || 0), 0);
            velocity = Math.round((sprintCompletedPoints / completedSprints.length) * 10) / 10;
        }

        // Burndown chart structure per sprint
        const burndown = sprints.map(sprint => {
            const sprintTasks = tasks.filter(t => t.sprintId && t.sprintId.toString() === sprint._id.toString());
            const sprintTotalPoints = sprintTasks.reduce((acc, t) => acc + (t.storyPoints || 0), 0);
            const sprintDonePoints = sprintTasks.filter(t => t.status === "Completed").reduce((acc, t) => acc + (t.storyPoints || 0), 0);
            return {
                sprintId: sprint._id,
                sprintName: sprint.sprintName,
                status: sprint.status,
                startDate: sprint.startDate,
                endDate: sprint.endDate,
                totalPoints: sprintTotalPoints,
                completedPoints: sprintDonePoints,
                remainingPoints: sprintTotalPoints - sprintDonePoints
            };
        });

        return res.status(200).json({
            success: true,
            data: {
                currentSprint: activeSprint ? {
                    id: activeSprint._id,
                    sprintName: activeSprint.sprintName,
                    status: activeSprint.status,
                    startDate: activeSprint.startDate,
                    endDate: activeSprint.endDate
                } : null,
                completedPoints,
                totalPoints,
                velocity,
                burndown
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};