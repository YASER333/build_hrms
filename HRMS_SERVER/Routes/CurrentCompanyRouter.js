import express from "express";
import {
  createCurrentCompany,
  getCurrentCompanyByUserId,
  updateCurrentCompany,
  deleteCurrentCompany,
  getAllCurrentCompanies
} from "../Controller/CurrentCompanyController.js";
import { uploadMiddleware } from "../Services/UploadService.js";

const router = express.Router();

router.post("/", uploadMiddleware.any(), createCurrentCompany);
router.get("/", getAllCurrentCompanies);
router.get("/:userId", getCurrentCompanyByUserId);
router.put("/:userId", uploadMiddleware.any(), updateCurrentCompany);
router.delete("/:userId", deleteCurrentCompany);

export default router;

