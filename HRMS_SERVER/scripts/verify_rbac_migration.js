import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Role from '../Modules/RoleModules.js';
import RolePermission from '../Modules/RolePermissionModule.js';
import RoleMenu from '../Modules/RoleMenuModule.js';
import Permission from '../Modules/PermissionModule.js';
import Menu from '../Modules/MenuModule.js';
import User from '../Modules/UserModule.js';
import { seedRBACFoundation } from '../Services/PermissionSeedService.js';
import { createCustomRole, updateCustomRole, getRoleAccessConfig, getAllRoles, deleteRole } from '../Controller/RoleController.js';

dotenv.config();

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runVerification() {
  console.log("==================================================================");
  console.log("RBAC MIGRATION VERIFICATION SUITE");
  console.log("==================================================================");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB...");

  // 1. Run seed / migration
  console.log("\n[TEST 1] Executing seedRBACFoundation() with data migration...");
  const seedResult = await seedRBACFoundation();
  assert(seedResult.success === true, "seedRBACFoundation completed successfully");

  // 2. Verify all Role documents in DB have NO 'permissions' field
  console.log("\n[TEST 2] Verifying schema & document cleanup in MongoDB...");
  const rawRoles = await Role.collection.find({}).toArray();
  const rolesWithLegacyPermissions = rawRoles.filter(r => Object.prototype.hasOwnProperty.call(r, "permissions"));
  assert(rolesWithLegacyPermissions.length === 0, `All roles in DB have NO legacy 'permissions' field (found: ${rolesWithLegacyPermissions.length})`);

  // 3. Verify Standard Roles in RolePermission collection
  console.log("\n[TEST 3] Verifying Standard Roles permissions in RolePermission...");
  const ownerRole = await Role.findOne({ roleCode: "OWNER" }).lean();
  const adminRole = await Role.findOne({ roleCode: "ADMIN" }).lean();
  const hrRole = await Role.findOne({ roleCode: "HR" }).lean();
  const employeeRole = await Role.findOne({ roleCode: "EMPLOYEE" }).lean();

  assert(!!ownerRole && !ownerRole.permissions, "Owner role exists without 'permissions' field");
  assert(!!adminRole && !adminRole.permissions, "Admin role exists without 'permissions' field");
  assert(!!hrRole && !hrRole.permissions, "HR role exists without 'permissions' field");
  assert(!!employeeRole && !employeeRole.permissions, "Employee role exists without 'permissions' field");

  const [ownerPermCount, adminPermCount, hrPermCount, empPermCount] = await Promise.all([
    RolePermission.countDocuments({ roleId: ownerRole._id }),
    RolePermission.countDocuments({ roleId: adminRole._id }),
    RolePermission.countDocuments({ roleId: hrRole._id }),
    RolePermission.countDocuments({ roleId: employeeRole._id }),
  ]);

  assert(ownerPermCount >= 30, `Owner has full permissions in RolePermission (${ownerPermCount})`);
  assert(adminPermCount >= 30, `Admin has full permissions in RolePermission (${adminPermCount})`);
  assert(hrPermCount >= 10, `HR has standard permissions in RolePermission (${hrPermCount})`);
  assert(empPermCount === 8, `Employee has 8 self-service permissions in RolePermission (${empPermCount})`);

  // 4. Test Controller: createCustomRole
  console.log("\n[TEST 4] Testing createCustomRole controller...");
  const testRoleName = `Test QA Engineer ${Date.now()}`;
  const reqCreate = {
    user: { priority: 1, roleCode: "OWNER" },
    body: {
      roleName: testRoleName,
      description: "Custom role for automated testing",
      priority: 4,
      menuIds: [],
      permissionCodes: ["attendance.read.own", "project.read", "project.create"],
    },
  };

  let createResponseData = null;
  const resCreate = {
    status: (code) => ({
      json: (data) => {
        createResponseData = { statusCode: code, ...data };
        return createResponseData;
      },
    }),
  };

  await createCustomRole(reqCreate, resCreate);
  assert(createResponseData?.success === true, `createCustomRole returned success: ${createResponseData?.message}`);
  const createdRoleId = createResponseData?.data?._id;

  // Verify created role in DB has NO 'permissions' field
  const rawCreatedRole = await Role.collection.findOne({ _id: createdRoleId });
  assert(!Object.prototype.hasOwnProperty.call(rawCreatedRole, "permissions"), "Created role has NO 'permissions' field in MongoDB");

  // Verify RolePermission mappings for created role
  const createdRolePerms = await RolePermission.find({ roleId: createdRoleId }).populate("permissionId").lean();
  const createdPermCodes = createdRolePerms.map(rp => rp.permissionId?.permissionCode).sort();
  assert(
    JSON.stringify(createdPermCodes) === JSON.stringify(["attendance.read.own", "project.create", "project.read"]),
    `Created role has exact 3 RolePermission mappings: ${createdPermCodes.join(", ")}`
  );

  // 5. Test Controller: getRoleAccessConfig
  console.log("\n[TEST 5] Testing getRoleAccessConfig controller...");
  let accessConfigData = null;
  const resAccess = {
    status: (code) => ({
      json: (data) => {
        accessConfigData = { statusCode: code, ...data };
        return accessConfigData;
      },
    }),
  };

  await getRoleAccessConfig({ params: { id: createdRoleId.toString() } }, resAccess);
  assert(accessConfigData?.success === true, "getRoleAccessConfig returned success");
  assert(
    JSON.stringify(accessConfigData?.data?.permissionCodes?.sort()) === JSON.stringify(["attendance.read.own", "project.create", "project.read"]),
    `getRoleAccessConfig returned correct permissionCodes array: ${accessConfigData?.data?.permissionCodes?.join(", ")}`
  );

  // 6. Test Controller: updateCustomRole (Sync permissions)
  console.log("\n[TEST 6] Testing updateCustomRole controller (Updating permissions)...");
  const reqUpdate = {
    params: { id: createdRoleId.toString() },
    user: { priority: 1, roleCode: "OWNER" },
    body: {
      roleName: testRoleName,
      description: "Updated description",
      priority: 4,
      isActive: true,
      permissionCodes: ["attendance.read.own", "attendance.punch_in", "attendance.punch_out"],
    },
  };

  let updateResponseData = null;
  const resUpdate = {
    status: (code) => ({
      json: (data) => {
        updateResponseData = { statusCode: code, ...data };
        return updateResponseData;
      },
    }),
  };

  await updateCustomRole(reqUpdate, resUpdate);
  assert(updateResponseData?.success === true, `updateCustomRole returned success: ${updateResponseData?.message}`);

  // Verify updated RolePermission in DB
  const updatedRolePerms = await RolePermission.find({ roleId: createdRoleId }).populate("permissionId").lean();
  const updatedPermCodes = updatedRolePerms.map(rp => rp.permissionId?.permissionCode).sort();
  assert(
    JSON.stringify(updatedPermCodes) === JSON.stringify(["attendance.punch_in", "attendance.punch_out", "attendance.read.own"]),
    `Updated role RolePermission synchronized cleanly to new set: ${updatedPermCodes.join(", ")}`
  );

  // 7. Test Controller: getAllRoles (Permission counts)
  console.log("\n[TEST 7] Testing getAllRoles controller (Permission counts)...");
  let allRolesData = null;
  const resAllRoles = {
    status: (code) => ({
      json: (data) => {
        allRolesData = { statusCode: code, ...data };
        return allRolesData;
      },
    }),
  };

  await getAllRoles({}, resAllRoles);
  assert(allRolesData?.success === true, "getAllRoles returned success");
  const targetRoleSummary = allRolesData?.data?.find(r => r._id.toString() === createdRoleId.toString());
  assert(targetRoleSummary?.permissionCount === 3, `getAllRoles returned accurate permissionCount derived from RolePermission: ${targetRoleSummary?.permissionCount}`);

  // 8. Test Controller: deleteRole
  console.log("\n[TEST 8] Testing deleteRole and cascade cleanup...");
  let deleteResponseData = null;
  const resDelete = {
    status: (code) => ({
      json: (data) => {
        deleteResponseData = { statusCode: code, ...data };
        return deleteResponseData;
      },
    }),
  };

  await deleteRole({ params: { id: createdRoleId.toString() } }, resDelete);
  assert(deleteResponseData?.success === true, `deleteRole returned success: ${deleteResponseData?.message}`);

  const remainingRolePerms = await RolePermission.countDocuments({ roleId: createdRoleId });
  assert(remainingRolePerms === 0, `Cascade cleanup removed all associated RolePermission mappings (${remainingRolePerms} remaining)`);

  console.log("\n==================================================================");
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================================");

  await mongoose.disconnect();

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification().catch(err => {
  console.error("Verification error:", err);
  process.exit(1);
});
