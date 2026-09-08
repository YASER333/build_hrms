import Experience from '../Modules/ExperienceModule.js';
import User from '../Modules/UserModule.js';
import { processCloudinaryUpload } from '../Services/UploadService.js';

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

//add experience
export const addExperience = async (req, res) => {
    try{
        const userId = req.body.userId;
        const userExists = await User.findById(userId);
        if (!userExists) {
            return res.status(404).json({message: "User not found"});
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
                    folder: "hrms_experience",
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
                    folder: "hrms_experience",
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
                    folder: "hrms_experience",
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
                    folder: "hrms_experience",
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

        const newExperience = new Experience({
            userId: req.body.userId,
            companyName: req.body.companyName,
            designation: req.body.designation,
            description: req.body.description || "",
            salary: req.body.salary || "0",
            startDate: req.body.startDate,
            endDate: req.body.endDate || "",
            isCurrentJob: req.body.isCurrentJob === true || req.body.isCurrentJob === 'true',
            noticePeriod: req.body.noticePeriod || "",
            expectedLastWorkingDate: req.body.expectedLastWorkingDate ? new Date(req.body.expectedLastWorkingDate) : null,
            employmentStatus: req.body.employmentStatus || (req.body.isCurrentJob === true || req.body.isCurrentJob === 'true' ? "CURRENTLY_EMPLOYED" : "RELIEVED"),
            experience: req.body.experience,
            experienceLetter: experienceLetterUrl,
            experienceLetterUrl: experienceLetterUrl,
            payslip: payslipUrl,
            payslipUrl: payslipUrl,
            relievingLetter: relievingLetterUrl,
            relievingLetterUrl: relievingLetterUrl,
            documentUrl: documentUrl,
            documentType: documentType,
            documents: documents
        });

        const saveExp = await newExperience.save();
        res.status(201).json({message: "Experience added successfully", data: saveExp});

    }catch(error){
        res.status(400).json({message: error.message});
    }
}

//get experience by userId
export const getExperienceByUserId = async (req,res) => {
    try{
        const expList = await Experience.find({userId: req.params.userId});

        if (expList.length === 0){
            return res.status(200).json({message: "no experience found (Freshers)", data: []})
        }

        res.status(200).json({data: expList});
    }catch(error){
        res.status(400).json({message: error.message});
    }   
}

//update experience
export const updateExperience = async (req,res) => {
    try{
        const id = req.body?.id || req.params?.id;
        if(!id){
            return res.status(400).json({message: "ID is required"});
        }
        
        const existing = await Experience.findById(id);
        if (!existing) {
            return res.status(404).json({message: "Experience record not found"});
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
                    folder: "hrms_experience",
                    entityId: existing.userId
                });
                updateData.experienceLetter = uploaded.fileUrl;
                updateData.experienceLetterUrl = uploaded.fileUrl;
            }

            const payFile = getFileByField(files, "payslip", "payslipFile", "pay_slip", "salarySlip");
            if (payFile) {
                const uploaded = await processCloudinaryUpload({
                    file: payFile,
                    folder: "hrms_experience",
                    entityId: existing.userId
                });
                updateData.payslip = uploaded.fileUrl;
                updateData.payslipUrl = uploaded.fileUrl;
            }

            const relFile = getFileByField(files, "relievingLetter", "relievingLetterFile", "relieving_letter");
            if (relFile) {
                const uploaded = await processCloudinaryUpload({
                    file: relFile,
                    folder: "hrms_experience",
                    entityId: existing.userId
                });
                updateData.relievingLetter = uploaded.fileUrl;
                updateData.relievingLetterUrl = uploaded.fileUrl;
            }

            const genFile = getFileByField(files, "document", "file", "documentFile");
            if (genFile) {
                const uploaded = await processCloudinaryUpload({
                    file: genFile,
                    folder: "hrms_experience",
                    entityId: existing.userId
                });
                updateData.documentUrl = uploaded.fileUrl;
            }
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

        const updatedExp = await Experience.findByIdAndUpdate(id, {$set: updateData}, {new: true});
        res.status(200).json({message: "Updated successfully", data: updatedExp});
    }catch(error){
        res.status(400).json({message: error.message});
    }
}

//delete experience
export const deleteExperience = async (req,res) => {
  try{
    const id = req.params.id || req.body.id;
    if (!id){
        return res.status(400).json({message: "ID is required"});
    }

    const deletedExp =await Experience.findByIdAndDelete(id);
    if(!deletedExp){
        return res.status(404).json({message: "Experience record not found"});
    }
    res.status(200).json({message: "Deleted successfully"});
  }catch(error){
    res.status(400).json({message: error.message});
  }
}