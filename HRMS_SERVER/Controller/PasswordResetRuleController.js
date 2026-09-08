import mongoose from "mongoose";
import PasswordResetRule from "../Modules/PasswordResetRuleModule.js";
import Role from "../Modules/RoleModules.js";

// ==========================================
// CREATE OR UPDATE RULE (Admin Only)
// ==========================================
export const createOrUpdateRule = async (req, res) => {
  try {
    const { requesterRole, approverRole, approvalRequired, isActive } = req.body;

    if (!requesterRole || !mongoose.Types.ObjectId.isValid(requesterRole)) {
      return res.status(400).json({
        success: false,
        message: "Valid requesterRole ID is required",
      });
    }

    const requesterRoleDoc = await Role.findById(requesterRole)
      .select("_id roleName priority")
      .lean();

    if (!requesterRoleDoc) {
      return res.status(404).json({
        success: false,
        message: "Requester role not found",
      });
    }

    const isApprovalRequired =
      approvalRequired !== undefined ? Boolean(approvalRequired) : true;

    let approverRoleId = null;
    let approverRoleDoc = null;

    if (isApprovalRequired) {
      if (!approverRole || !mongoose.Types.ObjectId.isValid(approverRole)) {
        return res.status(400).json({
          success: false,
          message: "Valid approverRole ID is required when approval is required",
        });
      }

      if (approverRole.toString() === requesterRole.toString()) {
        return res.status(400).json({
          success: false,
          message: "Approver role cannot be the same as requester role",
        });
      }

      approverRoleDoc = await Role.findById(approverRole)
        .select("_id roleName priority")
        .lean();

      if (!approverRoleDoc) {
        return res.status(404).json({
          success: false,
          message: "Approver role not found",
        });
      }

      // Priority Validation (Lower number = Higher authority)
      if (approverRoleDoc.priority >= requesterRoleDoc.priority) {
        return res.status(400).json({
          success: false,
          message: `Configured approver role (${approverRoleDoc.roleName}, priority ${approverRoleDoc.priority}) must have a higher authority level (lower priority number) than the requester role (${requesterRoleDoc.roleName}, priority ${requesterRoleDoc.priority}).`,
        });
      }

      approverRoleId = approverRoleDoc._id;
    }

    const ruleData = {
      requesterRole: requesterRoleDoc._id,
      approverRole: approverRoleId,
      approvalRequired: isApprovalRequired,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    };

    const rule = await PasswordResetRule.findOneAndUpdate(
      { requesterRole: requesterRoleDoc._id },
      { $set: ruleData },
      { new: true, upsert: true, runValidators: true }
    )
      .populate("requesterRole", "roleName priority")
      .populate("approverRole", "roleName priority");

    return res.status(200).json({
      success: true,
      message: "Password reset rule configured successfully",
      data: rule,
    });
  } catch (error) {
    console.error("Create/Update Rule Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to configure password reset rule",
    });
  }
};

// ==========================================
// GET ALL RULES
// ==========================================
export const getAllRules = async (req, res) => {
  try {
    const rules = await PasswordResetRule.find()
      .populate("requesterRole", "roleName roleCode priority")
      .populate("approverRole", "roleName roleCode priority")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: rules,
    });
  } catch (error) {
    console.error("Get All Rules Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch password reset rules",
    });
  }
};

// ==========================================
// GET RULE BY REQUESTER ROLE ID
// ==========================================
export const getRuleByRole = async (req, res) => {
  try {
    const { roleId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(roleId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role ID",
      });
    }

    const rule = await PasswordResetRule.findOne({ requesterRole: roleId })
      .populate("requesterRole", "roleName roleCode priority")
      .populate("approverRole", "roleName roleCode priority")
      .lean();

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: "No password reset rule configured for this role",
      });
    }

    return res.status(200).json({
      success: true,
      data: rule,
    });
  } catch (error) {
    console.error("Get Rule By Role Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch password reset rule",
    });
  }
};

// ==========================================
// DELETE RULE
// ==========================================
export const deleteRule = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid rule ID",
      });
    }

    const rule = await PasswordResetRule.findByIdAndDelete(id).lean();

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: "Password reset rule not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Password reset rule deleted successfully",
    });
  } catch (error) {
    console.error("Delete Rule Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete password reset rule",
    });
  }
};
