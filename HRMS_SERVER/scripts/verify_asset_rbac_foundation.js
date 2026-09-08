import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Role from '../Modules/RoleModules.js';
import RolePermission from '../Modules/RolePermissionModule.js';
import RoleMenu from '../Modules/RoleMenuModule.js';
import Permission from '../Modules/PermissionModule.js';
import Menu from '../Modules/MenuModule.js';
import { seedRBACFoundation } from '../Services/PermissionSeedService.js';
import { createCustomRole, updateCustomRole, getRoleAccessConfig, deleteRole } from '../Controller/RoleController.js';

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

async function verifyAssetRBACFoundation() {
  console.log("==================================================================");
  console.log("TEST SUITE: ASSET RBAC INTEGRATION — STEP 1 (FOUNDATION)");
  console.log("==================================================================");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB...");

  // 1. Run seedRBACFoundation()
  console.log("\n[TEST 1] Seeding RBAC Foundation (Idempotency Run 1)...");
  const seedResult1 = await seedRBACFoundation();
  assert(seedResult1.success === true, "seedRBACFoundation Run 1 succeeded");

  console.log("\n[TEST 2] Seeding RBAC Foundation (Idempotency Run 2)...");
  const seedResult2 = await seedRBACFoundation();
  assert(seedResult2.success === true, "seedRBACFoundation Run 2 succeeded");

  // 2. Verify Asset Permissions in Permission collection
  console.log("\n[TEST 3] Verifying Asset Permissions in Permission catalog...");
  const expectedAssetPermCodes = ["asset.read", "asset.create", "asset.assign", "asset.return"];
  for (const code of expectedAssetPermCodes) {
    const matchingPerms = await Permission.find({ permissionCode: code }).lean();
    assert(matchingPerms.length === 1, `Permission '${code}' exists exactly once`);
    assert(matchingPerms[0]?.module === "ASSET", `Permission '${code}' belongs to module 'ASSET'`);
    assert(matchingPerms[0]?.isActive === true, `Permission '${code}' is active`);
  }

  // Ensure prohibited permissions were NOT added
  const unwantedPerms = await Permission.find({
    permissionCode: { $in: ["asset.update", "asset.delete", "asset.read.own"] },
  }).lean();
  assert(unwantedPerms.length === 0, "No out-of-scope asset permissions (update, delete, read.own) were created");

  // 3. Verify Asset Menu in Menu collection
  console.log("\n[TEST 4] Verifying 'ASSETS' Menu in Menu collection...");
  const assetMenus = await Menu.find({ menuCode: "ASSETS" }).lean();
  assert(assetMenus.length === 1, "Menu 'ASSETS' exists exactly once");
  assert(assetMenus[0]?.menuName === "Assets", "Menu 'ASSETS' has menuName 'Assets'");
  assert(assetMenus[0]?.isActive === true && !assetMenus[0]?.isBlock, "Menu 'ASSETS' is active and not blocked");

  // 4. Verify Standard Role Permission Mappings (RolePermission)
  console.log("\n[TEST 5] Verifying Standard Role Permission Mappings...");
  const [ownerRole, adminRole, hrRole, employeeRole] = await Promise.all([
    Role.findOne({ roleCode: "OWNER" }).lean(),
    Role.findOne({ roleCode: "ADMIN" }).lean(),
    Role.findOne({ roleCode: "HR" }).lean(),
    Role.findOne({ roleCode: "EMPLOYEE" }).lean(),
  ]);

  const [ownerPermDocs, adminPermDocs, hrPermDocs, empPermDocs] = await Promise.all([
    RolePermission.find({ roleId: ownerRole._id }).populate("permissionId").lean(),
    RolePermission.find({ roleId: adminRole._id }).populate("permissionId").lean(),
    RolePermission.find({ roleId: hrRole._id }).populate("permissionId").lean(),
    RolePermission.find({ roleId: employeeRole._id }).populate("permissionId").lean(),
  ]);

  const ownerCodes = ownerPermDocs.map(rp => rp.permissionId?.permissionCode);
  const adminCodes = adminPermDocs.map(rp => rp.permissionId?.permissionCode);
  const hrCodes = hrPermDocs.map(rp => rp.permissionId?.permissionCode);
  const empCodes = empPermDocs.map(rp => rp.permissionId?.permissionCode);

  for (const code of expectedAssetPermCodes) {
    assert(ownerCodes.includes(code), `OWNER has RolePermission for '${code}'`);
    assert(adminCodes.includes(code), `ADMIN has RolePermission for '${code}'`);
    assert(hrCodes.includes(code), `HR has RolePermission for '${code}'`);
    assert(!empCodes.includes(code), `EMPLOYEE does NOT have RolePermission for '${code}'`);
  }

  // 5. Verify Standard Role Menu Mappings (RoleMenu)
  console.log("\n[TEST 6] Verifying Standard Role Menu Mappings...");
  const assetMenuDoc = assetMenus[0];

  const [ownerHasAssetMenu, adminHasAssetMenu, hrHasAssetMenu, empHasAssetMenu] = await Promise.all([
    RoleMenu.exists({ roleId: ownerRole._id, menuId: assetMenuDoc._id }),
    RoleMenu.exists({ roleId: adminRole._id, menuId: assetMenuDoc._id }),
    RoleMenu.exists({ roleId: hrRole._id, menuId: assetMenuDoc._id }),
    RoleMenu.exists({ roleId: employeeRole._id, menuId: assetMenuDoc._id }),
  ]);

  assert(!!ownerHasAssetMenu, "OWNER has RoleMenu mapping for 'ASSETS'");
  assert(!!adminHasAssetMenu, "ADMIN has RoleMenu mapping for 'ASSETS'");
  assert(!!hrHasAssetMenu, "HR has RoleMenu mapping for 'ASSETS'");
  assert(!empHasAssetMenu, "EMPLOYEE does NOT have RoleMenu mapping for 'ASSETS'");

  // 6. Verify Dynamic Custom Role support with Asset permissions
  console.log("\n[TEST 7] Testing dynamic Custom Role creation with Asset permissions...");
  const customRoleName = `Custom Asset Officer ${Date.now()}`;
  const reqCreate = {
    user: { priority: 1, roleCode: "OWNER" },
    body: {
      roleName: customRoleName,
      description: "Custom role for testing Asset RBAC assignment",
      priority: 4,
      menuIds: [assetMenuDoc._id.toString()],
      permissionCodes: ["asset.read", "asset.assign"],
    },
  };

  let createRes = null;
  await createCustomRole(reqCreate, {
    status: (code) => ({
      json: (data) => {
        createRes = { code, ...data };
        return createRes;
      },
    }),
  });

  assert(createRes?.success === true, `Created custom role '${customRoleName}'`);
  const customRoleId = createRes?.data?._id;

  // Verify custom role access config
  let accessRes = null;
  await getRoleAccessConfig({ params: { id: customRoleId.toString() } }, {
    status: (code) => ({
      json: (data) => {
        accessRes = { code, ...data };
        return accessRes;
      },
    }),
  });

  const customPermCodes = accessRes?.data?.permissionCodes?.sort();
  assert(
    JSON.stringify(customPermCodes) === JSON.stringify(["asset.assign", "asset.read"]),
    `Custom role has exact asset permissions: ${customPermCodes?.join(", ")}`
  );
  assert(accessRes?.data?.menus?.some(m => m.menuCode === "ASSETS"), "Custom role has ASSETS menu");

  // Clean up test custom role
  await deleteRole({ params: { id: customRoleId.toString() } }, {
    status: () => ({ json: () => {} }),
  });

  // 7. Verify Role.permissions is NOT present in MongoDB documents
  console.log("\n[TEST 8] Confirming 'Role.permissions' is NOT present in MongoDB documents...");
  const rawRoles = await Role.collection.find({}).toArray();
  const rolesWithPermField = rawRoles.filter(r => Object.prototype.hasOwnProperty.call(r, "permissions"));
  assert(rolesWithPermField.length === 0, "Zero roles in MongoDB contain the legacy 'permissions' field");

  console.log("\n==================================================================");
  console.log(`ASSET RBAC FOUNDATION VERIFICATION: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================================");

  await mongoose.disconnect();

  if (failed > 0) {
    process.exit(1);
  }
}

verifyAssetRBACFoundation().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
