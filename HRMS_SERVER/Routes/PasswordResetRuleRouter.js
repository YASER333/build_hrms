import express from "express";
import {
  createOrUpdateRule,
  getAllRules,
  getRuleByRole,
  deleteRule,
} from "../Controller/PasswordResetRuleController.js";
import { Authentication, isAdmin } from "../Middleware/Auth.js";

const router = express.Router();

router.use(Authentication);
router.use(isAdmin);

router.post("/", createOrUpdateRule);
router.get("/", getAllRules);
router.get("/:roleId", getRuleByRole);
router.delete("/:id", deleteRule);

export default router;
