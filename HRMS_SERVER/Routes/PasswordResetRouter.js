import express from "express";
import {
  requestPasswordReset,
  getPendingApprovals,
  approveOrRejectRequest,
  resetPassword,
} from "../Controller/PasswordResetController.js";
import { Authentication } from "../Middleware/Auth.js";

const router = express.Router();

// Public endpoints
router.post("/request", requestPasswordReset);
router.post("/reset-password", resetPassword);

// Protected approver endpoints
router.get("/pending-approvals", Authentication, getPendingApprovals);
router.put("/approve-reject/:id", Authentication, approveOrRejectRequest);

export default router;
