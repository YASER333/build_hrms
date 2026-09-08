import express from "express";
import {
  uploadDocument,
  replaceDocumentVersion,
  updateVerificationStatus,
  configureDocumentRequirement,
  getDocumentRequirements,
  getEmployeeDocuments,
  getEntityDocuments,
} from "../Controller/DocumentSystemController.js";
import { uploadMiddleware } from "../Services/UploadService.js";
import { Authendication, isAdmin } from "../Middleware/Auth.js";

const router = express.Router();

router.use(Authendication);

// Configurable Document Requirements (Admin/Owner)
router.post("/requirements", isAdmin, configureDocumentRequirement);
router.get("/requirements", getDocumentRequirements);

// Centralized Upload & Versioning
router.post("/upload", uploadMiddleware.single("file"), uploadDocument);
router.post("/:id/replace", uploadMiddleware.single("file"), replaceDocumentVersion);

// Verification Workflow (HR / Admin)
router.put("/:id/verify", updateVerificationStatus);

// Portfolio & Retrieval
router.get("/employee/:employeeId", getEmployeeDocuments);
router.get("/entity/:entityType/:entityId", getEntityDocuments);

export default router;
