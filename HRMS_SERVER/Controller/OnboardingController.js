import mongoose from "mongoose";
import Onboarding from "../Modules/OnboardingModule.js";
import User from "../Modules/UserModule.js";
import DocumentSystem from "../Modules/DocumentSystemModule.js";
import DocumentRequirement from "../Modules/DocumentRequirementModule.js";
import { getPagination, formatPaginatedResponse } from "../Utils/Pagination.js";
import { logAudit } from "../Utils/AuditLogger.js";
import {
  initiateOnboardingService,
  getOnboardingDetailsService,
  updateEmployeeInfoService,
  updateEmploymentService,
  updatePayrollDetailsService,
  addTaskService,
  updateTaskService,
  deleteTaskService,
  assignAssetService,
  unassignAssetService,
  addSystemAccessService,
  updateSystemAccessService,
  addOrientationService,
  updateOrientationService,
  addAgreementService,
  acknowledgeAgreementService,
  runValidationService,
  completeOnboardingService,
  activateEmployeeService,
  provisionAccountService,
  toggleLoginAccessService,
  maskSensitiveString,
} from "../Services/OnboardingService.js";
import { validateOnboarding } from "../Services/OnboardingValidationService.js";

// Helper for error formatting
const handleError = (res, error, defaultMessage = "Operation failed") => {
  console.error("OnboardingController Error:", error);
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0] || "field";
    const value = error.keyValue ? error.keyValue[field] : "";
    return res.status(409).json({
      success: false,
      message: `A record with this ${field} ('${value}') already exists.`,
    });
  }
  const status = error.statusCode || 500;
  return res.status(status).json({
    success: false,
    message: error.message || defaultMessage,
    missingRequirements: error.missingRequirements || undefined,
    sections: error.sections || undefined,
  });
};

// =========================================================================
// 1. INITIATE ONBOARDING
// =========================================================================
export const initiateOnboarding = async (req, res) => {
  try {
    const result = await initiateOnboardingService({ req, body: req.body });
    return res.status(201).json({
      success: true,
      message: "Employee onboarding initiated successfully.",
      data: {
        user: {
          _id: result.user._id,
          employeeCode: result.user.employeeCode,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          email: result.user.email,
          lifecycleStatus: result.user.lifecycleStatus,
          hasLoginAccess: result.user.hasLoginAccess,
        },
        onboarding: result.onboarding,
      },
    });
  } catch (error) {
    return handleError(res, error, "Failed to initiate onboarding");
  }
};

// =========================================================================
// 2. GET ALL ONBOARDINGS (PAGINATED & FILTERED)
// =========================================================================
export const getAllOnboardings = async (req, res) => {
  try {
    const { page, limit, skip, sort } = getPagination(req.query);
    const { status, search, department } = req.query;

    const query = {};
    if (status) query.status = status;

    let userMatch = {};
    if (department) userMatch.department = department;
    if (search) {
      userMatch.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { employeeCode: { $regex: search, $options: "i" } },
      ];
    }

    let matchedUserIds = null;
    if (Object.keys(userMatch).length > 0) {
      const users = await User.find(userMatch).select("_id").lean();
      matchedUserIds = users.map((u) => u._id);
      query.employeeId = { $in: matchedUserIds };
    }

    const list = await Onboarding.find(query)
      .populate({
        path: "employeeId",
        select:
          "firstName middleName lastName email employeeCode department designation joiningDate mobileNo lifecycleStatus hasLoginAccess",
        populate: { path: "role", select: "roleName roleCode priority" },
      })
      .populate("assignedAssets", "assetCode name category status")
      .populate("createdBy", "firstName lastName email employeeCode")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Onboarding.countDocuments(query);

    return res.status(200).json(
      formatPaginatedResponse({
        data: list,
        total,
        page,
        limit,
      })
    );
  } catch (error) {
    return handleError(res, error, "Failed to fetch onboarding records");
  }
};

// =========================================================================
// 3. GET ONBOARDING BY ID
// =========================================================================
export const getOnboardingById = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await getOnboardingDetailsService(id);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Failed to fetch onboarding details");
  }
};

// =========================================================================
// 4. GET ONBOARDING BY EMPLOYEE ID
// =========================================================================
export const getOnboardingByEmployeeId = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const data = await getOnboardingDetailsService(employeeId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Failed to fetch onboarding details by employee ID");
  }
};

// =========================================================================
// 5. UPDATE EMPLOYEE INFO
// =========================================================================
export const updateEmployeeInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await updateEmployeeInfoService({ req, onboardingId: id, body: req.body });
    return res.status(200).json({
      success: true,
      message: "Employee onboarding information updated successfully.",
      data: result,
    });
  } catch (error) {
    return handleError(res, error, "Failed to update employee information");
  }
};

