import express from "express";
import {
  initiateOnboarding,
  getAllOnboardings,
  getOnboardingById,
  getOnboardingByEmployeeId,
  updateEmployeeInfo,
  updateEmployment,
  updatePayroll,
  getOnboardingDocuments,
  verifyOnboardingDocument,
  rejectOnboardingDocument,
  getOnboardingTasks,
  addOnboardingTask,
  updateOnboardingTask,
  deleteOnboardingTask,
  getOnboardingAssets,
  assignOnboardingAsset,
  unassignOnboardingAsset,
  getOnboardingAccess,
  addOnboardingAccess,
  updateOnboardingAccess,
  getOnboardingTraining,
  addOnboardingTraining,
  updateOnboardingTraining,
  getOnboardingAgreements,
  addOnboardingAgreement,
  acknowledgeOnboardingAgreement,
  getOnboardingValidation,
  validateOnboardingEndpoint,
  completeOnboarding,
  activateEmployee,
  provisionAccount,
  enableLogin,
  disableLogin,
} from "../Controller/OnboardingController.js";
import { Authentication, checkMenuAccess, requirePermission } from "../Middleware/Auth.js";

const router = express.Router();

// Require JWT Authentication for all Onboarding routes
router.use(Authentication);

// Module access protection
router.use(checkMenuAccess("USER_MANAGEMENT"));

// =========================================================================
// 1. LIFECYCLE & CORE ONBOARDING RECORD
// =========================================================================
router.post(
  "/initiate",
  requirePermission("onboarding.create"),
  initiateOnboarding
);

router.get(
  "/all",
  requirePermission("onboarding.read"),
  getAllOnboardings
);

router.get(
  "/employee/:employeeId",
  requirePermission("onboarding.read"),
  getOnboardingByEmployeeId
);

router.get(
  "/:id",
  requirePermission("onboarding.read"),
  getOnboardingById
);

// =========================================================================
// 2. EMPLOYEE PROFILE & EMPLOYMENT INFORMATION
// =========================================================================
router.put(
  "/:id/employee-info",
  requirePermission("onboarding.update"),
  updateEmployeeInfo
);

router.put(
  "/:id/employment",
  requirePermission("onboarding.update"),
  updateEmployment
);

router.put(
  "/:id/payroll",
  requirePermission("onboarding.update"),
  updatePayroll
);

// =========================================================================
// 3. DOCUMENT VERIFICATION & REJECTION
// =========================================================================
router.get(
  "/:id/documents",
  requirePermission("onboarding.read"),
  getOnboardingDocuments
);

router.put(
  "/:id/documents/:documentId/verify",
  requirePermission("onboarding.update"),
  verifyOnboardingDocument
);

router.put(
  "/:id/documents/:documentId/reject",
  requirePermission("onboarding.update"),
  rejectOnboardingDocument
);

// =========================================================================
// 4. ONBOARDING TASKS
// =========================================================================
router.get(
  "/:id/tasks",
  requirePermission("onboarding.read"),
  getOnboardingTasks
);

router.post(
  "/:id/tasks",
  requirePermission("onboarding.update"),
  addOnboardingTask
);

router.put(
  "/:id/tasks/:taskId",
  requirePermission("onboarding.update"),
  updateOnboardingTask
);

// Backwards compatibility legacy route
router.put(
  "/:onboardingId/task/:taskId",
  requirePermission("onboarding.update"),
  updateOnboardingTask
);

router.delete(
  "/:id/tasks/:taskId",
  requirePermission("onboarding.update"),
  deleteOnboardingTask
);

// =========================================================================
// 5. ASSET MANAGEMENT INTEGRATION
// =========================================================================
router.get(
  "/:id/assets",
  requirePermission("onboarding.read"),
  getOnboardingAssets
);

router.post(
  "/:id/assets",
  requirePermission("onboarding.update"),
  assignOnboardingAsset
);

router.delete(
  "/:id/assets/:assetId",
  requirePermission("onboarding.update"),
  unassignOnboardingAsset
);

// =========================================================================
// 6. SYSTEM ACCESS TRACKING
// =========================================================================
router.get(
  "/:id/access",
  requirePermission("onboarding.read"),
  getOnboardingAccess
);

router.post(
  "/:id/access",
  requirePermission("onboarding.update"),
  addOnboardingAccess
);

router.put(
  "/:id/access/:accessId",
  requirePermission("onboarding.update"),
  updateOnboardingAccess
);

// =========================================================================
// 7. ORIENTATION & TRAINING TRACKING
// =========================================================================
router.get(
  "/:id/training",
  requirePermission("onboarding.read"),
  getOnboardingTraining
);

router.post(
  "/:id/training",
  requirePermission("onboarding.update"),
  addOnboardingTraining
);

router.put(
  "/:id/training/:trainingId",
  requirePermission("onboarding.update"),
  updateOnboardingTraining
);

// =========================================================================
// 8. AGREEMENTS & POLICIES
// =========================================================================
router.get(
  "/:id/agreements",
  requirePermission("onboarding.read"),
  getOnboardingAgreements
);

router.post(
  "/:id/agreements",
  requirePermission("onboarding.update"),
  addOnboardingAgreement
);

router.put(
  "/:id/agreements/:agreementId/acknowledge",
  requirePermission("onboarding.update"),
  acknowledgeOnboardingAgreement
);

// =========================================================================
// 9. VALIDATION ENGINE
// =========================================================================
router.get(
  "/:id/validation",
  requirePermission("onboarding.read"),
  getOnboardingValidation
);

router.post(
  "/:id/validate",
  requirePermission("onboarding.update"),
  validateOnboardingEndpoint
);

// =========================================================================
// 10. ONBOARDING COMPLETION & EMPLOYEE ACTIVATION & PROVISIONING
// =========================================================================
router.post(
  "/:id/complete",
  requirePermission("onboarding.complete"),
  completeOnboarding
);

// Legacy PUT complete route support
router.put(
  "/:id/complete",
  requirePermission("onboarding.complete"),
  completeOnboarding
);

router.post(
  "/:id/activate",
  requirePermission("onboarding.complete"),
  activateEmployee
);

router.post(
  "/:id/provision-account",
  requirePermission("user.provision_account"),
  provisionAccount
);

router.post(
  "/:id/enable-login",
  requirePermission("user.manage_status"),
  enableLogin
);

router.post(
  "/:id/disable-login",
  requirePermission("user.manage_status"),
  disableLogin
);

export default router;
