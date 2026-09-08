import Education from "../Modules/EducationModule.js";
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

// ===== HELPER TO DETERMINE HIGHEST QUALIFICATION =====
const calculateHighestQualification = (data, existing = {}) => {
  const get = (key) => (data[key] !== undefined ? data[key] : existing[key]);

  if (get("phdInstituteName") || get("phdUniversityName") || get("phdYearOfPassing")) return "PhD";
  if (get("pgInstituteName") || get("pgUniversityName") || get("pgDegree") || get("pgYearOfPassing")) return "PG";
  if (get("ugInstituteName") || get("ugUniversityName") || get("ugDegree") || get("ugYearOfPassing")) return "UG";
  if (get("diplomainstitution") || get("diplomacourse") || get("diplomayearOfPassing")) return "DIPLOMA";
  if (get("itiinstituteName") || get("iticourse") || get("itiyearOfPassing")) return "ITI";
  if (get("hscSchoolName")) return "HSC";
  return "SSLC";
};

// ===== CREATE EDUCATION =====
export const createEducation = async (req, res) => {
  try {
    const {
      userId,
      sslcSchoolName,
      sslcBoard,
      sslcYearOfPassing,
      sslcPercentage,
      hscSchoolName,
      hscBoard,
      hscYearOfPassing,
      hscPercentage,
      itiinstituteName,
      iticourse,
      itiduration,
      itiyearOfPassing,
      itipercentage,
      diplomainstitution,
      diplomacourse,
      diplomaduration,
      diplomayearOfPassing,
      diplomapercentage,
      ugInstituteName,
      ugUniversityName,
      ugDegree,
      ugDepartmentCourse,
      ugYearOfPassing,
      ugCgpa,
      pgInstituteName,
      pgUniversityName,
      pgDegree,
      pgDepartmentCourse,
      pgYearOfPassing,
      pgCgpa,
      phdInstituteName,
      phdUniversityName,
      phdResearchArea,
      phdYearOfPassing,
      remarks
    } = req.body;

    // ===== MANDATORY FIELDS VALIDATION =====
    if (!userId) return res.status(400).json({ message: "userId is required" });

    if (!sslcSchoolName || !sslcBoard || !sslcYearOfPassing || sslcPercentage === undefined)
      return res.status(400).json({ message: "SSLC details are mandatory" });

    if (!hscSchoolName || !hscBoard || !hscYearOfPassing || hscPercentage === undefined)
      return res.status(400).json({ message: "HSC details are mandatory" });

    if (!ugInstituteName || !ugUniversityName || !ugDegree || !ugDepartmentCourse || !ugYearOfPassing || ugCgpa === undefined)
      return res.status(400).json({ message: "UG details are mandatory" });

    // ===== RANGE VALIDATIONS =====
    const checkPercentage = (val) => val !== undefined && val !== "" && (Number(val) < 0 || Number(val) > 100);
    const checkCgpa = (val) => val !== undefined && val !== "" && (Number(val) < 0 || Number(val) > 10);

    if (checkPercentage(sslcPercentage)) return res.status(400).json({ message: "SSLC percentage must be 0-100" });
    if (checkPercentage(hscPercentage)) return res.status(400).json({ message: "HSC percentage must be 0-100" });
    if (checkPercentage(itipercentage)) return res.status(400).json({ message: "ITI percentage must be 0-100" });
    if (checkPercentage(diplomapercentage)) return res.status(400).json({ message: "Diploma percentage must be 0-100" });
    if (checkCgpa(ugCgpa)) return res.status(400).json({ message: "UG CGPA must be 0-10" });
    if (checkCgpa(pgCgpa)) return res.status(400).json({ message: "PG CGPA must be 0-10" });

    // ===== CHECK IF ALREADY EXISTS =====
    const existingEducation = await Education.findOne({ userId });
    if (existingEducation) {
      return res.status(400).json({ message: "Education record already exists for this user. Use PUT to update." });
    }

    // Optional document URLs from body
    let sslcDocumentUrl = req.body.sslcDocumentUrl || req.body.sslcDoc || req.body.sslcCertificate || "";
    let hscDocumentUrl = req.body.hscDocumentUrl || req.body.hscDoc || req.body.hscCertificate || "";
    let itiDocumentUrl = req.body.itiDocumentUrl || "";
    let diplomaDocumentUrl = req.body.diplomaDocumentUrl || "";
    let ugDocumentUrl = req.body.ugDocumentUrl || req.body.ugDoc || req.body.ugCertificate || "";
    let pgDocumentUrl = req.body.pgDocumentUrl || req.body.pgDoc || req.body.pgCertificate || "";
    let phdDocumentUrl = req.body.phdDocumentUrl || req.body.phdDoc || req.body.phdCertificate || "";
    let documents = [];

    if (req.body.documents) {
      try {
        documents = typeof req.body.documents === "string" ? JSON.parse(req.body.documents) : req.body.documents;
      } catch (e) {
        documents = [];
      }
    }

    // Process optional multipart file uploads
    const files = req.files || (req.file ? [req.file] : null);
    if (files) {
      const sslcFile = getFileByField(files, "sslcDocument", "sslcDoc", "sslcCertificate", "sslc_doc", "sslcFile");
      if (sslcFile) {
        const upload = await processCloudinaryUpload({ file: sslcFile, folder: "hrms_education", entityId: userId });
        sslcDocumentUrl = upload.fileUrl;
        documents.push({ qualification: "SSLC", documentType: "MARKSHEET_OR_CERTIFICATE", fileUrl: upload.fileUrl, fileName: sslcFile.originalname, uploadedAt: new Date() });
      }

      const hscFile = getFileByField(files, "hscDocument", "hscDoc", "hscCertificate", "hsc_doc", "hscFile");
      if (hscFile) {
        const upload = await processCloudinaryUpload({ file: hscFile, folder: "hrms_education", entityId: userId });
        hscDocumentUrl = upload.fileUrl;
        documents.push({ qualification: "HSC", documentType: "MARKSHEET_OR_CERTIFICATE", fileUrl: upload.fileUrl, fileName: hscFile.originalname, uploadedAt: new Date() });
      }

      const itiFile = getFileByField(files, "itiDocument", "itiDoc", "itiCertificate", "iti_doc", "itiFile");
      if (itiFile) {
        const upload = await processCloudinaryUpload({ file: itiFile, folder: "hrms_education", entityId: userId });
        itiDocumentUrl = upload.fileUrl;
        documents.push({ qualification: "ITI", documentType: "MARKSHEET_OR_CERTIFICATE", fileUrl: upload.fileUrl, fileName: itiFile.originalname, uploadedAt: new Date() });
      }

      const diplomaFile = getFileByField(files, "diplomaDocument", "diplomaDoc", "diplomaCertificate", "diploma_doc", "diplomaFile");
      if (diplomaFile) {
        const upload = await processCloudinaryUpload({ file: diplomaFile, folder: "hrms_education", entityId: userId });
        diplomaDocumentUrl = upload.fileUrl;
        documents.push({ qualification: "DIPLOMA", documentType: "MARKSHEET_OR_CERTIFICATE", fileUrl: upload.fileUrl, fileName: diplomaFile.originalname, uploadedAt: new Date() });
      }

      const ugFile = getFileByField(files, "ugDocument", "ugDoc", "ugCertificate", "ug_doc", "ugFile");
      if (ugFile) {
        const upload = await processCloudinaryUpload({ file: ugFile, folder: "hrms_education", entityId: userId });
        ugDocumentUrl = upload.fileUrl;
        documents.push({ qualification: "UG", documentType: "DEGREE_OR_MARKSHEET", fileUrl: upload.fileUrl, fileName: ugFile.originalname, uploadedAt: new Date() });
      }

      const pgFile = getFileByField(files, "pgDocument", "pgDoc", "pgCertificate", "pg_doc", "pgFile");
      if (pgFile) {
        const upload = await processCloudinaryUpload({ file: pgFile, folder: "hrms_education", entityId: userId });
        pgDocumentUrl = upload.fileUrl;
        documents.push({ qualification: "PG", documentType: "DEGREE_OR_MARKSHEET", fileUrl: upload.fileUrl, fileName: pgFile.originalname, uploadedAt: new Date() });
      }

      const phdFile = getFileByField(files, "phdDocument", "phdDoc", "phdCertificate", "phd_doc", "phdFile");
      if (phdFile) {
        const upload = await processCloudinaryUpload({ file: phdFile, folder: "hrms_education", entityId: userId });
        phdDocumentUrl = upload.fileUrl;
        documents.push({ qualification: "PhD", documentType: "CERTIFICATE_OR_THESIS", fileUrl: upload.fileUrl, fileName: phdFile.originalname, uploadedAt: new Date() });
      }
    }

    const highestQualification = calculateHighestQualification(req.body);

    // ===== CREATE EDUCATION DOCUMENT =====
    const education = new Education({
      userId,
      sslcSchoolName,
      sslcBoard,
      sslcYearOfPassing,
      sslcPercentage,
      sslcDocumentUrl,
      sslcDoc: sslcDocumentUrl,
      sslcCertificate: sslcDocumentUrl,
      hscSchoolName,
      hscBoard,
      hscYearOfPassing,
      hscPercentage,
      hscDocumentUrl,
      hscDoc: hscDocumentUrl,
      hscCertificate: hscDocumentUrl,
      itiinstituteName: itiinstituteName || undefined,
      iticourse: iticourse || undefined,
      itiduration: itiduration || undefined,
      itiyearOfPassing: itiyearOfPassing || undefined,
      itipercentage: itipercentage || undefined,
      itiDocumentUrl,
      diplomainstitution: diplomainstitution || undefined,
      diplomacourse: diplomacourse || undefined,
      diplomaduration: diplomaduration || undefined,
      diplomayearOfPassing: diplomayearOfPassing || undefined,
      diplomapercentage: diplomapercentage || undefined,
      diplomaDocumentUrl,
      ugInstituteName,
      ugUniversityName,
      ugDegree,
      ugDepartmentCourse,
      ugYearOfPassing,
      ugCgpa,
      ugDocumentUrl,
      ugDoc: ugDocumentUrl,
      ugCertificate: ugDocumentUrl,
      pgInstituteName: pgInstituteName || undefined,
      pgUniversityName: pgUniversityName || undefined,
      pgDegree: pgDegree || undefined,
      pgDepartmentCourse: pgDepartmentCourse || undefined,
      pgYearOfPassing: pgYearOfPassing || undefined,
      pgCgpa: pgCgpa || undefined,
      pgDocumentUrl,
      pgDoc: pgDocumentUrl,
      pgCertificate: pgDocumentUrl,
      phdInstituteName: phdInstituteName || undefined,
      phdUniversityName: phdUniversityName || undefined,
      phdResearchArea: phdResearchArea || undefined,
      phdYearOfPassing: phdYearOfPassing || undefined,
      phdDocumentUrl,
      phdDoc: phdDocumentUrl,
      phdCertificate: phdDocumentUrl,
      documents,
      highestQualification,
      remarks: remarks || undefined
    });

    await education.save();
    res.status(201).json({ message: "Education created successfully", education });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ===== GET EDUCATION BY USER =====
export const getEducationByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const education = await Education.findOne({ userId });
    if (!education) return res.status(404).json({ message: "Education not found" });
    res.status(200).json(education);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ===== UPDATE EDUCATION =====
export const updateEducation = async (req, res) => {
  try {
    const { userId } = req.params;
    const updateData = { ...req.body };

    // Validate percentages and CGPA before updating
    const checkPercentage = (val) => val !== undefined && val !== "" && (Number(val) < 0 || Number(val) > 100);
    const checkCgpa = (val) => val !== undefined && val !== "" && (Number(val) < 0 || Number(val) > 10);

    if (checkPercentage(updateData.sslcPercentage)) return res.status(400).json({ message: "SSLC percentage must be 0-100" });
    if (checkPercentage(updateData.hscPercentage)) return res.status(400).json({ message: "HSC percentage must be 0-100" });
    if (checkPercentage(updateData.itipercentage)) return res.status(400).json({ message: "ITI percentage must be 0-100" });
    if (checkPercentage(updateData.diplomapercentage)) return res.status(400).json({ message: "Diploma percentage must be 0-100" });
    if (checkCgpa(updateData.ugCgpa)) return res.status(400).json({ message: "UG CGPA must be 0-10" });
    if (checkCgpa(updateData.pgCgpa)) return res.status(400).json({ message: "PG CGPA must be 0-10" });

    const existing = await Education.findOne({ userId });
    if (!existing) return res.status(404).json({ message: "Education record not found" });

    if (typeof updateData.documents === "string") {
      try {
        updateData.documents = JSON.parse(updateData.documents);
      } catch (e) {}
    }

    // Process optional multipart file uploads
    const files = req.files || (req.file ? [req.file] : null);
    if (files) {
      const sslcFile = getFileByField(files, "sslcDocument", "sslcDoc", "sslcCertificate", "sslc_doc", "sslcFile");
      if (sslcFile) {
        const upload = await processCloudinaryUpload({ file: sslcFile, folder: "hrms_education", entityId: userId });
        updateData.sslcDocumentUrl = upload.fileUrl;
        updateData.sslcDoc = upload.fileUrl;
        updateData.sslcCertificate = upload.fileUrl;
      }

      const hscFile = getFileByField(files, "hscDocument", "hscDoc", "hscCertificate", "hsc_doc", "hscFile");
      if (hscFile) {
        const upload = await processCloudinaryUpload({ file: hscFile, folder: "hrms_education", entityId: userId });
        updateData.hscDocumentUrl = upload.fileUrl;
        updateData.hscDoc = upload.fileUrl;
        updateData.hscCertificate = upload.fileUrl;
      }

      const itiFile = getFileByField(files, "itiDocument", "itiDoc", "itiCertificate", "iti_doc", "itiFile");
      if (itiFile) {
        const upload = await processCloudinaryUpload({ file: itiFile, folder: "hrms_education", entityId: userId });
        updateData.itiDocumentUrl = upload.fileUrl;
      }

      const diplomaFile = getFileByField(files, "diplomaDocument", "diplomaDoc", "diplomaCertificate", "diploma_doc", "diplomaFile");
      if (diplomaFile) {
        const upload = await processCloudinaryUpload({ file: diplomaFile, folder: "hrms_education", entityId: userId });
        updateData.diplomaDocumentUrl = upload.fileUrl;
      }

      const ugFile = getFileByField(files, "ugDocument", "ugDoc", "ugCertificate", "ug_doc", "ugFile");
      if (ugFile) {
        const upload = await processCloudinaryUpload({ file: ugFile, folder: "hrms_education", entityId: userId });
        updateData.ugDocumentUrl = upload.fileUrl;
        updateData.ugDoc = upload.fileUrl;
        updateData.ugCertificate = upload.fileUrl;
      }

      const pgFile = getFileByField(files, "pgDocument", "pgDoc", "pgCertificate", "pg_doc", "pgFile");
      if (pgFile) {
        const upload = await processCloudinaryUpload({ file: pgFile, folder: "hrms_education", entityId: userId });
        updateData.pgDocumentUrl = upload.fileUrl;
        updateData.pgDoc = upload.fileUrl;
        updateData.pgCertificate = upload.fileUrl;
      }

      const phdFile = getFileByField(files, "phdDocument", "phdDoc", "phdCertificate", "phd_doc", "phdFile");
      if (phdFile) {
        const upload = await processCloudinaryUpload({ file: phdFile, folder: "hrms_education", entityId: userId });
        updateData.phdDocumentUrl = upload.fileUrl;
        updateData.phdDoc = upload.fileUrl;
        updateData.phdCertificate = upload.fileUrl;
      }
    }

    if (updateData.sslcDoc && !updateData.sslcDocumentUrl) updateData.sslcDocumentUrl = updateData.sslcDoc;
    if (updateData.hscDoc && !updateData.hscDocumentUrl) updateData.hscDocumentUrl = updateData.hscDoc;
    if (updateData.ugDoc && !updateData.ugDocumentUrl) updateData.ugDocumentUrl = updateData.ugDoc;
    if (updateData.pgDoc && !updateData.pgDocumentUrl) updateData.pgDocumentUrl = updateData.pgDoc;
    if (updateData.phdDoc && !updateData.phdDocumentUrl) updateData.phdDocumentUrl = updateData.phdDoc;

    updateData.highestQualification = calculateHighestQualification(updateData, existing);

    const education = await Education.findOneAndUpdate({ userId }, { $set: updateData }, { new: true });
    res.status(200).json({ message: "Education updated successfully", education });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ===== DELETE EDUCATION =====
export const deleteEducation = async (req, res) => {
  try {
    const { userId } = req.params;
    const education = await Education.findOneAndDelete({ userId });
    if (!education) return res.status(404).json({ message: "Education not found" });
    res.status(200).json({ message: "Education deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ===== GET ALL EDUCATION =====
export const getAllEducation = async (req, res) => {
  try {
    const educations = await Education.find().populate("userId", "name email");
    res.status(200).json(educations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
