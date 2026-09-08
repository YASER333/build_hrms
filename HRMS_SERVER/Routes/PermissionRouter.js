import express from "express";
import {
  getPermissionCatalog,
  getAllPermissions,
  createPermission,
} from "../Controller/PermissionController.js";
import { Authentication, isAdmin, requirePermission } from "../Middleware/Auth.js";

const router = express.Router();

router.use(Authentication);

// Permission catalog for role creator UI
router.get("/catalog", getPermissionCatalog);

// Permission administration
router.get("/", requirePermission("role.read"), getAllPermissions);
router.post("/create", isAdmin, createPermission);

export default router;
