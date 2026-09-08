import mongoose from "mongoose";
import CurrentCompany from "../Modules/CurrentCompanyModule.js";
import { processCloudinaryUpload } from "../Services/UploadService.js";

// Helper to extract uploaded file by field name
const getFileByField = (files, ...fieldNames) => {
  if (!files) return null;
  if (Array.isArray(files)) {
    return files.find(f => fieldNames.includes(f.fieldname));
  }
  for (const name of fieldNames) {
    if (files[name] && files[name].length > 0) {
      return files[name][0];
    }
  }
  return null;
};

export const createCurrentCompany = async (req, res) => {
  try {
    const {
      userId,
      companyName,
      companyWebsite,
      department,
      designation,
      role,
      salary,
      joiningDate,
      reportedTo,
      noticePeriod,
      expectedLastWorkingDate,
      employmentStatus,
      isFresher
    } = req.body;

    if (!userId) {
      return res.status(400).json({
        message: "User ID is required"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        message: "Invalid User ID"
      });
    }

    const existing = await CurrentCompany.findOne({ userId });
    if (existing) {
      return res.status(400).json({
        message: "Current company already exists for this user"
      });
    }

    const isFresherFlag = isFresher === true || isFresher === 'true';

    // If Fresher is true: only require joiningDate and reportedTo
    if (isFresherFlag) {
      if (!joiningDate) {
        return res.status(400).json({
          message: "Joining date is required for fresher"
        });
      }
      if (!reportedTo) {
        return res.status(400).json({
          message: "Reported To is required for fresher"
        });
      }
      if (!mongoose.Types.ObjectId.isValid(reportedTo)) {
        return res.status(400).json({
          message: "Invalid Reported To user ID"
        });
      }

      const currentCompany = await CurrentCompany.create({
        userId,
        joiningDate: new Date(joiningDate),
        reportedTo,
        isFresher: true,
        companyName: "",
        companyWebsite: "",
        department: "",
        designation: "",
        role: "",
        salary: "0",
        noticePeriod: "",
        expectedLastWorkingDate: null,
        employmentStatus: "NOT_APPLICABLE",
        experienceLetter: "",
        experienceLetterUrl: "",
        payslip: "",
        payslipUrl: "",
        relievingLetter: "",
        relievingLetterUrl: "",
        documentUrl: "",
        documentType: "",
        documents: []
      });

      return res.status(201).json({
        message: "Current company created successfully for fresher",
        data: currentCompany
      });
    }

    // If isFresher is false: validate all required fields
    const website = companyWebsite || req.body.website || "";
    const missingFields = [];
    if (!companyName || !companyName.trim()) missingFields.push("companyName");
    if (!website || !website.trim()) missingFields.push("companyWebsite");
    if (!department || !department.trim()) missingFields.push("department");
    if (!designation || !designation.trim()) missingFields.push("designation");
    if (!role || !role.trim()) missingFields.push("role");
    if (salary === undefined || salary === null || (typeof salary === 'string' && !salary.trim())) missingFields.push("salary");
    if (!joiningDate) missingFields.push("joiningDate");
    if (!reportedTo) missingFields.push("reportedTo");
    if (!noticePeriod || !noticePeriod.trim()) missingFields.push("noticePeriod");
    if (!expectedLastWorkingDate) missingFields.push("expectedLastWorkingDate");
    if (!employmentStatus || !employmentStatus.trim()) missingFields.push("employmentStatus");

    if (missingFields.length > 0) {
      return res.status(400).json({
        message: `Missing required fields: ${missingFields.join(", ")}`,
        missingFields
      });
    }

    if (!mongoose.Types.ObjectId.isValid(reportedTo)) {
      return res.status(400).json({
        message: "Invalid Reported To user ID"
      });
    }

    let experienceLetterUrl = req.body.experienceLetterUrl || req.body.experienceLetter || "";
    let payslipUrl = req.body.payslipUrl || req.body.payslip || "";
    let relievingLetterUrl = req.body.relievingLetterUrl || req.body.relievingLetter || "";
    let documentUrl = req.body.documentUrl || "";
    let documentType = req.body.documentType || "";
    let documents = [];

    if (req.body.documents) {
      try {
        documents = typeof req.body.documents === 'string' ? JSON.parse(req.body.documents) : req.body.documents;
      } catch (e) {
        documents = [];
      }
    }

    // Check for direct file uploads if multipart
    const files = req.files || (req.file ? [req.file] : null);
    if (files) {
      const expFile = getFileByField(files, "experienceLetter", "experienceLetterFile", "experience_letter");
      if (expFile) {
        const uploaded = await processCloudinaryUpload({
          file: expFile,
          folder: "hrms_current_company",
          entityId: userId
        });
        experienceLetterUrl = uploaded.fileUrl;
        documents.push({
          documentType: "EXPERIENCE_LETTER",
          fileUrl: uploaded.fileUrl,
          fileName: expFile.originalname,
          uploadedAt: new Date()
        });
      }

      const payFile = getFileByField(files, "payslip", "payslipFile", "pay_slip", "salarySlip");
      if (payFile) {
        const uploaded = await processCloudinaryUpload({
          file: payFile,
          folder: "hrms_current_company",
          entityId: userId
        });
        payslipUrl = uploaded.fileUrl;
        documents.push({
          documentType: "PAYSLIP",
          fileUrl: uploaded.fileUrl,
          fileName: payFile.originalname,
          uploadedAt: new Date()
        });
      }

      const relFile = getFileByField(files, "relievingLetter", "relievingLetterFile", "relieving_letter");
      if (relFile) {
        const uploaded = await processCloudinaryUpload({
          file: relFile,
          folder: "hrms_current_company",
          entityId: userId
        });
        relievingLetterUrl = uploaded.fileUrl;
        documents.push({
          documentType: "RELIEVING_LETTER",
          fileUrl: uploaded.fileUrl,
          fileName: relFile.originalname,
          uploadedAt: new Date()
        });
      }

      const genFile = getFileByField(files, "document", "file", "documentFile");
      if (genFile) {
        const uploaded = await processCloudinaryUpload({
          file: genFile,
          folder: "hrms_current_company",
          entityId: userId
        });
        documentUrl = uploaded.fileUrl;
        if (!documentType) documentType = "OTHER";
        documents.push({
          documentType: documentType || "OTHER",
          fileUrl: uploaded.fileUrl,
          fileName: genFile.originalname,
          uploadedAt: new Date()
        });
      }
    }

    const currentCompany = await CurrentCompany.create({
      userId,
      companyName: companyName.trim(),
      companyWebsite: website.trim(),
      department: department.trim(),
      designation: designation.trim(),
      role: role.trim(),
      salary: String(salary).trim(),
      joiningDate: new Date(joiningDate),
      reportedTo,
      noticePeriod: noticePeriod.trim(),
      expectedLastWorkingDate: new Date(expectedLastWorkingDate),
      employmentStatus,
      isFresher: false,
      experienceLetter: experienceLetterUrl,
      experienceLetterUrl,
      payslip: payslipUrl,
      payslipUrl,
      relievingLetter: relievingLetterUrl,
      relievingLetterUrl,
      documentUrl,
      documentType,
      documents
    });

    return res.status(201).json({
      message: "Current company created successfully",
      data: currentCompany
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error creating current company",
      error: error.message
    });
  }
};


