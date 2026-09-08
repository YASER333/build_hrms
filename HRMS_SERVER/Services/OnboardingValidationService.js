import mongoose from "mongoose";
import Onboarding from "../Modules/OnboardingModule.js";
import User from "../Modules/UserModule.js";
import DocumentSystem from "../Modules/DocumentSystemModule.js";
import DocumentRequirement from "../Modules/DocumentRequirementModule.js";
import Document from "../Modules/DocumentModule.js";
import Asset from "../Modules/AssetModule.js";

/**
 * Validates the complete HR Onboarding state for a given onboarding record.
 * 
 * Performs backend-enforced validation across 9 key lifecycle areas:
 * 1. Personal & Contact Employee Information
 * 2. Employment Parameters & Reporting
 * 3. Required Document Uploads & Verifications
 * 4. Offer, Agreements, NDA & Policies Acknowledgement
 * 5. Payroll & Statutory Readiness
 * 6. Mandatory Onboarding Tasks Completion
 * 7. Asset Allocation Integrity
 * 8. IT System Access Provisioning Status
 * 9. Mandatory Orientation & Training Completion
 * 
 * @param {string|mongoose.Types.ObjectId} onboardingId
 * @returns {Promise<{
 *   valid: boolean,
 *   onboarding: object,
 *   employee: object,
 *   sections: {
 *     employeeInformation: boolean,
 *     employment: boolean,
 *     documents: boolean,
 *     agreements: boolean,
 *     payroll: boolean,
 *     tasks: boolean,
 *     assets: boolean,
 *     systemAccess: boolean,
 *     orientation: boolean,
 *   },
 *   missingRequirements: string[],
 * }>}
 */
