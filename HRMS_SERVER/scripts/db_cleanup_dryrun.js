import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../Modules/UserModule.js';
import Role from '../Modules/RoleModules.js';
import RoleMenu from '../Modules/RoleMenuModule.js';
import RolePermission from '../Modules/RolePermissionModule.js';
import Permission from '../Modules/PermissionModule.js';
import Onboarding from '../Modules/OnboardingModule.js';
import AuditLog from '../Modules/AuditLogModule.js';
import Attendance from '../Modules/AttendanceModule.js';
import Project from '../Modules/ProjectModule.js';

dotenv.config();

async function dryRunCleanup() {
  await mongoose.connect(process.env.MONGO_URI);

  console.log("==================================================================");
  console.log("DEVELOPMENT DATABASE INVENTORY & DRY-RUN CLEANUP REPORT");
  console.log("==================================================================");

  // 1. Roles Inventory
  const roles = await Role.find().lean();
  console.log(`\n--- ROLES INVENTORY (Total: ${roles.length}) ---`);
  const protectedRoleCodes = ["OWNER", "ADMIN", "HR", "EMPLOYEE"];
  const rolesToPreserve = [];
  const rolesToClean = [];

  for (const r of roles) {
    if (protectedRoleCodes.includes(r.roleCode) && r.isSystemRole) {
      rolesToPreserve.push(r);
      console.log(`🛡️  PRESERVE SYSTEM ROLE: [${r.roleCode}] "${r.roleName}" (Priority: ${r.priority}, ID: ${r._id})`);
    } else {
      rolesToClean.push(r);
      console.log(`🗑️  CANDIDATE TEST/CUSTOM ROLE: [${r.roleCode}] "${r.roleName}" (Priority: ${r.priority}, ID: ${r._id})`);
    }
  }

  // 2. Users Inventory
  const users = await User.find().populate("role").lean();
  console.log(`\n--- USERS INVENTORY (Total: ${users.length}) ---`);
  const usersToPreserve = [];
  const usersToClean = [];

  for (const u of users) {
    if (u.email === "owner@hrms.com") {
      usersToPreserve.push(u);
      console.log(`🛡️  PRESERVE ROOT OWNER: ${u.email} (${u.firstName} ${u.lastName}, Role: ${u.role?.roleCode || "No Role"}, ID: ${u._id})`);
    } else if (u.email.startsWith("e2e_") || u.email === "e2e_candidate@flareminds.com") {
      usersToClean.push(u);
      console.log(`🗑️  CANDIDATE E2E TEST USER: ${u.email} (${u.firstName} ${u.lastName}, Role: ${u.role?.roleCode || "No Role"}, ID: ${u._id})`);
    } else {
      console.log(`ℹ️  EXISTING USER: ${u.email} (${u.firstName} ${u.lastName}, Role: ${u.role?.roleCode || "No Role"}, Lifecycle: ${u.lifecycleStatus}, ID: ${u._id})`);
    }
  }

  // 3. Other collections count
  const [onboardingsCount, auditLogsCount, attendancesCount, projectsCount] = await Promise.all([
    Onboarding.countDocuments(),
    AuditLog.countDocuments(),
    Attendance.countDocuments(),
    Project.countDocuments(),
  ]);

  console.log(`\n--- OTHER COLLECTIONS SUMMARY ---`);
  console.log(`Onboarding Records: ${onboardingsCount}`);
  console.log(`AuditLog Records:   ${auditLogsCount}`);
  console.log(`Attendance Records: ${attendancesCount}`);
  console.log(`Project Records:    ${projectsCount}`);

  console.log("\n==================================================================");
  console.log("DRY RUN COMPLETE: Zero records deleted. Explicit confirmation required for execution.");
  console.log("==================================================================");

  await mongoose.disconnect();
}

dryRunCleanup().catch((e) => {
  console.error(e);
  process.exit(1);
});
