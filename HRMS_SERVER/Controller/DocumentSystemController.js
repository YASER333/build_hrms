import DocumentSystem from "../Modules/DocumentSystemModule.js";
import DocumentRequirement from "../Modules/DocumentRequirementModule.js";
import User from "../Modules/UserModule.js";
import { validateFileRequirements, processCloudinaryUpload } from "../Services/UploadService.js";
import { logAudit } from "../Utils/AuditLogger.js";
import { getPagination, formatPaginatedResponse } from "../Utils/Pagination.js";

// Default seed helper for document requirements
export const seedDefaultDocumentRequirements = async (adminUserId) => {
  const defaults = [
    {
      module: "ONBOARDING",
      documentType: "OFFER_LETTER",
      title: "Signed Offer Letter",
      isRequired: true,
      requiresVerification: true,
      allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
    },
    {
      module: "ONBOARDING",
      documentType: "GOVERNMENT_ID",
      title: "Government ID Proof (Aadhaar/Passport)",
      isRequired: true,
      requiresVerification: true,
      allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
    },
    {
      module: "ONBOARDING",
      documentType: "PAN_CARD",
      title: "PAN Card",
      isRequired: true,
      requiresVerification: true,
      allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
    },
    {
      module: "ONBOARDING",
      documentType: "BANK_PROOF",
      title: "Cancelled Cheque / Bank Passbook",
      isRequired: true,
      requiresVerification: true,
      allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
    },
    {
      module: "REIMBURSEMENT",
      documentType: "RECEIPT",
      title: "Bill / Invoice / Receipt",
      isRequired: true,
      requiresVerification: true,
      allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
    },
    {
      module: "LEAVE",
      documentType: "MEDICAL_CERTIFICATE",
      title: "Medical Certificate",
      isRequired: false,
      requiresVerification: true,
      allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
    },
    {
      module: "RESIGNATION",
      documentType: "RESIGNATION_LETTER",
      title: "Resignation Letter",
      isRequired: true,
      requiresVerification: true,
      allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
    },
    {
      module: "OFFBOARDING",
      documentType: "CLEARANCE_FORM",
      title: "Clearance Form / Exit Proof",
      isRequired: true,
      requiresVerification: true,
      allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
    },
    {
      module: "PROFILE",
      documentType: "PROFILE_IMAGE",
      title: "Passport-size Profile Photo",
      isRequired: true,
      requiresVerification: false,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      maxFileSize: 5 * 1024 * 1024,
    },
  ];

  for (const item of defaults) {
    const exists = await DocumentRequirement.exists({ module: item.module, documentType: item.documentType });
    if (!exists) {
      await DocumentRequirement.create({
        ...item,
        createdBy: adminUserId,
      });
    }
  }
};

