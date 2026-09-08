import express from "express";
import {
  submitResignation,
  withdrawResignation,
  getAllResignations,
  updateExitDetails,
} from "../Controller/ResignationController.js";
import { Authendication } from "../Middleware/Auth.js";

const router = express.Router();

router.use(Authendication);

router.post("/submit", submitResignation);
router.put("/withdraw/:id", withdrawResignation);
router.get("/all", getAllResignations);
router.put("/exit-details/:id", updateExitDetails);

export default router;
