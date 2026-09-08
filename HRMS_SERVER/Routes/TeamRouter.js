import express from "express";
import { getUserProductivity } from "../Controller/TeamController.js";
import { Authendication } from "../Middleware/Auth.js";

const router = express.Router();

router.use(Authendication);

// Team Productivity Metrics Route
router.get("/:userId/productivity", getUserProductivity);

export default router;