// 1. Configure / Update Document Requirement (Admin/Owner)
export const configureDocumentRequirement = async (req, res) => {
  try {
    const {
      module,
      documentType,
      title,
      description,
      applicableRoles,
      applicableEmploymentTypes,
      isRequired,
      requiresVerification,
      allowedMimeTypes,
      maxFileSize,
      maxFiles,
      expiryRequired,
      isActive,
    } = req.body;

    if (!module || !documentType || !title) {
      return res.status(400).json({
        success: false,
        message: "Module, documentType, and title are required.",
      });
    }

    let reqConfig = await DocumentRequirement.findOne({ module, documentType });
    const prev = reqConfig ? reqConfig.toObject() : null;

    if (reqConfig) {
      reqConfig.title = title;
      if (description !== undefined) reqConfig.description = description;
      if (applicableRoles) reqConfig.applicableRoles = applicableRoles;
      if (applicableEmploymentTypes) reqConfig.applicableEmploymentTypes = applicableEmploymentTypes;
      if (isRequired !== undefined) reqConfig.isRequired = isRequired;
      if (requiresVerification !== undefined) reqConfig.requiresVerification = requiresVerification;
      if (allowedMimeTypes) reqConfig.allowedMimeTypes = allowedMimeTypes;
      if (maxFileSize) reqConfig.maxFileSize = maxFileSize;
      if (maxFiles) reqConfig.maxFiles = maxFiles;
      if (expiryRequired !== undefined) reqConfig.expiryRequired = expiryRequired;
      if (isActive !== undefined) reqConfig.isActive = isActive;
      reqConfig.updatedBy = req.user.id;
      await reqConfig.save();
    } else {
      reqConfig = await DocumentRequirement.create({
        module,
        documentType,
        title,
        description: description || "",
        applicableRoles: applicableRoles || [],
        applicableEmploymentTypes: applicableEmploymentTypes || [],
        isRequired: !!isRequired,
        requiresVerification: requiresVerification !== undefined ? requiresVerification : true,
        allowedMimeTypes: allowedMimeTypes || ["application/pdf", "image/jpeg", "image/png"],
        maxFileSize: maxFileSize || 10 * 1024 * 1024,
        maxFiles: maxFiles || 1,
        expiryRequired: !!expiryRequired,
        isActive: isActive !== undefined ? isActive : true,
        createdBy: req.user.id,
      });
    }

    await logAudit({
      req,
      action: prev ? "UPDATE_DOCUMENT_REQUIREMENT" : "CREATE_DOCUMENT_REQUIREMENT",
      module: "DOCUMENT",
      resourceId: reqConfig._id.toString(),
      previousState: prev,
      newState: reqConfig.toObject(),
      details: `Configured requirement '${documentType}' for module '${module}'`,
    });

    return res.status(200).json({
      success: true,
      message: "Document requirement saved successfully.",
      data: reqConfig,
    });
  } catch (error) {
    console.error("configureDocumentRequirement Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Get Document Requirements per module
export const getDocumentRequirements = async (req, res) => {
  try {
    const { module } = req.query;
    const query = { isActive: true };
    if (module) query.module = module;

    const requirements = await DocumentRequirement.find(query).populate("applicableRoles", "roleName priority");
    return res.status(200).json({ success: true, data: requirements });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Centralized Document Upload Endpoint (Handles Cloudinary upload & requirement validation)
export const uploadDocument = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: "No document or image file provided." });
    }

    const {
      module,
      documentType,
      entityType,
      entityId,
      targetEmployeeId,
      category,
      expiryDate,
      metadata,
    } = req.body;

    if (!module || !documentType || !entityType) {
      return res.status(400).json({
        success: false,
        message: "module, documentType, and entityType are required.",
      });
    }

    const employeeId = targetEmployeeId || req.user.id;

    // Check requirement configuration if present
    const reqRule = await DocumentRequirement.findOne({ module, documentType, isActive: true });
    if (reqRule) {
      validateFileRequirements({
        file,
        allowedMimeTypes: reqRule.allowedMimeTypes,
        maxFileSize: reqRule.maxFileSize,
      });
    }

    // Process Cloudinary upload
    const cloudinaryData = await processCloudinaryUpload({
      file,
      folder: `hrms_${module.toLowerCase()}`,
      entityId: entityId || employeeId,
    });

    // Create Document record
    const documentRecord = await DocumentSystem.create({
      employeeId,
      module,
      entityType,
      entityId: entityId || null,
      documentType: documentType.toUpperCase(),
      category: category || "GENERAL",
      originalFileName: cloudinaryData.originalFileName,
      storageKey: cloudinaryData.publicId,
      fileUrl: cloudinaryData.fileUrl,
      mimeType: cloudinaryData.mimeType,
      fileSize: cloudinaryData.fileSize,
      uploadedBy: req.user.id,
      uploadedAt: new Date(),
      verificationStatus: reqRule && !reqRule.requiresVerification ? "VERIFIED" : "PENDING_VERIFICATION",
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      version: 1,
      isRequired: reqRule ? reqRule.isRequired : false,
      metadata: metadata ? JSON.parse(metadata) : {},
    });

    // If PROFILE_IMAGE, update User profile picture URL reference
    if (module === "PROFILE" || documentType === "PROFILE_IMAGE") {
      await User.findByIdAndUpdate(employeeId, { avatarUrl: cloudinaryData.fileUrl });
    }

    await logAudit({
      req,
      action: "UPLOAD_DOCUMENT",
      module: "DOCUMENT",
      resourceId: documentRecord._id.toString(),
      newState: documentRecord.toObject(),
      details: `Uploaded ${documentType} for module ${module} (${cloudinaryData.originalFileName})`,
    });

    return res.status(201).json({
      success: true,
      message: "Document uploaded successfully to secure storage.",
      data: documentRecord,
    });
  } catch (error) {
    console.error("uploadDocument Error:", error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

// 4. Update Document Version (Replace existing document)
export const replaceDocumentVersion = async (req, res) => {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: "No replacement file provided." });
    }

    const existingDoc = await DocumentSystem.findById(id);
    if (!existingDoc) {
      return res.status(404).json({ success: false, message: "Document record not found." });
    }

    // Process Cloudinary upload for replacement
    const cloudinaryData = await processCloudinaryUpload({
      file,
      folder: `hrms_${existingDoc.module.toLowerCase()}`,
      entityId: existingDoc.entityId || existingDoc.employeeId,
    });

    // Mark previous doc inactive
    existingDoc.isActive = false;
    await existingDoc.save();

    // Create new Version record
    const newDoc = await DocumentSystem.create({
      employeeId: existingDoc.employeeId,
      module: existingDoc.module,
      entityType: existingDoc.entityType,
      entityId: existingDoc.entityId,
      documentType: existingDoc.documentType,
      category: existingDoc.category,
      originalFileName: cloudinaryData.originalFileName,
      storageKey: cloudinaryData.publicId,
      fileUrl: cloudinaryData.fileUrl,
      mimeType: cloudinaryData.mimeType,
      fileSize: cloudinaryData.fileSize,
      uploadedBy: req.user.id,
      uploadedAt: new Date(),
      verificationStatus: "PENDING_VERIFICATION",
      expiryDate: existingDoc.expiryDate,
      version: existingDoc.version + 1,
      previousVersionId: existingDoc._id,
      isRequired: existingDoc.isRequired,
      metadata: existingDoc.metadata,
    });

    await logAudit({
      req,
      action: "REPLACE_DOCUMENT_VERSION",
      module: "DOCUMENT",
      resourceId: newDoc._id.toString(),
      previousState: existingDoc.toObject(),
      newState: newDoc.toObject(),
      details: `Replaced document ${id} with Version ${newDoc.version}`,
    });

    return res.status(200).json({
      success: true,
      message: `Document updated to Version ${newDoc.version} successfully.`,
      data: newDoc,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 5. Verify / Reject Document (HR / Admin / Owner)
export const updateVerificationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { verificationStatus, rejectionReason } = req.body; // VERIFIED | REJECTED

    if (!["VERIFIED", "REJECTED"].includes(verificationStatus)) {
      return res.status(400).json({
        success: false,
        message: "Status must be 'VERIFIED' or 'REJECTED'.",
      });
    }

    const doc = await DocumentSystem.findById(id);
    if (!doc) {
      return res.status(404).json({ success: false, message: "Document not found." });
    }

    doc.verificationStatus = verificationStatus;
    doc.verifiedBy = req.user.id;
    doc.verifiedAt = new Date();
    if (verificationStatus === "REJECTED") {
      doc.rejectionReason = rejectionReason || "Document rejected during HR audit";
    } else {
      doc.rejectionReason = null;
    }

    await doc.save();

    await logAudit({
      req,
      action: `VERIFY_DOCUMENT_${verificationStatus}`,
      module: "DOCUMENT",
      resourceId: doc._id.toString(),
      newState: doc.toObject(),
      details: `Updated verification status to ${verificationStatus} for document ${id}`,
    });

    return res.status(200).json({
      success: true,
      message: `Document verification status updated to ${verificationStatus}.`,
      data: doc,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 6. Get Employee Documents (Portfolio)
export const getEmployeeDocuments = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { module, verificationStatus } = req.query;

    // RBAC check: User can view own documents, HR/Admin can view any employee documents
    if (req.user.id.toString() !== employeeId.toString() && req.user.priority > 3) {
      return res.status(403).json({ success: false, message: "Unauthorized to view employee documents." });
    }

    const query = { employeeId, isActive: true };
    if (module) query.module = module;
    if (verificationStatus) query.verificationStatus = verificationStatus;

    const docs = await DocumentSystem.find(query)
      .populate("uploadedBy", "firstName lastName email")
      .populate("verifiedBy", "firstName lastName email")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ success: true, data: docs });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 7. Get Entity Attached Documents (e.g., for Reimbursement, Leave, Task, Project)
export const getEntityDocuments = async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const docs = await DocumentSystem.find({ entityType, entityId, isActive: true })
      .populate("uploadedBy", "firstName lastName email")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ success: true, data: docs });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
