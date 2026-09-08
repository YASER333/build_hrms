import express from "express";
import {
  createOrUpdateWorkflow,
  getWorkflows,
  getPendingApprovals,
  processApprovalAction,
} from "../Controller/ApprovalWorkflowController.js";
import { Authendication, isAdmin, checkPermission } from "../Middleware/Auth.js";

const router = express.Router();

router.use(Authendication);

// Super Admin workflow configuration
router.post("/configure", isAdmin, createOrUpdateWorkflow);
router.get("/workflows", getWorkflows);

// Approval actions & pending queue
router.get("/pending-requests", getPendingApprovals);
router.post("/process-action", processApprovalAction);

export default router;
