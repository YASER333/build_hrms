import express from "express";
import {
  submitReimbursement,
  markReimbursementPaid,
  getReimbursements,
} from "../Controller/ReimbursementController.js";
import { Authendication } from "../Middleware/Auth.js";

const router = express.Router();

router.use(Authendication);

router.post("/submit", submitReimbursement);
router.put("/:id/pay", markReimbursementPaid);
router.get("/all", getReimbursements);

export default router;
