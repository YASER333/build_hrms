import Resignation from "../Modules/ResignationModule.js";
import User from "../Modules/UserModule.js";
import ApprovalWorkflow from "../Modules/ApprovalWorkflowModule.js";
import ApprovalRequest from "../Modules/ApprovalRequestModule.js";
import { logAudit } from "../Utils/AuditLogger.js";
import { getPagination, formatPaginatedResponse } from "../Utils/Pagination.js";

// Helper to calculate last working date from notice period
const calculateLastWorkingDate = (startDate, noticePeriodDays = 60) => {
  const date = new Date(startDate);
  date.setDate(date.getDate() + noticePeriodDays);
  return date;
};

// 1. Submit Resignation
export const submitResignation = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const { reason, comments, requestedLastWorkingDate } = req.body;

    if (!reason) {
      return res.status(400).json({ success: false, message: "Resignation reason is required." });
    }

    const user = await User.findById(employeeId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const existingResignation = await Resignation.findOne({
      employeeId,
      status: "PENDING",
    });
    if (existingResignation) {
      return res.status(400).json({
        success: false,
        message: "You already have a pending resignation request.",
      });
    }

    const noticeDays = user.noticePeriodDays || 60;
    const computedLWD = calculateLastWorkingDate(new Date(), noticeDays);
    const finalLWD = requestedLastWorkingDate ? new Date(requestedLastWorkingDate) : computedLWD;

    // Create Resignation Record
    const resignation = await Resignation.create({
      employeeId,
      reason,
      comments: comments || "",
      resignationDate: new Date(),
      requestedLastWorkingDate: finalLWD,
      status: "PENDING",
    });

    // Lookup Workflow configuration for RESIGNATION
    let workflowConfig = await ApprovalWorkflow.findOne({ module: "RESIGNATION", isActive: true });
    if (!workflowConfig) {
      // Fallback standard workflow
      workflowConfig = await ApprovalWorkflow.create({
        module: "RESIGNATION",
        title: "Default Resignation Approval Workflow",
        approvalLevels: [
          { level: 1, name: "Team Lead Approval", minimumPriority: 4, requiredApprovals: 1 },
          { level: 2, name: "HR Approval", minimumPriority: 3, requiredApprovals: 1 },
        ],
        createdBy: employeeId,
      });
    }

    // Create Approval Request
    const approvalReq = await ApprovalRequest.create({
      module: "RESIGNATION",
      referenceId: resignation._id,
      requester: employeeId,
      workflowConfig: workflowConfig._id,
      currentLevel: 1,
      status: "PENDING",
    });

    resignation.approvalRequest = approvalReq._id;
    await resignation.save();

    // Transition employee status to NOTICE_PERIOD
    user.lifecycleStatus = "NOTICE_PERIOD";
    user.resignationDate = new Date();
    user.lastWorkingDate = finalLWD;
    await user.save();

    await logAudit({
      req,
      action: "SUBMIT_RESIGNATION",
      module: "RESIGNATION",
      resourceId: resignation._id.toString(),
      newState: resignation.toObject(),
      details: `Employee ${user.employeeCode} submitted resignation with LWD ${finalLWD.toISOString()}`,
    });

    return res.status(201).json({
      success: true,
      message: "Resignation submitted successfully and sent for approval.",
      data: {
        resignation,
        approvalRequest: approvalReq,
      },
    });
  } catch (error) {
    console.error("submitResignation Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Withdraw Resignation
export const withdrawResignation = async (req, res) => {
  try {
    const { id } = req.params;
    const employeeId = req.user.id;

    const resignation = await Resignation.findById(id);
    if (!resignation) {
      return res.status(404).json({ success: false, message: "Resignation record not found." });
    }

    if (resignation.employeeId.toString() !== employeeId.toString() && req.user.priority > 2) {
      return res.status(403).json({ success: false, message: "Unauthorized to withdraw this resignation." });
    }

    if (resignation.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: `Cannot withdraw resignation in status '${resignation.status}'. Only PENDING resignations can be withdrawn.`,
      });
    }

    resignation.status = "WITHDRAWN";
    await resignation.save();

    if (resignation.approvalRequest) {
      await ApprovalRequest.findByIdAndUpdate(resignation.approvalRequest, { status: "CANCELLED" });
    }

    // Revert user lifecycle status to ACTIVE
    await User.findByIdAndUpdate(resignation.employeeId, {
      lifecycleStatus: "ACTIVE",
      resignationDate: null,
      lastWorkingDate: null,
    });

    await logAudit({
      req,
      action: "WITHDRAW_RESIGNATION",
      module: "RESIGNATION",
      resourceId: resignation._id.toString(),
      details: `Resignation ${id} withdrawn by user`,
    });

    return res.status(200).json({
      success: true,
      message: "Resignation withdrawn successfully. Lifecycle status reverted to ACTIVE.",
      data: resignation,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Get All Resignation Records
export const getAllResignations = async (req, res) => {
  try {
    const { page, limit, skip, sort } = getPagination(req.query);
    const { status, department } = req.query;

    const query = {};
    if (status) query.status = status;

    const resignations = await Resignation.find(query)
      .populate("employeeId", "firstName lastName email employeeCode department designation noticePeriodDays")
      .populate("approvalRequest")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Resignation.countDocuments(query);

    return res.status(200).json(formatPaginatedResponse({ data: resignations, total, page, limit }));
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 4. Record Exit Interview & Handover Tasks
export const updateExitDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { handoverTasks, exitInterview, approvedLastWorkingDate, fullAndFinalSettlementStatus, relievingLetterStatus } = req.body;

    const resignation = await Resignation.findById(id);
    if (!resignation) {
      return res.status(404).json({ success: false, message: "Resignation record not found." });
    }

    if (approvedLastWorkingDate) resignation.approvedLastWorkingDate = new Date(approvedLastWorkingDate);
    if (handoverTasks && Array.isArray(handoverTasks)) resignation.handoverTasks = handoverTasks;
    if (exitInterview) resignation.exitInterview = { ...resignation.exitInterview, ...exitInterview, completedAt: new Date() };
    if (fullAndFinalSettlementStatus) resignation.fullAndFinalSettlementStatus = fullAndFinalSettlementStatus;
    if (relievingLetterStatus) resignation.relievingLetterStatus = relievingLetterStatus;

    await resignation.save();

    await logAudit({
      req,
      action: "UPDATE_RESIGNATION_EXIT_DETAILS",
      module: "RESIGNATION",
      resourceId: resignation._id.toString(),
      newState: resignation.toObject(),
      details: `Updated exit interview and handover details for resignation ${id}`,
    });

    return res.status(200).json({
      success: true,
      message: "Resignation exit details updated successfully.",
      data: resignation,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
