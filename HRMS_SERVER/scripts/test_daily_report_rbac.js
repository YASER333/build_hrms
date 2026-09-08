import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../Modules/UserModule.js";
import Role from "../Modules/RoleModules.js";
import Project from "../Modules/ProjectModule.js";
import DailyReport from "../Modules/DailyReportModule.js";
import { seedRBACFoundation } from "../Services/PermissionSeedService.js";

dotenv.config();

function generateTestToken(userDoc, roleDoc) {
  const payload = { sub: userDoc._id.toString() };
  return jwt.sign(payload, process.env.JWT || "your_jwt_secret_key_here", {
    expiresIn: "1h",
    issuer: "hrms",
    audience: "hrms-client"
  });
}

async function runDailyReportTests() {
  try {
    console.log("=========================================");
    console.log("RUNNING DAILY REPORT RBAC & WORKFLOW TESTS");
    console.log("=========================================");

    await mongoose.connect(process.env.MONGO_URI);
    await seedRBACFoundation();

    // 1. Get standard roles
    const ownerRole = await Role.findOne({ roleCode: "OWNER" });
    const pmRole = await Role.findOne({ roleCode: "PROJECT_MANAGER" });
    const empRole = await Role.findOne({ roleCode: "EMPLOYEE" });

    // 2. Create test users: Owner, PM, Employee 1 (Assigned), Employee 2 (Assigned), Employee 3 (Unassigned)
    const hash = await bcrypt.hash("test1234", 10);
    const dob = new Date("1995-01-01");

    const ownerUser = await User.findOneAndUpdate(
      { email: "owner@hrms.com" },
      {
        $setOnInsert: {
          firstName: "System",
          lastName: "Owner",
          email: "owner@hrms.com",
          mobileNo: "9999999999",
          password: hash,
          employeeCode: "OWN001",
          dob,
          gender: "Male",
          marriageStatus: "Married",
          role: ownerRole._id,
          hasLoginAccess: true,
          isActive: true
        }
      },
      { upsert: true, new: true }
    );

    const pmUser = await User.findOneAndUpdate(
      { email: "pm_test@hrms.com" },
      {
        $set: {
          firstName: "Project",
          lastName: "Manager",
          email: "pm_test@hrms.com",
          mobileNo: "8888888881",
          password: hash,
          employeeCode: "PM001",
          dob,
          gender: "Female",
          marriageStatus: "Unmarried",
          role: pmRole._id,
          hasLoginAccess: true,
          isActive: true
        }
      },
      { upsert: true, new: true }
    );

    const emp1User = await User.findOneAndUpdate(
      { email: "emp1_test@hrms.com" },
      {
        $set: {
          firstName: "Employee",
          lastName: "One",
          email: "emp1_test@hrms.com",
          mobileNo: "8888888882",
          password: hash,
          employeeCode: "EMP001",
          dob,
          gender: "Male",
          marriageStatus: "Unmarried",
          role: empRole._id,
          hasLoginAccess: true,
          isActive: true
        }
      },
      { upsert: true, new: true }
    );

    const emp2User = await User.findOneAndUpdate(
      { email: "emp2_test@hrms.com" },
      {
        $set: {
          firstName: "Employee",
          lastName: "Two",
          email: "emp2_test@hrms.com",
          mobileNo: "8888888883",
          password: hash,
          employeeCode: "EMP002",
          dob,
          gender: "Female",
          marriageStatus: "Unmarried",
          role: empRole._id,
          hasLoginAccess: true,
          isActive: true
        }
      },
      { upsert: true, new: true }
    );

    const emp3User = await User.findOneAndUpdate(
      { email: "emp3_unassigned@hrms.com" },
      {
        $set: {
          firstName: "Employee",
          lastName: "Unassigned",
          email: "emp3_unassigned@hrms.com",
          mobileNo: "8888888884",
          password: hash,
          employeeCode: "EMP003",
          dob,
          gender: "Male",
          marriageStatus: "Unmarried",
          role: empRole._id,
          hasLoginAccess: true,
          isActive: true
        }
      },
      { upsert: true, new: true }
    );

    // 3. Create test Project managed by pmUser with emp1User and emp2User assigned
    const testProject = await Project.create({
      projectName: "Test Daily Report Project",
      description: "RBAC Test Project",
      projectManager: pmUser._id,
      softwareDevelopers: [{ userId: emp1User._id }, { userId: emp2User._id }]
    });

    console.log(`Created Test Project: ${testProject.projectName} (ID: ${testProject._id})`);

    // Clean up old reports for test project
    await DailyReport.deleteMany({ projectId: testProject._id });

    // Mock Express Request / Response Helper
    const mockReqRes = (userDoc, roleDoc, body = {}, params = {}, query = {}) => {
      const user = {
        id: userDoc._id.toString(),
        roleId: roleDoc._id.toString(),
        roleCode: roleDoc.roleCode,
        priority: roleDoc.priority
      };
      let resStatus = 200;
      let resData = null;

      const req = { user, body, params, query };
      const res = {
        status: (code) => {
          resStatus = code;
          return res;
        },
        json: (data) => {
          resData = data;
          return res;
        }
      };

      return { req, res, getStatus: () => resStatus, getData: () => resData };
    };

    // Import Controller Handlers
    const {
      submitDailyReport,
      getDailyReportsByProject,
      getDailyReportById,
      addCommentToDailyReport
    } = await import("../Controller/DailyReportController.js");

    // TEST 1: Employee 1 submits daily report WITHOUT title
    console.log("\n--- TEST 1: Submit report without title ---");
    const t1 = mockReqRes(emp1User, empRole, {
      projectId: testProject._id.toString(),
      description: "Completed frontend components without title field"
    });
    await submitDailyReport(t1.req, t1.res);
    console.log(`Status: ${t1.getStatus()}, Success: ${t1.getData()?.success}`);
    console.log(`Title Fallback: "${t1.getData()?.data?.title}" (Expected: "Work Update")`);
    const emp1ReportId = t1.getData()?.data?._id;
    if (t1.getStatus() !== 201 || t1.getData()?.data?.title !== "Work Update") {
      throw new Error("Test 1 Failed!");
    }
    console.log("✅ TEST 1 PASSED!");

    // Employee 2 submits daily report
    console.log("\n--- Employee 2 submits daily report ---");
    const t1b = mockReqRes(emp2User, empRole, {
      projectId: testProject._id.toString(),
      description: "Backend API integration work",
      shift: "FULL_DAY"
    });
    await submitDailyReport(t1b.req, t1b.res);
    console.log(`Status: ${t1b.getStatus()}, Success: ${t1b.getData()?.success}`);
    const emp2ReportId = t1b.getData()?.data?._id;

    // TEST 2: Employee 1 fetches project reports -> should ONLY see own report
    console.log("\n--- TEST 2: Employee 1 fetches project reports ---");
    const t2 = mockReqRes(emp1User, empRole, {}, { projectId: testProject._id.toString() });
    await getDailyReportsByProject(t2.req, t2.res);
    const emp1Reports = t2.getData()?.data || [];
    console.log(`Status: ${t2.getStatus()}, Returned Reports Count: ${emp1Reports.length}`);
    const allEmp1Own = emp1Reports.every(r => (r.submittedBy._id || r.submittedBy).toString() === emp1User._id.toString());
    console.log(`All returned reports belong to Employee 1: ${allEmp1Own}`);
    if (t2.getStatus() !== 200 || emp1Reports.length !== 1 || !allEmp1Own) {
      throw new Error("Test 2 Failed: Employee saw reports of other users!");
    }
    console.log("✅ TEST 2 PASSED!");

    // TEST 3: Employee 1 attempts to fetch Employee 2's report by ID -> expects 403 Forbidden
    console.log("\n--- TEST 3: Employee 1 attempts to fetch Employee 2's report by ID ---");
    const t3 = mockReqRes(emp1User, empRole, {}, { id: emp2ReportId.toString() });
    await getDailyReportById(t3.req, t3.res);
    console.log(`Status: ${t3.getStatus()}, Message: ${t3.getData()?.message}`);
    if (t3.getStatus() !== 403) {
      throw new Error("Test 3 Failed: Employee 1 was not blocked from viewing Employee 2's report!");
    }
    console.log("✅ TEST 3 PASSED!");

    // TEST 4: Project Manager fetches project reports -> sees ALL team reports
    console.log("\n--- TEST 4: PM fetches project reports ---");
    const t4 = mockReqRes(pmUser, pmRole, {}, { projectId: testProject._id.toString() });
    await getDailyReportsByProject(t4.req, t4.res);
    const pmReports = t4.getData()?.data || [];
    console.log(`Status: ${t4.getStatus()}, PM Returned Reports Count: ${pmReports.length}`);
    if (t4.getStatus() !== 200 || pmReports.length !== 2) {
      throw new Error("Test 4 Failed: PM did not receive all team reports!");
    }
    console.log("✅ TEST 4 PASSED!");

    // TEST 5: PM adds a comment to Employee 1's report
    console.log("\n--- TEST 5: PM adds comment to Employee 1's report ---");
    const t5 = mockReqRes(pmUser, pmRole, { commentText: "Great work! Make sure to write unit tests." }, { id: emp1ReportId.toString() });
    await addCommentToDailyReport(t5.req, t5.res);
    console.log(`Status: ${t5.getStatus()}, Comments count: ${t5.getData()?.data?.comments?.length}`);
    if (t5.getStatus() !== 200 || t5.getData()?.data?.comments?.length !== 1) {
      throw new Error("Test 5 Failed: PM comment was not saved!");
    }
    console.log("✅ TEST 5 PASSED!");

    // TEST 6: Employee 1 fetches report by ID -> sees PM's comment
    console.log("\n--- TEST 6: Employee 1 fetches report and sees PM comment ---");
    const t6 = mockReqRes(emp1User, empRole, {}, { id: emp1ReportId.toString() });
    await getDailyReportById(t6.req, t6.res);
    const fetchedReport = t6.getData()?.data;
    console.log(`Status: ${t6.getStatus()}, Comments count: ${fetchedReport?.comments?.length}`);
    console.log(`Comment text: "${fetchedReport?.comments?.[0]?.commentText}"`);
    if (t6.getStatus() !== 200 || fetchedReport?.comments?.[0]?.commentText !== "Great work! Make sure to write unit tests.") {
      throw new Error("Test 6 Failed: Employee could not see PM comment!");
    }
    console.log("✅ TEST 6 PASSED!");

    // TEST 7: Unassigned Employee 3 attempts to access project reports -> 403 Forbidden
    console.log("\n--- TEST 7: Unassigned Employee 3 attempts to access project reports ---");
    const t7 = mockReqRes(emp3User, empRole, {}, { projectId: testProject._id.toString() });
    await getDailyReportsByProject(t7.req, t7.res);
    console.log(`Status: ${t7.getStatus()}, Message: ${t7.getData()?.message}`);
    if (t7.getStatus() !== 403) {
      throw new Error("Test 7 Failed: Unassigned employee was not blocked!");
    }
    console.log("✅ TEST 7 PASSED!");

    // TEST 8: Owner / Admin has full access to reports
    console.log("\n--- TEST 8: Owner fetches project reports ---");
    const t8 = mockReqRes(ownerUser, ownerRole, {}, { projectId: testProject._id.toString() });
    await getDailyReportsByProject(t8.req, t8.res);
    console.log(`Status: ${t8.getStatus()}, Owner Returned Reports Count: ${t8.getData()?.data?.length}`);
    if (t8.getStatus() !== 200 || t8.getData()?.data?.length !== 2) {
      throw new Error("Test 8 Failed: Owner was blocked!");
    }
    console.log("✅ TEST 8 PASSED!");

    // Cleanup test project and reports
    await DailyReport.deleteMany({ projectId: testProject._id });
    await Project.deleteOne({ _id: testProject._id });
    console.log("\nCleaned up test project and test reports.");

    console.log("=========================================");
    console.log("ALL 8 DAILY REPORT RBAC & WORKFLOW TESTS PASSED SUCCESSFULLY!");
    console.log("=========================================");

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ TEST FAILED:", err);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

runDailyReportTests();
