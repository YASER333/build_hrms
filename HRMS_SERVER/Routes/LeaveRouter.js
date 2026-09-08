import express from "express";
import {
  applyLeave,
  getLeaveBalance,
  getMyLeaves,
  getTeamLeaves,
  getAllLeaves,
  getLeaveById,
  cancelLeave,
  approveLeave,
  rejectLeave,
  getLeaveAudit,
  deleteLeave
} from "../Controller/LeaveController.js";
import { Authentication, requirePermission } from "../Middleware/Auth.js";

const router = express.Router();

// Require Authentication for all leave routes
router.use(Authentication);

// Employee Self-Service Endpoints
router.post("/apply", requirePermission("leave.create.own"), applyLeave);
router.post("/", requirePermission("leave.create.own"), applyLeave);
router.get("/balance", requirePermission("leave.read.own"), getLeaveBalance);
router.get("/my", requirePermission("leave.read.own"), getMyLeaves);

// Management & Team Endpoints
router.get("/team", requirePermission("leave.read.team"), getTeamLeaves);
router.get("/all", requirePermission("leave.read.all"), getAllLeaves);

// Details & Audit
router.get("/audit/:id", requirePermission("leave.audit"), getLeaveAudit);
router.get("/:id", requirePermission("leave.read.own"), getLeaveById);

// Status Transition Endpoints
router.put("/cancel/:id", requirePermission("leave.cancel.own"), cancelLeave);
router.put("/:id/cancel", requirePermission("leave.cancel.own"), cancelLeave);
router.put("/approve/:id", requirePermission("leave.approve"), approveLeave);
router.put("/:id/approve", requirePermission("leave.approve"), approveLeave);
router.put("/reject/:id", requirePermission("leave.reject"), rejectLeave);
router.put("/:id/reject", requirePermission("leave.reject"), rejectLeave);

// Disabled Delete Endpoint
router.delete("/:id", deleteLeave);

export default router;