export const validateOnboarding = async (onboardingId) => {
  if (!mongoose.Types.ObjectId.isValid(onboardingId)) {
    throw new Error("Invalid Onboarding ID format");
  }

  const onboarding = await Onboarding.findById(onboardingId)
    .populate("employeeId")
    .populate("assignedAssets");

  if (!onboarding) {
    throw new Error("Onboarding record not found");
  }

  const employee = onboarding.employeeId;
  if (!employee) {
    throw new Error("Associated employee profile not found");
  }

  const missingRequirements = [];
  const sections = {
    employeeInformation: true,
    employment: true,
    documents: true,
    agreements: true,
    payroll: true,
    tasks: true,
    assets: true,
    systemAccess: true,
    orientation: true,
  };

  // =========================================================================
  // 1. EMPLOYEE INFORMATION VALIDATION
  // =========================================================================
  if (!employee.firstName?.trim()) {
    missingRequirements.push("Employee first name is required");
    sections.employeeInformation = false;
  }
  if (!employee.lastName?.trim()) {
    missingRequirements.push("Employee last name is required");
    sections.employeeInformation = false;
  }
  if (!employee.email?.trim()) {
    missingRequirements.push("Employee email is required");
    sections.employeeInformation = false;
  }
  if (!employee.mobileNo?.trim()) {
    missingRequirements.push("Employee mobile number is required");
    sections.employeeInformation = false;
  }
  if (!employee.dob) {
    missingRequirements.push("Employee date of birth is required");
    sections.employeeInformation = false;
  }
  if (!employee.gender) {
    missingRequirements.push("Employee gender is required");
    sections.employeeInformation = false;
  }
  if (!employee.marriageStatus) {
    missingRequirements.push("Employee marital status is required");
    sections.employeeInformation = false;
  }

  // Emergency contact check
  if (
    !employee.emergencyContact ||
    !employee.emergencyContact.name ||
    !employee.emergencyContact.phone
  ) {
    missingRequirements.push("Emergency contact name and phone number are required");
    sections.employeeInformation = false;
  }

  // =========================================================================
  // 2. EMPLOYMENT INFORMATION VALIDATION
  // =========================================================================
  if (!employee.employeeCode?.trim()) {
    missingRequirements.push("Employee code is required");
    sections.employment = false;
  }
  if (!employee.role) {
    missingRequirements.push("Employee role must be assigned");
    sections.employment = false;
  }
  if (!employee.department?.trim()) {
    missingRequirements.push("Department is required");
    sections.employment = false;
  }
  if (!employee.designation?.trim()) {
    missingRequirements.push("Designation is required");
    sections.employment = false;
  }
  if (!employee.joiningDate) {
    missingRequirements.push("Joining date is required");
    sections.employment = false;
  }
  if (!employee.employmentType) {
    missingRequirements.push("Employment type is required");
    sections.employment = false;
  }

  // =========================================================================
  // 3. DOCUMENT VERIFICATION VALIDATION
  // =========================================================================
  // Inspect required document definitions for ONBOARDING module
  const requiredDocConfigs = await DocumentRequirement.find({
    module: "ONBOARDING",
    isActive: true,
    isRequired: true,
  }).lean();

  const employeeUploadedDocs = await DocumentSystem.find({
    employeeId: employee._id,
    module: "ONBOARDING",
    isActive: true,
  }).lean();

  // Also check legacy Document collection for identity & verification
  const legacyDocRecord = await Document.findOne({ userId: employee._id }).lean();

  if (requiredDocConfigs.length > 0) {
    for (const reqDoc of requiredDocConfigs) {
      const foundUpload = employeeUploadedDocs.find(
        (d) => d.documentType?.toUpperCase() === reqDoc.documentType?.toUpperCase()
      );

      if (!foundUpload) {
        missingRequirements.push(`Mandatory document '${reqDoc.title || reqDoc.documentType}' is not uploaded`);
        sections.documents = false;
      } else {
        if (foundUpload.verificationStatus === "REJECTED") {
          missingRequirements.push(
            `Document '${reqDoc.title || reqDoc.documentType}' was REJECTED: ${foundUpload.rejectionReason || "No reason given"}`
          );
          sections.documents = false;
        } else if (foundUpload.verificationStatus !== "VERIFIED") {
          missingRequirements.push(`Document '${reqDoc.title || reqDoc.documentType}' is pending HR verification`);
          sections.documents = false;
        }

        if (foundUpload.expiryDate && new Date(foundUpload.expiryDate) < new Date()) {
          missingRequirements.push(`Document '${reqDoc.title || reqDoc.documentType}' has expired`);
          sections.documents = false;
        }
      }
    }
  } else {
    // If no dynamic DocumentRequirement records configured, ensure uploaded documents in DocumentSystem are verified
    if (employeeUploadedDocs.length > 0) {
      for (const d of employeeUploadedDocs) {
        if (d.isRequired) {
          if (d.verificationStatus !== "VERIFIED") {
            missingRequirements.push(`Uploaded document '${d.documentType}' is pending verification`);
            sections.documents = false;
          }
          if (d.expiryDate && new Date(d.expiryDate) < new Date()) {
            missingRequirements.push(`Uploaded document '${d.documentType}' has expired`);
            sections.documents = false;
          }
        }
      }
    }

    // Check legacy document attachments if present
    if (legacyDocRecord?.attachments?.length > 0) {
      for (const att of legacyDocRecord.attachments) {
        if (att.verificationStatus === "REJECTED") {
          missingRequirements.push(`Attachment '${att.title}' was rejected: ${att.rejectionReason || "No reason"}`);
          sections.documents = false;
        } else if (att.verificationStatus === "PENDING") {
          missingRequirements.push(`Attachment '${att.title}' is pending verification`);
          sections.documents = false;
        }
      }
    }
  }

  // =========================================================================
  // 4. AGREEMENTS & POLICIES VALIDATION
  // =========================================================================
  if (onboarding.agreements && onboarding.agreements.length > 0) {
    for (const agreement of onboarding.agreements) {
      if (agreement.isRequired) {
        if (!agreement.isAcknowledged || agreement.status !== "ACCEPTED") {
          missingRequirements.push(
            `Agreement/Policy '${agreement.title}' has not been acknowledged and accepted by employee`
          );
          sections.agreements = false;
        }
      }
    }
  }

  // =========================================================================
  // 5. PAYROLL & STATUTORY VALIDATION
  // =========================================================================
  const bank = employee.bankDetails || {};
  const statutory = employee.statutoryDetails || {};

  const hasBankAccount = Boolean(bank.accountNumber?.trim());
  const hasIfsc = Boolean(bank.ifscCode?.trim());
  const hasBankName = Boolean(bank.bankName?.trim());

  if (!hasBankAccount || !hasIfsc || !hasBankName) {
    missingRequirements.push("Bank details (Account Number, IFSC Code, Bank Name) are required for payroll onboarding");
    sections.payroll = false;
  }

  const hasPan = Boolean(statutory.panNo?.trim() || legacyDocRecord?.panNo);
  const hasAadhaar = Boolean(statutory.aadhaarNo?.trim() || legacyDocRecord?.aadhaarNo);

  if (!hasPan) {
    missingRequirements.push("PAN number is required for statutory onboarding readiness");
    sections.payroll = false;
  }

  if (!hasAadhaar) {
    missingRequirements.push("Aadhaar number is required for statutory onboarding readiness");
    sections.payroll = false;
  }

  // =========================================================================
  // 6. ONBOARDING TASKS VALIDATION
  // =========================================================================
  if (onboarding.tasks && onboarding.tasks.length > 0) {
    const uncompletedMandatoryTasks = onboarding.tasks.filter((t) => {
      const isMandatory = t.isMandatory !== false;
      const isDone = t.status === "COMPLETED" || t.isCompleted === true;
      return isMandatory && !isDone;
    });

    if (uncompletedMandatoryTasks.length > 0) {
      uncompletedMandatoryTasks.forEach((t) => {
        missingRequirements.push(
          `Onboarding task '${t.taskName}' [Group: ${t.responsibleGroup || "HR"}] is not completed (current status: ${t.status || "PENDING"})`
        );
      });
      sections.tasks = false;
    }
  }

  // =========================================================================
  // 7. ASSET MANAGEMENT VALIDATION
  // =========================================================================
  // Verify any assigned assets are valid and actively assigned
  if (onboarding.assignedAssets && onboarding.assignedAssets.length > 0) {
    for (const assetDoc of onboarding.assignedAssets) {
      if (assetDoc.status && assetDoc.status !== "ASSIGNED") {
        missingRequirements.push(`Asset '${assetDoc.name || assetDoc.assetCode}' is not marked as ASSIGNED in inventory`);
        sections.assets = false;
      }
    }
  }

  // =========================================================================
  // 8. SYSTEM ACCESS PROVISIONING VALIDATION
  // =========================================================================
  if (onboarding.provisionedAccess && onboarding.provisionedAccess.length > 0) {
    for (const sys of onboarding.provisionedAccess) {
      const isMandatory = sys.isMandatory !== false;
      const isReady = sys.status === "ACTIVE" || sys.isProvisioned === true;
      if (isMandatory && !isReady) {
        missingRequirements.push(
          `System access for '${sys.systemName}' is not active (current status: ${sys.status || "REQUESTED"})`
        );
        sections.systemAccess = false;
      }
    }
  }

  // =========================================================================
  // 9. ORIENTATION & TRAINING VALIDATION
  // =========================================================================
  if (onboarding.orientations && onboarding.orientations.length > 0) {
    for (const trn of onboarding.orientations) {
      if (trn.mandatory) {
        if (trn.status !== "COMPLETED") {
          missingRequirements.push(
            `Mandatory orientation/training '${trn.trainingName}' is not completed (current status: ${trn.status || "NOT_STARTED"})`
          );
          sections.orientation = false;
        }
      }
    }
  }

  const isValid = missingRequirements.length === 0;

  return {
    valid: isValid,
    onboarding,
    employee,
    sections,
    missingRequirements,
  };
};
