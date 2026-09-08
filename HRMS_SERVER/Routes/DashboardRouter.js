import express from "express";
import { getProjectDashboard } from "../Controller/DashboardController.js";
import { Authendication } from "../Middleware/Auth.js";

const router = express.Router();

router.get("/getProjectDashboard/:projectId", Authendication, getProjectDashboard);

export default router;