// =========================================================================
// 6. UPDATE EMPLOYMENT DETAILS
// =========================================================================
export const updateEmployment = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await updateEmploymentService({ req, onboardingId: id, body: req.body });
    return res.status(200).json({
      success: true,
      message: "Employment parameters updated successfully.",
      data: result,
    });
  } catch (error) {
    return handleError(res, error, "Failed to update employment details");
  }
};

// =========================================================================
// 7. UPDATE PAYROLL & STATUTORY
// =========================================================================
export const updatePayroll = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await updatePayrollDetailsService({ req, onboardingId: id, body: req.body });
    return res.status(200).json({
      success: true,
      message: "Payroll and statutory onboarding details updated successfully.",
      data: {
        payrollReadiness: result.onboarding.payrollReadiness,
        bankDetails: {
          accountNumber: maskSensitiveString(result.user.bankDetails?.accountNumber),
          bankName: result.user.bankDetails?.bankName,
          ifscCode: result.user.bankDetails?.ifscCode,
          branchName: result.user.bankDetails?.branchName,
        },
        statutoryDetails: {
          panNo: maskSensitiveString(result.user.statutoryDetails?.panNo),
          aadhaarNo: maskSensitiveString(result.user.statutoryDetails?.aadhaarNo),
          pfUan: result.user.statutoryDetails?.pfUan,
          esiNo: result.user.statutoryDetails?.esiNo,
        },
      },
    });
  } catch (error) {
    return handleError(res, error, "Failed to update payroll details");
  }
};

// =========================================================================
// 8. ONBOARDING DOCUMENTS MANAGEMENT
// =========================================================================
export const getOnboardingDocuments = async (req, res) => {
  try {
    const { id } = req.params;
    const onboarding = await Onboarding.findById(id);
    if (!onboarding) {
      return res.status(404).json({ success: false, message: "Onboarding record not found." });
    }

    const requirements = await DocumentRequirement.find({ module: "ONBOARDING", isActive: true }).lean();
    const uploadedDocs = await DocumentSystem.find({
      employeeId: onboarding.employeeId,
      module: "ONBOARDING",
      isActive: true,
    })
      .populate("uploadedBy", "firstName lastName email")
      .populate("verifiedBy", "firstName lastName email")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        requirements,
        uploadedDocuments: uploadedDocs,
      },
    });
  } catch (error) {
    return handleError(res, error, "Failed to fetch onboarding documents");
  }
};

export const verifyOnboardingDocument = async (req, res) => {
  try {
    const { id, documentId } = req.params;
    const doc = await DocumentSystem.findById(documentId);
    if (!doc) {
      return res.status(404).json({ success: false, message: "Document not found." });
    }

    doc.verificationStatus = "VERIFIED";
    doc.verifiedBy = req.user.id;
    doc.verifiedAt = new Date();
    doc.rejectionReason = null;
    await doc.save();

    await logAudit({
      req,
      action: "DOCUMENT_VERIFIED",
      module: "ONBOARDING",
      resourceId: doc._id.toString(),
      newState: doc.toObject(),
      details: `Verified onboarding document '${doc.documentType}' for employee ${doc.employeeId}`,
    });

    return res.status(200).json({
      success: true,
      message: `Document '${doc.documentType}' verified successfully.`,
      data: doc,
    });
  } catch (error) {
    return handleError(res, error, "Failed to verify document");
  }
};

export const rejectOnboardingDocument = async (req, res) => {
  try {
    const { id, documentId } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason?.trim()) {
      return res.status(400).json({
        success: false,
        message: "A rejection reason is mandatory when rejecting an onboarding document.",
      });
    }

    const doc = await DocumentSystem.findById(documentId);
    if (!doc) {
      return res.status(404).json({ success: false, message: "Document not found." });
    }

    doc.verificationStatus = "REJECTED";
    doc.verifiedBy = req.user.id;
    doc.verifiedAt = new Date();
    doc.rejectionReason = rejectionReason.trim();
    await doc.save();

    await logAudit({
      req,
      action: "DOCUMENT_REJECTED",
      module: "ONBOARDING",
      resourceId: doc._id.toString(),
      newState: doc.toObject(),
      details: `Rejected document '${doc.documentType}' for employee ${doc.employeeId}: ${rejectionReason}`,
    });

    return res.status(200).json({
      success: true,
      message: `Document '${doc.documentType}' marked as REJECTED.`,
      data: doc,
    });
  } catch (error) {
    return handleError(res, error, "Failed to reject document");
  }
};

