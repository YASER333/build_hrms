import express from "express";
import {
    logTime,
    addTimeTracking,
    getTimeLogsByTask,
    getTimeLogsByUser,
    updateTimeLog
} from "../Controller/TimeTrackingController.js";
import { Authendication } from "../Middleware/Auth.js";

const router = express.Router();

router.use(Authendication);

// Time Tracking Routes
router.post("/log", logTime);
router.get("/task/:taskId", getTimeLogsByTask);
router.get("/user/:userId", getTimeLogsByUser);
router.put("/:id", updateTimeLog);

// Legacy/Helper Routes
router.post("/add", addTimeTracking);
router.get("/getByTask/:taskId", getTimeLogsByTask);

export default router;
