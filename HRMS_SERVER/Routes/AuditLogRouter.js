import express from "express";
import { getAuditLogs } from "../Controller/AuditLogController.js";
import { Authendication, isAdmin } from "../Middleware/Auth.js";

const router = express.Router();

router.use(Authendication);
router.get("/logs", isAdmin, getAuditLogs);

export default router;
