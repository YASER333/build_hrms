import express from "express";
import {
  initiateOffboarding,
  updateDepartmentClearance,
  completeOffboarding,
  getAllOffboardings,
} from "../Controller/OffboardingController.js";
import { Authendication, checkMenuAccess } from "../Middleware/Auth.js";

const router = express.Router();

router.use(Authendication);

router.post("/initiate", initiateOffboarding);
router.put("/:offboardingId/clearance", updateDepartmentClearance);
router.put("/:id/complete", completeOffboarding);
router.get("/all", getAllOffboardings);

export default router;
