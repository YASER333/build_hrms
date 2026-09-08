import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../Modules/UserModule.js";
import Role from "../Modules/RoleModules.js";
import RoleMenu from "../Modules/RoleMenuModule.js";
import RolePermission from "../Modules/RolePermissionModule.js";
import Onboarding from "../Modules/OnboardingModule.js";
import Attendance from "../Modules/AttendanceModule.js";
import AuditLog from "../Modules/AuditLogModule.js";
import Project from "../Modules/ProjectModule.js";

dotenv.config();

async function resetDatabaseToCleanOwnerState() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("==================================================================");
  console.log("EXECUTING CLEAN DEVELOPMENT DATABASE RESET");
  console.log("==================================================================");

  // 1. Identify Root Owner
  const ownerUser = await User.findOne({ email: "owner@hrms.com" });
  if (!ownerUser) {
    console.error("❌ ERROR: owner@hrms.com not found. Aborting reset to prevent data loss.");
    process.exit(1);
  }
  console.log(`🛡️  PRESERVING ROOT OWNER: ${ownerUser.email} (ID: ${ownerUser._id})`);

  // 2. Identify and Preserve 4 Protected System Roles
  const systemRoles = await Role.find({
    roleCode: { $in: ["OWNER", "ADMIN", "HR", "EMPLOYEE"] },
    isSystemRole: true,
  });
  console.log(`🛡️  PRESERVING 4 SYSTEM ROLES: ${systemRoles.map((r) => `${r.roleCode} (${r.roleName})`).join(", ")}`);
  const systemRoleIds = systemRoles.map((r) => r._id);

  // 3. Delete Non-Owner Users
  const userDeleteResult = await User.deleteMany({ _id: { $ne: ownerUser._id } });
  console.log(`🗑️  DELETED TEST USERS: ${userDeleteResult.deletedCount} user records removed.`);

  // 4. Delete Custom/Test Roles
  const customRoles = await Role.find({ _id: { $nin: systemRoleIds } });
  const customRoleIds = customRoles.map((r) => r._id);
  const roleDeleteResult = await Role.deleteMany({ _id: { $in: customRoleIds } });
  console.log(`🗑️  DELETED CUSTOM ROLES: ${roleDeleteResult.deletedCount} custom role records removed.`);

  // 5. Clean up RoleMenu and RolePermission for deleted custom roles
  if (customRoleIds.length > 0) {
    await RoleMenu.deleteMany({ roleId: { $in: customRoleIds } });
    await RolePermission.deleteMany({ roleId: { $in: customRoleIds } });
    console.log(`🗑️  CLEANED UP ORPHANED JUNCTION RECORDS for deleted custom roles.`);
  }

  // 6. Reset Test Onboarding, Attendance, and AuditLog records
  const onboardingDelete = await Onboarding.deleteMany({});
  const attendanceDelete = await Attendance.deleteMany({});
  const auditLogDelete = await AuditLog.deleteMany({});
  const projectDelete = await Project.deleteMany({});

  console.log(`🗑️  RESET ONBOARDING RECORDS: ${onboardingDelete.deletedCount} removed.`);
  console.log(`🗑️  RESET ATTENDANCE RECORDS: ${attendanceDelete.deletedCount} removed.`);
  console.log(`🗑️  RESET AUDIT LOGS: ${auditLogDelete.deletedCount} removed.`);
  console.log(`🗑️  RESET PROJECTS: ${projectDelete.deletedCount} removed.`);

  console.log("\n==================================================================");
  console.log("DATABASE RESET COMPLETE");
  console.log("Current State:");
  console.log(`- Active Users: 1 (owner@hrms.com)`);
  console.log(`- Standard System Roles: 4 (OWNER, ADMIN, HR, EMPLOYEE)`);
  console.log(`- Custom Roles: 0`);
  console.log("==================================================================");

  await mongoose.disconnect();
}

resetDatabaseToCleanOwnerState().catch((err) => {
  console.error(err);
  process.exit(1);
});
