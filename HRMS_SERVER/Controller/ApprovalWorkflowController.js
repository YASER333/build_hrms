import ApprovalWorkflow from "../Modules/ApprovalWorkflowModule.js";
import ApprovalRequest from "../Modules/ApprovalRequestModule.js";
import User from "../Modules/UserModule.js";
import { logAudit } from "../Utils/AuditLogger.js";
import { getPagination, formatPaginatedResponse } from "../Utils/Pagination.js";

// Seed default workflows if none exist
export const seedDefaultWorkflows = async (adminUserId) => {
  const modules = ["RESIGNATION", "REIMBURSEMENT", "LEAVE", "OFFBOARDING"];
  for (const mod of modules) {
    const exists = await ApprovalWorkflow.exists({ module: mod });
    if (!exists) {
      await ApprovalWorkflow.create({
        module: mod,
        title: `${mod} Standard Approval Workflow`,
        description: `Configurable role-priority based approval workflow for ${mod}`,
        approvalLevels: [
          { level: 1, name: "Team Lead Approval", minimumPriority: 4, requiredApprovals: 1 },
          { level: 2, name: "HR Approval", minimumPriority: 3, requiredApprovals: 1 },
          { level: 3, name: "Admin Final Approval", minimumPriority: 2, requiredApprovals: 1 },
        ],
        allowSelfApproval: false,
        isActive: true,
        createdBy: adminUserId,
      });
    }
  }
};

// Create or Update Approval Workflow configuration
export const createOrUpdateWorkflow = async (req, res) => {
  try {
    const { module, title, description, approvalLevels, allowSelfApproval, isActive } = req.body;

    if (!module || !approvalLevels || !Array.isArray(approvalLevels) || approvalLevels.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Module name and at least one approval level are required.",
      });
    }

    let workflow = await ApprovalWorkflow.findOne({ module });
    const prev = workflow ? workflow.toObject() : null;

    if (workflow) {
      workflow.title = title || workflow.title;
      workflow.description = description !== undefined ? description : workflow.description;
      workflow.approvalLevels = approvalLevels;
      workflow.allowSelfApproval = allowSelfApproval !== undefined ? allowSelfApproval : workflow.allowSelfApproval;
      workflow.isActive = isActive !== undefined ? isActive : workflow.isActive;
      await workflow.save();
    } else {
      workflow = await ApprovalWorkflow.create({
        module,
        title,
        description,
        approvalLevels,
        allowSelfApproval: !!allowSelfApproval,
        isActive: isActive !== undefined ? isActive : true,
        createdBy: req.user.id,
      });
    }

    await logAudit({
      req,
      action: prev ? "UPDATE_APPROVAL_WORKFLOW" : "CREATE_APPROVAL_WORKFLOW",
      module: "APPROVAL_WORKFLOW",
      resourceId: workflow._id.toString(),
      previousState: prev,
      newState: workflow.toObject(),
      details: `Configured workflow for module ${module}`,
    });

    return res.status(200).json({
      success: true,
      message: "Approval workflow configuration saved successfully.",
      data: workflow,
    });
  } catch (error) {
    console.error("createOrUpdateWorkflow Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get all workflow configurations
export const getWorkflows = async (req, res) => {
  try {
    const workflows = await ApprovalWorkflow.find().populate("createdBy", "firstName lastName email");
    return res.status(200).json({ success: true, data: workflows });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get pending approval requests for current user based on authority priority
export const getPendingApprovals = async (req, res) => {
  try {
    const { page, limit, skip, sort } = getPagination(req.query);
    const userPriority = req.user.priority;

    // Fetch requests in PENDING status
    const requests = await ApprovalRequest.find({ status: "PENDING" })
      .populate("requester", "firstName lastName employeeCode email department designation")
      .populate("workflowConfig")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    // Filter requests where the current level's minimumPriority >= userPriority (User has equal or higher authority)
    const eligibleRequests = requests.filter((reqItem) => {
      if (!reqItem.workflowConfig) return false;
      const currentLevelConfig = reqItem.workflowConfig.approvalLevels.find(
        (l) => l.level === reqItem.currentLevel
      );
      if (!currentLevelConfig) return false;

      // Prevent self approval check if not allowed
      if (!reqItem.workflowConfig.allowSelfApproval && reqItem.requester._id.toString() === req.user.id.toString()) {
        return false;
      }

      // Check priority requirement: lower number = higher authority level
      return userPriority <= currentLevelConfig.minimumPriority;
    });

    const total = eligibleRequests.length;

    return res.status(200).json(formatPaginatedResponse({
      data: eligibleRequests,
      total,
      page,
      limit,
    }));
  } catch (error) {
    console.error("getPendingApprovals Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Process Approval / Rejection Action
export const processApprovalAction = async (req, res) => {
  try {
    const { requestId, action, comments } = req.body; // action: "APPROVED" | "REJECTED" | "CANCELLED"
    const approverId = req.user.id;
    const approverPriority = req.user.priority;

    if (!requestId || !["APPROVED", "REJECTED", "CANCELLED"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Valid requestId and action ('APPROVED' | 'REJECTED' | 'CANCELLED') are required.",
      });
    }

    const approvalReq = await ApprovalRequest.findById(requestId).populate("workflowConfig");
    if (!approvalReq) {
      return res.status(404).json({ success: false, message: "Approval request not found." });
    }

    if (approvalReq.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: `Request is already in '${approvalReq.status}' status.`,
      });
    }

    const workflow = approvalReq.workflowConfig;
    const currentLevelConfig = workflow.approvalLevels.find((l) => l.level === approvalReq.currentLevel);

    if (!currentLevelConfig) {
      return res.status(400).json({ success: false, message: "Invalid workflow level configuration." });
    }

    // 1. Self Approval Check
    if (!workflow.allowSelfApproval && approvalReq.requester.toString() === approverId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Self-approval is disabled for this workflow.",
      });
    }

    // 2. Authority Priority Check: Approver priority must be <= required minimumPriority
    if (approverPriority > currentLevelConfig.minimumPriority) {
      return res.status(403).json({
        success: false,
        message: `Insufficient authority level. Priority required: <= ${currentLevelConfig.minimumPriority}, your priority: ${approverPriority}`,
      });
    }

    // Record history
    approvalReq.history.push({
      level: approvalReq.currentLevel,
      approver: approverId,
      action,
      comments: comments || "",
      actionDate: new Date(),
    });

    if (action === "REJECTED" || action === "CANCELLED") {
      approvalReq.status = action;
    } else if (action === "APPROVED") {
      const isLastLevel = approvalReq.currentLevel >= workflow.approvalLevels.length;
      if (isLastLevel) {
        approvalReq.status = "APPROVED";
      } else {
        approvalReq.currentLevel += 1;
      }
    }

    await approvalReq.save();

    await logAudit({
      req,
      action: `APPROVAL_ACTION_${action}`,
      module: "APPROVAL_WORKFLOW",
      resourceId: approvalReq._id.toString(),
      newState: { status: approvalReq.status, currentLevel: approvalReq.currentLevel },
      details: `Approver decision '${action}' at level ${approvalReq.currentLevel} for module ${approvalReq.module}`,
    });

    return res.status(200).json({
      success: true,
      message: `Approval request processed successfully: ${action}`,
      data: approvalReq,
    });
  } catch (error) {
    console.error("processApprovalAction Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
