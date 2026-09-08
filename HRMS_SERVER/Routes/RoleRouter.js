import express from "express";
import {
  createCustomRole,
  getAllRoles,
  getRoleAccessConfig,
  updateCustomRole,
  deleteRole,
  getAssignableRoles,
} from "../Controller/RoleController.js";
import { Authentication, isAdmin, requirePermission } from "../Middleware/Auth.js";

const router = express.Router();

router.use(Authentication);

// Read assignable roles based on current user's authority
router.get("/assignable-roles", getAssignableRoles);

// Read role catalog & access configurations
router.get("/", requirePermission("role.read"), getAllRoles);
router.get("/:id", requirePermission("role.read"), getRoleAccessConfig);
router.get("/:id/access", requirePermission("role.read"), getRoleAccessConfig);

// Role creation & customization (Admin / Authorized Role Creator)
router.post("/custom-role", isAdmin, createCustomRole);
router.post("/", isAdmin, createCustomRole);

// Role update & customization
router.put("/custom-role/:id", isAdmin, updateCustomRole);
router.put("/:id", isAdmin, updateCustomRole);

// Delete custom role
router.delete("/:id", isAdmin, deleteRole);

export default router;