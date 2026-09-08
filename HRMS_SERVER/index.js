import express from 'express';
import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import dotenv from "dotenv";
import cors from "cors";
import user from './Routes/UserRouter.js';
import role from './Routes/RoleRouter.js';
import menu from './Routes/MenuRouter.js';
import experience from './Routes/ExperienceRouter.js';
import address from "./Routes/addressRouter.js";
import family from './Routes/FamilyRouter.js';
import roleMenu from './Routes/RoleMenuRouter.js';
import education from './Routes/EducationRoutes.js';
import document from './Routes/DocumentRouter.js';
import currentCompany from './Routes/CurrentCompanyRouter.js';
import leave from './Routes/LeaveRouter.js';
import dailyReport from './Routes/DailyReportRouter.js';
import attendance from './Routes/AttendanceRouter.js';
import project from './Routes/ProjectRouter.js';
import task from './Routes/TaskRouter.js';
import timeTracking from './Routes/TimeTrackingRouter.js';
import sprint from './Routes/SprintRouter.js';
import team from './Routes/TeamRouter.js';
import dashboard from './Routes/DashboardRouter.js';
import passwordResetRule from './Routes/PasswordResetRuleRouter.js';
import passwordReset from './Routes/PasswordResetRouter.js';
import onboarding from './Routes/OnboardingRouter.js';
import resignation from './Routes/ResignationRouter.js';
import offboarding from './Routes/OffboardingRouter.js';
import reimbursement from './Routes/ReimbursementRouter.js';
import asset from './Routes/AssetRouter.js';
import approvalWorkflow from './Routes/ApprovalWorkflowRouter.js';
import auditLog from './Routes/AuditLogRouter.js';
import documentSystem from './Routes/DocumentSystemRouter.js';
import auth from './Routes/AuthRouter.js';
import permission from './Routes/PermissionRouter.js';
import { seedRBACFoundation } from './Services/PermissionSeedService.js';

dotenv.config({ override: true });

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

mongoose.set('strictQuery', false);
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('Connected to MongoDB...');
    // Initialize RBAC foundation catalog and standard mappings safely
    await seedRBACFoundation();
  })
  .catch(err => console.error('Could not connect to MongoDB... ' + err.message));

app.use("/api/auth", auth);
app.use("/api/permission", permission);
app.use("/api/user", user);
app.use("/api/menu", menu);
app.use("/api/experience", experience);
app.use("/api/address", address);
app.use("/api/role", role);
app.use("/api/family", family);
app.use("/api/rolemenu", roleMenu);
app.use("/api/education", education);
app.use("/api/document", document);
app.use("/api/currentcompany", currentCompany);
app.use("/api/leave", leave);
app.use("/api/daily-report", dailyReport);
app.use("/api/attendance", attendance);
app.use("/api/project", project);
app.use("/api/task", task);
app.use("/api/time-tracking", timeTracking);
app.use("/api/sprint", sprint);
app.use("/api/team", team);
app.use("/api/dashboard", dashboard);
app.use("/api/password-reset-rule", passwordResetRule);
app.use("/api/password-reset", passwordReset);
app.use("/api/onboarding", onboarding);
app.use("/api/resignation", resignation);
app.use("/api/offboarding", offboarding);
app.use("/api/reimbursement", reimbursement);
app.use("/api/asset", asset);
app.use("/api/approval-workflow", approvalWorkflow);
app.use("/api/audit-log", auditLog);
app.use("/api/v1/documents", documentSystem);

app.get("/", (req, res) => {
  res.send("API is running...");
});

const PORT = process.env.PORT || 7800;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
