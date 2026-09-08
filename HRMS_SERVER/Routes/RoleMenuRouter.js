import express from "express";
import {
  createRoleMenu,
  bulkAssignRoleMenus,
  getAllRoleMenus,
  getRoleMenusByRoleId,
  getRoleMenuById,
  updateRoleMenu,
  deleteRoleMenu
} from "../Controller/RoleMenuController.js";
import { Authentication, isAdmin } from "../Middleware/Auth.js";

const router = express.Router();

router.use(Authentication);

router.post("/create", isAdmin, createRoleMenu);
router.post("/bulk-assign", isAdmin, bulkAssignRoleMenus);

router.get("/", getAllRoleMenus);
router.get("/role/:roleId", getRoleMenusByRoleId);
router.get("/:id", getRoleMenuById);

router.put("/:id", isAdmin, updateRoleMenu);
router.delete("/:id", isAdmin, deleteRoleMenu);

export default router;