// =========================================================================
// 9. ONBOARDING TASKS MANAGEMENT
// =========================================================================
export const getOnboardingTasks = async (req, res) => {
  try {
    const { id } = req.params;
    const onboarding = await Onboarding.findById(id).populate("tasks.assignedTo", "firstName lastName email");
    if (!onboarding) {
      return res.status(404).json({ success: false, message: "Onboarding record not found." });
    }
    return res.status(200).json({ success: true, data: onboarding.tasks });
  } catch (error) {
    return handleError(res, error, "Failed to fetch onboarding tasks");
  }
};

export const addOnboardingTask = async (req, res) => {
  try {
    const { id } = req.params;
    const onboarding = await addTaskService({ req, onboardingId: id, body: req.body });
    return res.status(201).json({
      success: true,
      message: "Onboarding task added successfully.",
      data: onboarding.tasks,
    });
  } catch (error) {
    return handleError(res, error, "Failed to add onboarding task");
  }
};

export const updateOnboardingTask = async (req, res) => {
  try {
    const onboardingId = req.params.id || req.params.onboardingId;
    const taskId = req.params.taskId;

    const onboarding = await updateTaskService({
      req,
      onboardingId,
      taskId,
      body: req.body,
    });

    return res.status(200).json({
      success: true,
      message: "Onboarding task updated successfully.",
      data: onboarding,
    });
  } catch (error) {
    return handleError(res, error, "Failed to update onboarding task");
  }
};

export const deleteOnboardingTask = async (req, res) => {
  try {
    const onboardingId = req.params.id || req.params.onboardingId;
    const taskId = req.params.taskId;
    const onboarding = await deleteTaskService({ req, onboardingId, taskId });
    return res.status(200).json({
      success: true,
      message: "Onboarding task deleted successfully.",
      data: onboarding.tasks,
    });
  } catch (error) {
    return handleError(res, error, "Failed to delete onboarding task");
  }
};

// =========================================================================
// 10. ASSET ALLOCATION
// =========================================================================
export const getOnboardingAssets = async (req, res) => {
  try {
    const { id } = req.params;
    const onboarding = await Onboarding.findById(id).populate("assignedAssets");
    if (!onboarding) {
      return res.status(404).json({ success: false, message: "Onboarding record not found." });
    }
    return res.status(200).json({ success: true, data: onboarding.assignedAssets });
  } catch (error) {
    return handleError(res, error, "Failed to fetch onboarding assets");
  }
};

export const assignOnboardingAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const onboarding = await assignAssetService({ req, onboardingId: id, body: req.body });
    return res.status(200).json({
      success: true,
      message: "Asset assigned to employee onboarding successfully.",
      data: onboarding.assignedAssets,
    });
  } catch (error) {
    return handleError(res, error, "Failed to assign asset");
  }
};

export const unassignOnboardingAsset = async (req, res) => {
  try {
    const { id, assetId } = req.params;
    const onboarding = await unassignAssetService({ req, onboardingId: id, assetId, body: req.body });
    return res.status(200).json({
      success: true,
      message: "Asset unassigned successfully.",
      data: onboarding.assignedAssets,
    });
  } catch (error) {
    return handleError(res, error, "Failed to unassign asset");
  }
};

// =========================================================================
// 11. SYSTEM ACCESS
// =========================================================================
export const getOnboardingAccess = async (req, res) => {
  try {
    const { id } = req.params;
    const onboarding = await Onboarding.findById(id).populate("provisionedAccess.provisionedBy", "firstName lastName email");
    if (!onboarding) {
      return res.status(404).json({ success: false, message: "Onboarding record not found." });
    }
    return res.status(200).json({ success: true, data: onboarding.provisionedAccess });
  } catch (error) {
    return handleError(res, error, "Failed to fetch system access records");
  }
};

export const addOnboardingAccess = async (req, res) => {
  try {
    const { id } = req.params;
    const onboarding = await addSystemAccessService({ req, onboardingId: id, body: req.body });
    return res.status(201).json({
      success: true,
      message: "System access record added successfully.",
      data: onboarding.provisionedAccess,
    });
  } catch (error) {
    return handleError(res, error, "Failed to add system access");
  }
};

export const updateOnboardingAccess = async (req, res) => {
  try {
    const { id, accessId } = req.params;
    const onboarding = await updateSystemAccessService({ req, onboardingId: id, accessId, body: req.body });
    return res.status(200).json({
      success: true,
      message: "System access record updated successfully.",
      data: onboarding.provisionedAccess,
    });
  } catch (error) {
    return handleError(res, error, "Failed to update system access");
  }
};

