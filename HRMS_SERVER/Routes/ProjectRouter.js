import express from "express";
import {
    createProject,
    addProjectMember,
    getProjectDetails,
    deleteProject,
    getAllProjects,
    getMyProjects,
    updateProject,
    updateProjectStatus,
    removeProjectMember,
    getProjectCompletionStatus,
    completeProject,
    getProjectTimeSummary,
    getProjectMetrics,
    getProjectSprintMetrics,
    getEligibleProjectManagers,
    getCompanyUsersForProject,
} from "../Controller/ProjectController.js";
import { getProjectSprints } from "../Controller/SprintController.js";
import { getTasksByProject } from "../Controller/TaskController.js";
import { Authentication, requirePermission } from "../Middleware/Auth.js";

const router = express.Router();

router.use(Authentication);

// Read Projects & Details
router.get("/getAllProjects", requirePermission("project.read"), getAllProjects);
router.get("/getMyProjects", requirePermission("project.read"), getMyProjects);
router.get("/getEligiblePMs", requirePermission("project.read"), getEligibleProjectManagers);
router.get("/getCompanyUsers", requirePermission("project.read"), getCompanyUsersForProject);
router.get("/getProjectDetails/:id", requirePermission("project.read"), getProjectDetails);

// Feature 1 & 2: Project-level Sprints & Tasks
router.get("/:projectId/sprints", requirePermission("project.read"), getProjectSprints);
router.get("/:projectId/tasks", requirePermission("project.read"), getTasksByProject);

// Feature 3: Time Summary
router.get("/:projectId/time-summary", requirePermission("project.read"), getProjectTimeSummary);

// Feature 4: Completion & Closure
router.get("/:id/completion-status", requirePermission("project.read"), getProjectCompletionStatus);
router.put("/:id/complete", requirePermission("project.update"), completeProject);
router.put("/:id/status", requirePermission("project.update"), updateProjectStatus);

// Feature 5: Metrics & Analytics
router.get("/:id/metrics", requirePermission("project.read"), getProjectMetrics);
router.get("/:id/sprint-metrics", requirePermission("project.read"), getProjectSprintMetrics);

// Project Mutations (RBAC Protected)
router.post("/create", requirePermission("project.create"), createProject);
router.put("/updateProject/:id", requirePermission("project.update"), updateProject);
router.delete("/deleteProject/:id", requirePermission("project.delete"), deleteProject);

// Member Management (RBAC Protected)
router.post("/addMember", requirePermission("project.add_member"), addProjectMember);
router.post("/removeMember", requirePermission("project.remove_member"), removeProjectMember);

export default router;