export const getCurrentCompanyByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    const currentCompany = await CurrentCompany.findOne({ userId })
      .populate("reportedTo", "firstName lastName employeeCode email designation avatarUrl")
      .populate("userId", "firstName lastName employeeCode email designation avatarUrl");

    if (!currentCompany) {
      return res.status(404).json({
        message: "Current company not found"
      });
    }

    return res.status(200).json({
      data: currentCompany
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching current company",
      error: error.message
    });
  }
};


 
export const updateCurrentCompany = async (req, res) => {
  try {
    const { userId } = req.params;

    const existing = await CurrentCompany.findOne({ userId });
    if (!existing) {
      return res.status(404).json({
        message: "Current company not found"
      });
    }

    const updateData = { ...req.body };
    if (typeof updateData.documents === 'string') {
      try {
        updateData.documents = JSON.parse(updateData.documents);
      } catch (e) {}
    }

    // Handle uploaded files if present
    const files = req.files || (req.file ? [req.file] : null);
    if (files) {
      const expFile = getFileByField(files, "experienceLetter", "experienceLetterFile", "experience_letter");
      if (expFile) {
        const uploaded = await processCloudinaryUpload({
          file: expFile,
          folder: "hrms_current_company",
          entityId: userId
        });
        updateData.experienceLetter = uploaded.fileUrl;
        updateData.experienceLetterUrl = uploaded.fileUrl;
      }

      const payFile = getFileByField(files, "payslip", "payslipFile", "pay_slip", "salarySlip");
      if (payFile) {
        const uploaded = await processCloudinaryUpload({
          file: payFile,
          folder: "hrms_current_company",
          entityId: userId
        });
        updateData.payslip = uploaded.fileUrl;
        updateData.payslipUrl = uploaded.fileUrl;
      }

      const relFile = getFileByField(files, "relievingLetter", "relievingLetterFile", "relieving_letter");
      if (relFile) {
        const uploaded = await processCloudinaryUpload({
          file: relFile,
          folder: "hrms_current_company",
          entityId: userId
        });
        updateData.relievingLetter = uploaded.fileUrl;
        updateData.relievingLetterUrl = uploaded.fileUrl;
      }

      const genFile = getFileByField(files, "document", "file", "documentFile");
      if (genFile) {
        const uploaded = await processCloudinaryUpload({
          file: genFile,
          folder: "hrms_current_company",
          entityId: userId
        });
        updateData.documentUrl = uploaded.fileUrl;
      }
    }

    if (updateData.reportedTo !== undefined) {
      updateData.reportedTo = updateData.reportedTo && mongoose.Types.ObjectId.isValid(updateData.reportedTo) ? updateData.reportedTo : null;
    }
    if (updateData.experienceLetter && !updateData.experienceLetterUrl) {
      updateData.experienceLetterUrl = updateData.experienceLetter;
    }
    if (updateData.payslip && !updateData.payslipUrl) {
      updateData.payslipUrl = updateData.payslip;
    }
    if (updateData.relievingLetter && !updateData.relievingLetterUrl) {
      updateData.relievingLetterUrl = updateData.relievingLetter;
    }

    const updatedCompany = await CurrentCompany.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .populate("reportedTo", "firstName lastName employeeCode email designation avatarUrl")
      .populate("userId", "firstName lastName employeeCode email designation avatarUrl");

    return res.status(200).json({
      message: "Current company updated successfully",
      data: updatedCompany
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error updating current company",
      error: error.message
    });
  }
};

export const deleteCurrentCompany = async (req, res) => {
  try {
    const { userId } = req.params;

    const deletedCompany = await CurrentCompany.findOneAndDelete({ userId });

    if (!deletedCompany) {
      return res.status(404).json({
        message: "Current company not found"
      });
    }

    return res.status(200).json({
      message: "Current company deleted successfully"
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error deleting current company",
      error: error.message
    });
  }
};


export const getAllCurrentCompanies = async (req, res) => {
  try {
    const companies = await CurrentCompany.find()
      .populate("reportedTo", "firstName lastName employeeCode email designation avatarUrl")
      .populate("userId", "firstName lastName email mobileNo employeeCode")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      count: companies.length,
      data: companies
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching current companies",
      error: error.message
    });
  }
};