// =========================================================================
// 12. ORIENTATION & TRAINING
// =========================================================================
export const getOnboardingTraining = async (req, res) => {
  try {
    const { id } = req.params;
    const onboarding = await Onboarding.findById(id);
    if (!onboarding) {
      return res.status(404).json({ success: false, message: "Onboarding record not found." });
    }
    return res.status(200).json({ success: true, data: onboarding.orientations });
  } catch (error) {
    return handleError(res, error, "Failed to fetch training records");
  }
};

export const addOnboardingTraining = async (req, res) => {
  try {
    const { id } = req.params;
    const onboarding = await addOrientationService({ req, onboardingId: id, body: req.body });
    return res.status(201).json({
      success: true,
      message: "Orientation / training added successfully.",
      data: onboarding.orientations,
    });
  } catch (error) {
    return handleError(res, error, "Failed to add training");
  }
};

export const updateOnboardingTraining = async (req, res) => {
  try {
    const { id, trainingId } = req.params;
    const onboarding = await updateOrientationService({ req, onboardingId: id, trainingId, body: req.body });
    return res.status(200).json({
      success: true,
      message: "Orientation / training updated successfully.",
      data: onboarding.orientations,
    });
  } catch (error) {
    return handleError(res, error, "Failed to update training");
  }
};

// =========================================================================
// 13. AGREEMENTS & POLICIES
// =========================================================================
export const getOnboardingAgreements = async (req, res) => {
  try {
    const { id } = req.params;
    const onboarding = await Onboarding.findById(id);
    if (!onboarding) {
      return res.status(404).json({ success: false, message: "Onboarding record not found." });
    }
    return res.status(200).json({ success: true, data: onboarding.agreements });
  } catch (error) {
    return handleError(res, error, "Failed to fetch agreements");
  }
};

export const addOnboardingAgreement = async (req, res) => {
  try {
    const { id } = req.params;
    const onboarding = await addAgreementService({ req, onboardingId: id, body: req.body });
    return res.status(201).json({
      success: true,
      message: "Agreement/policy added successfully.",
      data: onboarding.agreements,
    });
  } catch (error) {
    return handleError(res, error, "Failed to add agreement");
  }
};

export const acknowledgeOnboardingAgreement = async (req, res) => {
  try {
    const { id, agreementId } = req.params;
    const onboarding = await acknowledgeAgreementService({
      req,
      onboardingId: id,
      agreementId,
      body: req.body,
    });
    return res.status(200).json({
      success: true,
      message: "Agreement acknowledgement recorded successfully.",
      data: onboarding.agreements,
    });
  } catch (error) {
    return handleError(res, error, "Failed to acknowledge agreement");
  }
};

// =========================================================================
// 14. VALIDATION ENGINE ENDPOINTS
// =========================================================================
export const getOnboardingValidation = async (req, res) => {
  try {
    const { id } = req.params;
    const report = await validateOnboarding(id);
    return res.status(200).json({
      success: true,
      valid: report.valid,
      sections: report.sections,
      missingRequirements: report.missingRequirements,
    });
  } catch (error) {
    return handleError(res, error, "Failed to fetch validation status");
  }
};

export const validateOnboardingEndpoint = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await runValidationService({ req, onboardingId: id });
    const statusCode = result.valid ? 200 : 422;
    return res.status(statusCode).json({
      success: result.valid,
      message: result.valid
        ? "Onboarding validation passed successfully."
        : "Onboarding validation failed with outstanding requirements.",
      data: result,
    });
  } catch (error) {
    return handleError(res, error, "Failed to run validation engine");
  }
};

// =========================================================================
// 15. ONBOARDING COMPLETION
// =========================================================================
export const completeOnboarding = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await completeOnboardingService({ req, onboardingId: id });
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result.onboarding,
    });
  } catch (error) {
    return handleError(res, error, "Failed to complete onboarding");
  }
};

// =========================================================================
// 16. EMPLOYEE ACTIVATION
// =========================================================================
export const activateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await activateEmployeeService({ req, onboardingId: id });
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    return handleError(res, error, "Failed to activate employee");
  }
};

// =========================================================================
// 17. LOGIN PROVISIONING & ENABLE/DISABLE
// =========================================================================
export const provisionAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await provisionAccountService({ req, onboardingId: id, body: req.body });
    return res.status(201).json({
      success: true,
      message: result.message,
      data: result.employee,
    });
  } catch (error) {
    return handleError(res, error, "Failed to provision login account");
  }
};

export const enableLogin = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await toggleLoginAccessService({ req, onboardingId: id, body: { enable: true } });
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result.employee,
    });
  } catch (error) {
    return handleError(res, error, "Failed to enable login");
  }
};

export const disableLogin = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await toggleLoginAccessService({ req, onboardingId: id, body: { enable: false } });
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result.employee,
    });
  } catch (error) {
    return handleError(res, error, "Failed to disable login");
  }
};
