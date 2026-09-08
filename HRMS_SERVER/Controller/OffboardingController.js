import Offboarding from "../Modules/OffboardingModule.js";
import User from "../Modules/UserModule.js";
import Resignation from "../Modules/ResignationModule.js";
import Asset from "../Modules/AssetModule.js";
import { logAudit } from "../Utils/AuditLogger.js";
import { getPagination, formatPaginatedResponse } from "../Utils/Pagination.js";

// 1. Initiate Offboarding Process
export const initiateOffboarding = async (req, res) => {
  try {
    const { employeeId, exitType, lastWorkingDay, resignationRef } = req.body;

    if (!employeeId || !exitType || !lastWorkingDay) {
      return res.status(400).json({
        success: false,
        message: "Employee ID, exit type, and last working day are required.",
      });
    }

    const user = await User.findById(employeeId);
    if (!user) {
      return res.status(404).json({ success: false, message: "Employee not found." });
    }

    const existing = await Offboarding.findOne({ employeeId, status: { $ne: "CANCELLED" } });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "An active offboarding process already exists for this employee.",
      });
    }

    const defaultClearances = [
      { department: "IT", isCleared: false, remarks: "Pending hardware return and account deactivation" },
      { department: "FINANCE", isCleared: false, remarks: "Pending salary and reimbursement audit" },
      { department: "HR", isCleared: false, remarks: "Pending exit interview and document verification" },
      { department: "DEPARTMENT", isCleared: false, remarks: "Pending project handover" },
    ];

    const offboarding = await Offboarding.create({
      employeeId,
      exitType,
      resignationRef: resignationRef || null,
      lastWorkingDay: new Date(lastWorkingDay),
      status: "INITIATED",
      clearances: defaultClearances,
      createdBy: req.user.id,
    });

    user.lifecycleStatus = "OFFBOARDED";
    await user.save();

    await logAudit({
      req,
      action: "INITIATE_OFFBOARDING",
      module: "OFFBOARDING",
      resourceId: offboarding._id.toString(),
      newState: offboarding.toObject(),
      details: `Initiated offboarding for employee ${user.employeeCode} (${user.email})`,
    });

    return res.status(201).json({
      success: true,
      message: "Offboarding process initiated successfully.",
      data: offboarding,
    });
  } catch (error) {
    console.error("initiateOffboarding Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Update Clearance Status
export const updateDepartmentClearance = async (req, res) => {
  try {
    const { offboardingId } = req.params;
    const { department, isCleared, remarks } = req.body;

    const offboarding = await Offboarding.findById(offboardingId);
    if (!offboarding) {
      return res.status(404).json({ success: false, message: "Offboarding record not found." });
    }

    const clearance = offboarding.clearances.find((c) => c.department === department);
    if (!clearance) {
      return res.status(404).json({ success: false, message: `Clearance record for department '${department}' not found.` });
    }

    clearance.isCleared = isCleared !== undefined ? isCleared : clearance.isCleared;
    clearance.clearedBy = req.user.id;
    clearance.clearedAt = isCleared ? new Date() : null;
    if (remarks) clearance.remarks = remarks;

    const allCleared = offboarding.clearances.every((c) => c.isCleared);
    offboarding.status = allCleared ? "CLEARANCE_IN_PROGRESS" : "INITIATED";

    await offboarding.save();

    await logAudit({
      req,
      action: "UPDATE_OFFBOARDING_CLEARANCE",
      module: "OFFBOARDING",
      resourceId: offboarding._id.toString(),
      details: `Updated ${department} clearance status to ${isCleared}`,
    });

    return res.status(200).json({
      success: true,
      message: `${department} clearance updated successfully.`,
      data: offboarding,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Complete Offboarding & Transition User to EXITED
export const completeOffboarding = async (req, res) => {
  try {
    const { id } = req.params;
    const { finalSettlementAmount, settlementPaidDate, experienceLetterUrl, relievingLetterUrl } = req.body;

    const offboarding = await Offboarding.findById(id);
    if (!offboarding) {
      return res.status(404).json({ success: false, message: "Offboarding record not found." });
    }

    // Ensure all clearances are cleared
    offboarding.clearances.forEach((c) => {
      c.isCleared = true;
      c.clearedBy = c.clearedBy || req.user.id;
      c.clearedAt = c.clearedAt || new Date();
    });

    offboarding.status = "COMPLETED";
    offboarding.assetsReturned = true;
    offboarding.accessRevoked = true;
    if (finalSettlementAmount !== undefined) offboarding.finalSettlementAmount = finalSettlementAmount;
    if (settlementPaidDate) offboarding.settlementPaidDate = new Date(settlementPaidDate);
    if (experienceLetterUrl) offboarding.experienceLetterUrl = experienceLetterUrl;
    if (relievingLetterUrl) offboarding.relievingLetterUrl = relievingLetterUrl;

    await offboarding.save();

    // Transition employee status to EXITED and deactivate login access while preserving ALL historical data
    await User.findByIdAndUpdate(offboarding.employeeId, {
      lifecycleStatus: "EXITED",
      isActive: false,
    });

    // Also release assigned assets if any remain
    await Asset.updateMany(
      { currentAssignee: offboarding.employeeId },
      { status: "AVAILABLE", currentAssignee: null }
    );

    await logAudit({
      req,
      action: "COMPLETE_OFFBOARDING",
      module: "OFFBOARDING",
      resourceId: offboarding._id.toString(),
      details: `Completed offboarding for employee ${offboarding.employeeId}. Status set to EXITED.`,
    });

    return res.status(200).json({
      success: true,
      message: "Employee offboarding finalized. Status set to EXITED with historical data preserved.",
      data: offboarding,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 4. Get All Offboardings
export const getAllOffboardings = async (req, res) => {
  try {
    const { page, limit, skip, sort } = getPagination(req.query);
    const { status, exitType } = req.query;

    const query = {};
    if (status) query.status = status;
    if (exitType) query.exitType = exitType;

    const list = await Offboarding.find(query)
      .populate("employeeId", "firstName lastName email employeeCode department designation")
      .populate("resignationRef")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Offboarding.countDocuments(query);

    return res.status(200).json(formatPaginatedResponse({ data: list, total, page, limit }));
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
