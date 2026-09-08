import express from "express";
import {
    createSprint,
    getProjectSprints,
    getSprintById,
    updateSprint,
    updateSprintStatus,
    getSprintTasks,
    deleteSprint
} from "../Controller/SprintController.js";
import { Authentication, requirePermission } from "../Middleware/Auth.js";

const router = express.Router();

router.use(Authentication);

// Sprint Management Routes
router.post("/create", requirePermission("project.update"), createSprint);
router.put("/:id/status", requirePermission("project.update"), updateSprintStatus);
router.get("/project/:projectId", requirePermission("project.read"), getProjectSprints);
router.get("/:sprintId/tasks", requirePermission("project.read"), getSprintTasks);

// Legacy/Helper Routes
router.get("/getByProject/:projectId", requirePermission("project.read"), getProjectSprints);
router.get("/getById/:id", requirePermission("project.read"), getSprintById);
router.put("/update/:id", requirePermission("project.update"), updateSprint);
router.delete("/delete/:id", requirePermission("project.delete"), deleteSprint);

export default router;