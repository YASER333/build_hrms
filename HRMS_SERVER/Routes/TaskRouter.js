import express from "express";
import {
    createTask,
    updateTaskStatus,
    reassignTask,
    getMyTasks,
    getTaskById,
    getTasksByProject,
    getTasksBySprint,
    updateTask,
    deleteTask
} from "../Controller/TaskController.js";
import { Authentication, requirePermission } from "../Middleware/Auth.js";

const router = express.Router();

router.use(Authentication);

// Task Management Routes
router.post("/create", requirePermission("project.update"), createTask);
router.put("/:id/status", requirePermission("project.read"), updateTaskStatus);
router.put("/:id/reassign", requirePermission("project.update"), reassignTask);
router.get("/my-tasks", requirePermission("project.read"), getMyTasks);
router.get("/project/:projectId", requirePermission("project.read"), getTasksByProject);
router.get("/sprint/:sprintId", requirePermission("project.read"), getTasksBySprint);
router.get("/:id", requirePermission("project.read"), getTaskById);
router.put("/:id", requirePermission("project.update"), updateTask);
router.delete("/delete/:id", requirePermission("project.delete"), deleteTask);

export default router;