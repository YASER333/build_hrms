import express from 'express';
import { addExperience, deleteExperience, updateExperience, getExperienceByUserId} from '../Controller/ExperienceController.js';
import { uploadMiddleware } from '../Services/UploadService.js';

const router = express.Router();

router.post("/add", uploadMiddleware.any(), addExperience);
router.get("/get/:userId", getExperienceByUserId);
router.put("/update", uploadMiddleware.any(), updateExperience);
router.delete("/delete/:id", deleteExperience);

export default router;

