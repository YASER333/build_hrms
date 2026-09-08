import Reimbursement from "../Modules/ReimbursementModule.js";
import ApprovalWorkflow from "../Modules/ApprovalWorkflowModule.js";
import ApprovalRequest from "../Modules/ApprovalRequestModule.js";
import { logAudit } from "../Utils/AuditLogger.js";
import { getPagination, formatPaginatedResponse } from "../Utils/Pagination.js";

// 1. Submit Reimbursement Request
export const submitReimbursement = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const { category, amount, expenseDate, description, receiptUrl } = req.body;

    if (!category || !amount || !expenseDate || !description || !receiptUrl) {
      return res.status(400).json({
        success: false,
        message: "Category, amount, expense date, description, and receipt URL are required.",
      });
    }

    // Create Reimbursement record
    const claim = await Reimbursement.create({
      employeeId,
      category,
      amount: Number(amount),
      expenseDate: new Date(expenseDate),
      description,
      receiptUrl,
      status: "PENDING",
    });

    // Lookup Workflow configuration for REIMBURSEMENT
    let workflowConfig = await ApprovalWorkflow.findOne({ module: "REIMBURSEMENT", isActive: true });
    if (!workflowConfig) {
      workflowConfig = await ApprovalWorkflow.create({
        module: "REIMBURSEMENT",
        title: "Default Reimbursement Approval Workflow",
        approvalLevels: [
          { level: 1, name: "Manager / TL Approval", minimumPriority: 4, requiredApprovals: 1 },
          { level: 2, name: "HR / Finance Approval", minimumPriority: 3, requiredApprovals: 1 },
        ],
        createdBy: employeeId,
      });
    }

    const approvalReq = await ApprovalRequest.create({
      module: "REIMBURSEMENT",
      referenceId: claim._id,
      requester: employeeId,
      workflowConfig: workflowConfig._id,
      currentLevel: 1,
      status: "PENDING",
    });

    claim.approvalRequest = approvalReq._id;
    await claim.save();

    await logAudit({
      req,
      action: "SUBMIT_REIMBURSEMENT",
      module: "REIMBURSEMENT",
      resourceId: claim._id.toString(),
      newState: claim.toObject(),
      details: `Submitted reimbursement claim of ${amount} for category ${category}`,
    });

    return res.status(201).json({
      success: true,
      message: "Reimbursement claim submitted successfully.",
      data: {
        claim,
        approvalRequest: approvalReq,
      },
    });
  } catch (error) {
    console.error("submitReimbursement Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Mark Reimbursement Paid / Settled
export const markReimbursementPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentReference } = req.body;

    const claim = await Reimbursement.findById(id);
    if (!claim) {
      return res.status(404).json({ success: false, message: "Reimbursement claim not found." });
    }

    claim.status = "PAID";
    claim.paidDate = new Date();
    if (paymentReference) claim.paymentReference = paymentReference;

    await claim.save();

    await logAudit({
      req,
      action: "MARK_REIMBURSEMENT_PAID",
      module: "REIMBURSEMENT",
      resourceId: claim._id.toString(),
      details: `Marked reimbursement claim ${id} as PAID with reference ${paymentReference}`,
    });

    return res.status(200).json({
      success: true,
      message: "Reimbursement claim marked as PAID.",
      data: claim,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Get Reimbursement Claims (User or Admin/HR)
export const getReimbursements = async (req, res) => {
  try {
    const { page, limit, skip, sort } = getPagination(req.query);
    const { status, category, selfOnly } = req.query;

    const query = {};
    if (selfOnly === "true" || req.user.priority > 3) {
      query.employeeId = req.user.id;
    }
    if (status) query.status = status;
    if (category) query.category = category;

    const claims = await Reimbursement.find(query)
      .populate("employeeId", "firstName lastName email employeeCode department designation")
      .populate("approvalRequest")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Reimbursement.countDocuments(query);

    return res.status(200).json(formatPaginatedResponse({ data: claims, total, page, limit }));
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
