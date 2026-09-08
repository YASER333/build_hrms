import mongoose from 'mongoose';
import dotenv from 'dotenv';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import User from '../Modules/UserModule.js';
import Role from '../Modules/RoleModules.js';
import RolePermission from '../Modules/RolePermissionModule.js';
import Permission from '../Modules/PermissionModule.js';
import Asset from '../Modules/AssetModule.js';
import { seedRBACFoundation } from '../Services/PermissionSeedService.js';
import { createCustomRole, deleteRole } from '../Controller/RoleController.js';

dotenv.config();

const BASE_URL = 'http://localhost:7800/api';
const JWT_SECRET = process.env.JWT;

function generateTestToken(userId) {
  return jwt.sign({ sub: userId.toString() }, JWT_SECRET, {
    expiresIn: '1h',
    issuer: 'hrms',
    audience: 'hrms-client',
  });
}

let passed = 0;
let failed = 0;

function assert(condition, message, details = "") {
  if (condition) {
    console.log(`  ✅ PASS: ${message} ${details ? `(${details})` : ""}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message} ${details ? `(${details})` : ""}`);
    failed++;
  }
}

async function runAssetRouterRBACVerification() {
  console.log("==================================================================");
  console.log("TEST SUITE: ASSET ROUTER RBAC AUTHORIZATION ENFORCEMENT");
  console.log("==================================================================");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB...");

  // 0. Ensure seed foundation is populated
  await seedRBACFoundation();

  const [hrRole, employeeRole, ownerRole] = await Promise.all([
    Role.findOne({ roleCode: "HR" }).lean(),
    Role.findOne({ roleCode: "EMPLOYEE" }).lean(),
    Role.findOne({ roleCode: "OWNER" }).lean(),
  ]);

  // Find or create test HR user
  let hrUser = await User.findOne({ email: "hr_test_asset_rbac@flareminds.com" });
  if (!hrUser) {
    hrUser = await User.create({
      firstName: "HR",
      lastName: "Tester",
      email: "hr_test_asset_rbac@flareminds.com",
      password: "hashedPassword123",
      employeeCode: "HR_AST_001",
      dob: new Date("1992-01-01"),
      gender: "Male",
      marriageStatus: "Unmarried",
      mobileNo: "9876543210",
      role: hrRole._id,
      isActive: true,
      hasLoginAccess: true,
    });
  } else {
    hrUser.role = hrRole._id;
    hrUser.isActive = true;
    hrUser.isBlocked = false;
    hrUser.hasLoginAccess = true;
    await hrUser.save();
  }

  // Find or create test Employee user
  let empUser = await User.findOne({ email: "emp_test_asset_rbac@flareminds.com" });
  if (!empUser) {
    empUser = await User.create({
      firstName: "Employee",
      lastName: "Tester",
      email: "emp_test_asset_rbac@flareminds.com",
      password: "hashedPassword123",
      employeeCode: "EMP_AST_001",
      dob: new Date("1995-05-15"),
      gender: "Female",
      marriageStatus: "Unmarried",
      mobileNo: "9876543211",
      role: employeeRole._id,
      isActive: true,
      hasLoginAccess: true,
    });
  } else {
    empUser.role = employeeRole._id;
    empUser.isActive = true;
    empUser.isBlocked = false;
    empUser.hasLoginAccess = true;
    await empUser.save();
  }

  const hrToken = generateTestToken(hrUser._id);
  const empToken = generateTestToken(empUser._id);

  let createdAssetId = null;

  // ─── TEST 1: HR WITH ASSET.CREATE ───
  console.log("\n[TEST 1] HR with 'asset.create' calling POST /api/asset/create...");
  const uniqueSerial = `TEST-SR-${Date.now()}`;
  try {
    const res = await axios.post(
      `${BASE_URL}/asset/create`,
      {
        name: "MacBook Pro 16",
        category: "LAPTOP",
        serialNumber: uniqueSerial,
        modelName: "M3 Max",
        manufacturer: "Apple",
      },
      { headers: { Authorization: `Bearer ${hrToken}` } }
    );
    assert(res.status === 201 && res.data.success, "HR successfully creates asset", `AssetCode: ${res.data.data?.assetCode}`);
    createdAssetId = res.data.data?._id;
  } catch (err) {
    assert(false, "HR create asset failed", err.response?.data?.message || err.message);
  }

  // ─── TEST 2: HR WITH ASSET.ASSIGN ───
  console.log("\n[TEST 2] HR with 'asset.assign' calling POST /api/asset/assign...");
  try {
    const res = await axios.post(
      `${BASE_URL}/asset/assign`,
      {
        assetId: createdAssetId,
        employeeId: empUser._id.toString(),
        conditionOnAssign: "NEW",
        remarks: "Assigned for development work",
      },
      { headers: { Authorization: `Bearer ${hrToken}` } }
    );
    assert(res.status === 200 && res.data.success, "HR successfully assigns asset to employee", `Status: ${res.data.data?.status}`);
  } catch (err) {
    assert(false, "HR assign asset failed", err.response?.data?.message || err.message);
  }

  // ─── TEST 3: HR WITH ASSET.RETURN ───
  console.log("\n[TEST 3] HR with 'asset.return' calling PUT /api/asset/:assetId/return...");
  try {
    const res = await axios.put(
      `${BASE_URL}/asset/${createdAssetId}/return`,
      {
        conditionOnReturn: "GOOD",
        remarks: "Returned in good working condition",
      },
      { headers: { Authorization: `Bearer ${hrToken}` } }
    );
    assert(res.status === 200 && res.data.success, "HR successfully returns asset to inventory", `Status: ${res.data.data?.status}`);
  } catch (err) {
    assert(false, "HR return asset failed", err.response?.data?.message || err.message);
  }

  // ─── TEST 4: HR WITH ASSET.READ ───
  console.log("\n[TEST 4] HR with 'asset.read' calling GET /api/asset/all...");
  try {
    const res = await axios.get(
      `${BASE_URL}/asset/all`,
      { headers: { Authorization: `Bearer ${hrToken}` } }
    );
    assert(res.status === 200 && res.data.success, "HR successfully reads asset inventory", `Total: ${res.data.pagination?.totalRecords}`);
  } catch (err) {
    assert(false, "HR read assets failed", err.response?.data?.message || err.message);
  }

  // ─── TEST 5: EMPLOYEE WITHOUT ASSET PERMISSIONS (ALL ENDPOINTS MUST RETURN 403) ───
  console.log("\n[TEST 5] Employee without Asset permissions attempting Asset endpoints (Expected: 403 Forbidden)...");

  // 5.1 POST /create
  try {
    await axios.post(
      `${BASE_URL}/asset/create`,
      { name: "Unauthorized Laptop", category: "LAPTOP", serialNumber: `EMP-${Date.now()}` },
      { headers: { Authorization: `Bearer ${empToken}` } }
    );
    assert(false, "Employee POST /create should have been blocked");
  } catch (err) {
    assert(err.response?.status === 403, "Employee POST /create blocked with 403", err.response?.data?.message);
  }

  // 5.2 POST /assign
  try {
    await axios.post(
      `${BASE_URL}/asset/assign`,
      { assetId: createdAssetId, employeeId: empUser._id.toString() },
      { headers: { Authorization: `Bearer ${empToken}` } }
    );
    assert(false, "Employee POST /assign should have been blocked");
  } catch (err) {
    assert(err.response?.status === 403, "Employee POST /assign blocked with 403", err.response?.data?.message);
  }

  // 5.3 PUT /return
  try {
    await axios.put(
      `${BASE_URL}/asset/${createdAssetId}/return`,
      { conditionOnReturn: "GOOD" },
      { headers: { Authorization: `Bearer ${empToken}` } }
    );
    assert(false, "Employee PUT /return should have been blocked");
  } catch (err) {
    assert(err.response?.status === 403, "Employee PUT /return blocked with 403", err.response?.data?.message);
  }

  // 5.4 GET /all
  try {
    await axios.get(
      `${BASE_URL}/asset/all`,
      { headers: { Authorization: `Bearer ${empToken}` } }
    );
    assert(false, "Employee GET /all should have been blocked");
  } catch (err) {
    assert(err.response?.status === 403, "Employee GET /all blocked with 403", err.response?.data?.message);
  }

  // ─── TEST 6: UNAUTHENTICATED REQUESTS (EXPECTED: 401 UNAUTHORIZED) ───
  console.log("\n[TEST 6] Unauthenticated requests (Expected: 401 Unauthorized)...");

  // 6.1 POST /create
  try {
    await axios.post(`${BASE_URL}/asset/create`, { name: "No Auth" });
    assert(false, "Unauthenticated POST /create should have been blocked");
  } catch (err) {
    assert(err.response?.status === 401, "Unauthenticated POST /create blocked with 401");
  }

  // 6.2 POST /assign
  try {
    await axios.post(`${BASE_URL}/asset/assign`, { assetId: createdAssetId });
    assert(false, "Unauthenticated POST /assign should have been blocked");
  } catch (err) {
    assert(err.response?.status === 401, "Unauthenticated POST /assign blocked with 401");
  }

  // 6.3 PUT /return
  try {
    await axios.put(`${BASE_URL}/asset/${createdAssetId}/return`, {});
    assert(false, "Unauthenticated PUT /return should have been blocked");
  } catch (err) {
    assert(err.response?.status === 401, "Unauthenticated PUT /return blocked with 401");
  }

  // 6.4 GET /all
  try {
    await axios.get(`${BASE_URL}/asset/all`);
    assert(false, "Unauthenticated GET /all should have been blocked");
  } catch (err) {
    assert(err.response?.status === 401, "Unauthenticated GET /all blocked with 401");
  }

  // ─── TEST 7: CUSTOM ROLE WITH ONLY ASSET.READ ───
  console.log("\n[TEST 7] Custom Role with ONLY 'asset.read' permission...");
  const customRoleName = `Auditor Role ${Date.now()}`;
  let customRoleId = null;

  // Create custom role with ONLY asset.read
  let createResData = null;
  await createCustomRole(
    {
      user: { priority: 1, roleCode: "OWNER" },
      body: {
        roleName: customRoleName,
        description: "Custom role with read-only asset access",
        priority: 4,
        menuIds: [],
        permissionCodes: ["asset.read"],
      },
    },
    {
      status: (code) => ({
        json: (data) => {
          createResData = { code, ...data };
          return createResData;
        },
      }),
    }
  );

  customRoleId = createResData?.data?._id;
  assert(createResData?.success === true, `Created custom role '${customRoleName}' with ONLY 'asset.read'`);

  // Create or update custom user
  let customUser = await User.findOne({ email: "auditor_custom_asset@flareminds.com" });
  if (!customUser) {
    customUser = await User.create({
      firstName: "Asset",
      lastName: "Auditor",
      email: "auditor_custom_asset@flareminds.com",
      password: "hashedPassword123",
      employeeCode: "AUD_AST_001",
      dob: new Date("1990-03-20"),
      gender: "Male",
      marriageStatus: "Married",
      mobileNo: "9876543299",
      role: customRoleId,
      isActive: true,
      hasLoginAccess: true,
    });
  } else {
    customUser.role = customRoleId;
    customUser.isActive = true;
    customUser.isBlocked = false;
    customUser.hasLoginAccess = true;
    await customUser.save();
  }

  const customToken = generateTestToken(customUser._id);

  // 7.1 GET /all -> ALLOWED
  try {
    const res = await axios.get(`${BASE_URL}/asset/all`, { headers: { Authorization: `Bearer ${customToken}` } });
    assert(res.status === 200 && res.data.success, "Custom Auditor allowed GET /all", `Total: ${res.data.pagination?.totalRecords}`);
  } catch (err) {
    assert(false, "Custom Auditor GET /all failed", err.response?.data?.message || err.message);
  }

  // 7.2 POST /create -> 403
  try {
    await axios.post(`${BASE_URL}/asset/create`, { name: "Auditor Laptop", category: "LAPTOP", serialNumber: `AUD-${Date.now()}` }, { headers: { Authorization: `Bearer ${customToken}` } });
    assert(false, "Custom Auditor POST /create should have been blocked");
  } catch (err) {
    assert(err.response?.status === 403, "Custom Auditor POST /create blocked with 403", err.response?.data?.message);
  }

  // 7.3 POST /assign -> 403
  try {
    await axios.post(`${BASE_URL}/asset/assign`, { assetId: createdAssetId, employeeId: empUser._id.toString() }, { headers: { Authorization: `Bearer ${customToken}` } });
    assert(false, "Custom Auditor POST /assign should have been blocked");
  } catch (err) {
    assert(err.response?.status === 403, "Custom Auditor POST /assign blocked with 403", err.response?.data?.message);
  }

  // 7.4 PUT /return -> 403
  try {
    await axios.put(`${BASE_URL}/asset/${createdAssetId}/return`, { conditionOnReturn: "GOOD" }, { headers: { Authorization: `Bearer ${customToken}` } });
    assert(false, "Custom Auditor PUT /return should have been blocked");
  } catch (err) {
    assert(err.response?.status === 403, "Custom Auditor PUT /return blocked with 403", err.response?.data?.message);
  }

  // Cleanup: delete test created asset and custom role
  if (createdAssetId) {
    await Asset.deleteOne({ _id: createdAssetId });
  }
  if (customRoleId) {
    await deleteRole({ params: { id: customRoleId.toString() } }, { status: () => ({ json: () => {} }) });
  }

  console.log("\n==================================================================");
  console.log(`ASSET ROUTER RBAC VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================================");

  await mongoose.disconnect();

  if (failed > 0) {
    process.exit(1);
  }
}

runAssetRouterRBACVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
