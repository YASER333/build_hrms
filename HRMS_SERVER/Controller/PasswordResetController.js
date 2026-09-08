import crypto from "crypto";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import PasswordResetRequest from "../Modules/PasswordResetRequestModule.js";
import PasswordResetRule from "../Modules/PasswordResetRuleModule.js";
import User from "../Modules/UserModule.js";

const SALT_ROUNDS = 10;

// ==========================================
// REQUEST PASSWORD RESET (Public - High Performance)
// ==========================================
export const requestPasswordReset = async (req, res) => {
  try {
    const { identifier } = req.body;

    if (!identifier || typeof identifier !== "string" || !identifier.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email or mobile number is required",
      });
    }

    const value = identifier.trim().toLowerCase();

    // Fast indexed query
    const user = await User.findOne({
      $or: [{ email: value }, { mobileNo: value }],
    })
      .select("_id firstName lastName email mobileNo role isActive isBlocked")
      .populate("role", "_id roleName priority")
      .lean();

    if (!user) {
      // Prevent user enumeration
      return res.status(200).json({
        success: true,
        message:
          "If an account with that email/mobile exists, the reset request has been initiated.",
      });
    }

    if (user.isBlocked || !user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is blocked or inactive. Cannot request password reset.",
      });
    }

    if (!user.role) {
      return res.status(400).json({
        success: false,
        message: "No role assigned to user account",
      });
    }

    // Fast lean rule query
    const rule = await PasswordResetRule.findOne({
      requesterRole: user.role._id,
      isActive: true,
    })
      .select("approverRole approvalRequired")
      .lean();

    let approvalRequired = true;
    let approverRoleId = rule?.approverRole || null;

    if (user.role.priority === 1) {
      approvalRequired = false;
    } else if (rule) {
      approvalRequired = Boolean(rule.approvalRequired);
    }

    if (!approvalRequired) {
      // Direct Reset Allowed (Owner or approvalRequired: false)
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto
        .createHash("sha256")
        .update(rawToken)
        .digest("hex");

      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

      const request = await PasswordResetRequest.create({
        userId: user._id,
        requesterRole: user.role._id,
        approverRole: null,
        approvalRequired: false,
        status: "Approved",
        resetTokenHash: tokenHash,
        resetTokenExpiresAt: expiresAt,
      });

      return res.status(201).json({
        success: true,
        message: "Direct password reset allowed. Use token to set new password.",
        approvalRequired: false,
        resetToken: rawToken,
        requestId: request._id,
      });
    }

    // Approval Required -> Create Pending Request
    if (!approverRoleId) {
      return res.status(400).json({
        success: false,
        message:
          "Password reset approval rule is not configured for your role. Contact Admin.",
      });
    }

    // Invalidate prior pending requests in background
    await PasswordResetRequest.updateMany(
      { userId: user._id, status: "Pending" },
      { $set: { status: "Expired" } }
    );

    const pendingRequest = await PasswordResetRequest.create({
      userId: user._id,
      requesterRole: user.role._id,
      approverRole: approverRoleId,
      approvalRequired: true,
      status: "Pending",
    });

    return res.status(201).json({
      success: true,
      message:
        "Password reset request created successfully. Pending approval from configured approver role.",
      approvalRequired: true,
      requestId: pendingRequest._id,
    });
  } catch (error) {
    console.error("Request Password Reset Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to process password reset request",
    });
  }
};

// ==========================================
// GET PENDING APPROVALS (Approver Only - Indexed & Lean)
// ==========================================
export const getPendingApprovals = async (req, res) => {
  try {
    const approverRoleId = req.user.roleId;

    const pendingRequests = await PasswordResetRequest.find({
      status: "Pending",
      approverRole: approverRoleId,
    })
      .populate("userId", "firstName middleName lastName email mobileNo employeeCode")
      .populate("requesterRole", "roleName roleCode priority")
      .populate("approverRole", "roleName roleCode priority")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: pendingRequests,
    });
  } catch (error) {
    console.error("Get Pending Approvals Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch pending approval requests",
    });
  }
};

// ==========================================
// APPROVE OR REJECT REQUEST (Approver Only)
// ==========================================
export const approveOrRejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, rejectionReason } = req.body;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID",
      });
    }

    if (!action || !["approve", "reject"].includes(action.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: "Action must be 'approve' or 'reject'",
      });
    }

    const request = await PasswordResetRequest.findById(id)
      .populate("requesterRole", "_id roleName priority")
      .populate("approverRole", "_id roleName priority");

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Password reset request not found",
      });
    }

    if (request.status !== "Pending") {
      return res.status(400).json({
        success: false,
        message: `Request cannot be processed because current status is '${request.status}'`,
      });
    }

    // Verify approver role authority
    const approverUserRole = req.user.roleId.toString();

    if (
      request.approverRole &&
      request.approverRole._id.toString() !== approverUserRole &&
      req.user.priority > 2
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to approve/reject requests for this role",
      });
    }

    if (action.toLowerCase() === "reject") {
      request.status = "Rejected";
      request.rejectionReason = rejectionReason || "Request rejected by approver";
      request.approvedBy = req.user.id;
      request.approvedAt = new Date();

      await request.save();

      return res.status(200).json({
        success: true,
        message: "Password reset request rejected successfully",
        data: {
          requestId: request._id,
          status: request.status,
          rejectionReason: request.rejectionReason,
        },
      });
    }

    // APPROVE
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    request.status = "Approved";
    request.resetTokenHash = tokenHash;
    request.resetTokenExpiresAt = expiresAt;
    request.approvedBy = req.user.id;
    request.approvedAt = new Date();

    await request.save();

    return res.status(200).json({
      success: true,
      message: "Password reset request approved successfully",
      resetToken: rawToken,
      data: {
        requestId: request._id,
        status: request.status,
        expiresAt: request.resetTokenExpiresAt,
      },
    });
  } catch (error) {
    console.error("Approve/Reject Reset Request Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to process approval decision",
    });
  }
};

// ==========================================
// RESET PASSWORD (Public with Token - High Performance Atomic Updates)
// ==========================================
export const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || typeof resetToken !== "string" || !resetToken.trim()) {
      return res.status(400).json({
        success: false,
        message: "Reset token is required",
      });
    }

    if (
      !newPassword ||
      typeof newPassword !== "string" ||
      newPassword.length < 6
    ) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters long",
      });
    }

    // Compute SHA-256 hash of submitted token
    const tokenHash = crypto
      .createHash("sha256")
      .update(resetToken.trim())
      .digest("hex");

    // Fast compound indexed query on resetTokenHash + status
    const request = await PasswordResetRequest.findOne({
      resetTokenHash: tokenHash,
      status: "Approved",
      resetTokenExpiresAt: { $gt: new Date() },
    })
      .select("_id userId status")
      .lean();

    if (!request) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid, expired, or unapproved reset token. Please request a new password reset.",
      });
    }

    // Parallel atomic password update & request completion
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await Promise.all([
      User.updateOne(
        { _id: request.userId },
        { $set: { password: hashedPassword } }
      ),
      PasswordResetRequest.updateOne(
        { _id: request._id },
        { $set: { status: "Completed", resetTokenHash: null } }
      ),
    ]);

    return res.status(200).json({
      success: true,
      message:
        "Password has been reset successfully. You can now log in with your new password.",
    });
  } catch (error) {
    console.error("Reset Password Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to reset password",
    });
  }
};
