import mongoose from "mongoose";
import bcrypt from "bcrypt";
import Onboarding from "../Modules/OnboardingModule.js";
import User from "../Modules/UserModule.js";
import Role from "../Modules/RoleModules.js";
import Asset from "../Modules/AssetModule.js";
import Address from "../Modules/AddressModule.js";
import Family from "../Modules/FamilyModule.js";
import Education from "../Modules/EducationModule.js";
import Experience from "../Modules/ExperienceModule.js";
import CurrentCompany from "../Modules/CurrentCompanyModule.js";
import { validateOnboarding } from "./OnboardingValidationService.js";
import { logAudit } from "../Utils/AuditLogger.js";
import { canAssignRole, canModifyUserAccount } from "../Utils/RoleAuthority.js";

// Helper to generate next unique Employee Code EMP0001
export const generateNextEmployeeCode = async () => {
  const users = await User.find({ employeeCode: { $regex: /^EMP/i } })
    .select("employeeCode")
    .lean();

  let maxNum = 0;
  for (const u of users) {
    if (u.employeeCode) {
      const numPart = parseInt(u.employeeCode.replace(/\D/g, ""), 10);
      if (!isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
      }
    }
  }

  let nextNum = maxNum + 1;
  let code = `EMP${String(nextNum).padStart(4, "0")}`;

  while (await User.exists({ employeeCode: code })) {
    nextNum++;
    code = `EMP${String(nextNum).padStart(4, "0")}`;
  }

  return code;
};

/**
 * Mask sensitive string data (e.g. Bank Account, Aadhaar, PAN)
 */
export const maskSensitiveString = (str, visibleEndCount = 4) => {
  if (!str || typeof str !== "string") return str;
  if (str.length <= visibleEndCount) return str;
  return "*".repeat(str.length - visibleEndCount) + str.slice(-visibleEndCount);
};


/**
 * Persist background domains (Address, Family, Education, Experience, CurrentCompany)
 */
export const persistEmployeeBackgroundDomains = async (user, body = {}) => {
  if (!user || !user._id) return;
  const userId = user._id;

  // 1. Persist Address(es)
  const rawAddresses = body.addresses || body.address;
  if (rawAddresses) {
    const addrList = Array.isArray(rawAddresses) ? rawAddresses : [rawAddresses];
    const validAddresses = addrList.filter(
      (a) => a && (a.address1 || a.addressLine1 || a.address || a.street || a.city || a.pincode || a.postalCode || a.state)
    );
    if (validAddresses.length > 0) {
      await Address.deleteMany({ userId });
      for (const ad of validAddresses) {
        const line1 = ad.address1 || ad.addressLine1 || ad.address || ad.street || "Address Line 1";
        const line2 = ad.address2 || ad.addressLine2 || "";
        const city = ad.city || "City";
        const state = ad.state || "State";
        const country = ad.country || "India";
        const pincode = String(ad.pincode || ad.postalCode || ad.pinCode || "600001").trim();
        await Address.create({
          userId,
          addressType: ad.addressType || "Permanent",
          address1: line1,
          address2: line2,
          city,
          state,
          country,
          pincode: pincode.length >= 4 ? pincode : "600001",
        });
      }
    }
  }

  // 2. Persist Family Members
  const rawFamily = body.family || body.familyMembers || body.familyContacts;
  if (rawFamily) {
    const famList = Array.isArray(rawFamily) ? rawFamily : [rawFamily];
    const validRelationships = [
      "Father", "Mother", "Spouse", "Son", "Daughter", "Brother", "Sister", "Guardian", "Other"
    ];
    const formattedMembers = famList
      .filter((m) => m && (m.name || m.fullName))
      .map((m) => {
        const matchedRel = validRelationships.find(
          (r) => r.toLowerCase() === String(m.relationship || "").trim().toLowerCase()
        );
        return {
          name: String(m.name || m.fullName).trim(),
          relationship: matchedRel || "Other",
          gender: m.gender ? (["Male", "Female", "Other"].find(g => g.toLowerCase() === String(m.gender).trim().toLowerCase()) || "Other") : undefined,
          occupation: m.occupation ? String(m.occupation).trim() : undefined,
          phone: m.phone ? String(m.phone).trim() : (m.mobileNo || m.mobilePhone || m.emergencyContact || undefined),
          email: m.email ? String(m.email).trim().toLowerCase() : undefined,
          isEmergencyContact: m.isEmergencyContact !== undefined ? Boolean(m.isEmergencyContact) : Boolean(m.emergencyContact),
          emergencyContactPriority: m.emergencyContactPriority ? Number(m.emergencyContactPriority) : undefined,
          address: m.address ? String(m.address).trim() : undefined,
        };
      });

    if (formattedMembers.length > 0) {
      await Family.findOneAndUpdate(
        { userId },
        {
          $set: {
            userId,
            familyMembers: formattedMembers,
          },
        },
        { upsert: true, new: true }
      );
    }
  }

  // 3. Persist Education
  const rawEdu = body.education || body.educationDetails;
  if (rawEdu) {
    let eduUpdate = {};
    if (Array.isArray(rawEdu)) {
      rawEdu.forEach((ed) => {
        const deg = String(ed.degree || "").toUpperCase();
        if (deg.includes("SSLC") || deg.includes("10")) {
          eduUpdate.sslcSchoolName = ed.university || ed.schoolName || ed.institution || "SSLC School";
          eduUpdate.sslcBoard = ed.stream || ed.board || "State Board";
          eduUpdate.sslcYearOfPassing = Number(ed.yearOfPassing || ed.year || 2016);
          eduUpdate.sslcPercentage = Math.min(100, Math.max(0, Number(String(ed.percentage || 75).replace(/[^0-9.]/g, ""))));
          if (ed.documentUrl || ed.certificateUrl) eduUpdate.sslcDocumentUrl = ed.documentUrl || ed.certificateUrl;
        } else if (deg.includes("HSC") || deg.includes("12") || deg.includes("INTER")) {
          eduUpdate.hscSchoolName = ed.university || ed.schoolName || ed.institution || "HSC School";
          eduUpdate.hscBoard = ed.stream || ed.board || "State Board";
          eduUpdate.hscYearOfPassing = Number(ed.yearOfPassing || ed.year || 2018);
          eduUpdate.hscPercentage = Math.min(100, Math.max(0, Number(String(ed.percentage || 80).replace(/[^0-9.]/g, ""))));
          if (ed.documentUrl || ed.certificateUrl) eduUpdate.hscDocumentUrl = ed.documentUrl || ed.certificateUrl;
        } else if (deg.includes("ITI")) {
          eduUpdate.itiinstituteName = ed.university || ed.institution || "ITI Institute";
          eduUpdate.iticourse = ed.stream || ed.course || "Technical";
          eduUpdate.itiyearOfPassing = Number(ed.yearOfPassing || ed.year || 2020);
          eduUpdate.itipercentage = Math.min(100, Math.max(0, Number(String(ed.percentage || 75).replace(/[^0-9.]/g, ""))));
          if (ed.documentUrl || ed.certificateUrl) eduUpdate.itiDocumentUrl = ed.documentUrl || ed.certificateUrl;
        } else if (deg.includes("DIPLOMA")) {
          eduUpdate.diplomainstitution = ed.university || ed.institution || "Diploma Polytechnic";
          eduUpdate.diplomacourse = ed.stream || ed.course || "General";
          eduUpdate.diplomayearOfPassing = Number(ed.yearOfPassing || ed.year || 2020);
          eduUpdate.diplomapercentage = Math.min(100, Math.max(0, Number(String(ed.percentage || 75).replace(/[^0-9.]/g, ""))));
          if (ed.documentUrl || ed.certificateUrl) eduUpdate.diplomaDocumentUrl = ed.documentUrl || ed.certificateUrl;
        } else if (deg.includes("PG") || deg.includes("MASTER") || deg.includes("M.TECH") || deg.includes("M.SC") || deg.includes("MBA") || deg.includes("MCA")) {
          eduUpdate.pgInstituteName = ed.university || ed.institution || "PG College";
          eduUpdate.pgUniversityName = ed.university || ed.institution || "PG University";
          eduUpdate.pgDegree = ed.degree || "PG";
          eduUpdate.pgDepartmentCourse = ed.stream || ed.course || "General";
          eduUpdate.pgYearOfPassing = Number(ed.yearOfPassing || ed.year || 2024);
          const val = Number(String(ed.percentage || ed.cgpa || 8).replace(/[^0-9.]/g, ""));
          eduUpdate.pgCgpa = val > 10 ? Math.round(val / 10) : val;
          if (ed.documentUrl || ed.certificateUrl) eduUpdate.pgDocumentUrl = ed.documentUrl || ed.certificateUrl;
        } else if (deg.includes("PHD") || deg.includes("DOCTORATE")) {
          eduUpdate.phdInstituteName = ed.university || ed.institution || "Research Institute";
          eduUpdate.phdUniversityName = ed.university || ed.institution || "Research University";
          eduUpdate.phdResearchArea = ed.stream || ed.course || "Research";
          eduUpdate.phdYearOfPassing = Number(ed.yearOfPassing || ed.year || 2026);
          if (ed.documentUrl || ed.certificateUrl) eduUpdate.phdDocumentUrl = ed.documentUrl || ed.certificateUrl;
        } else {
          // Default / UG
          eduUpdate.ugInstituteName = ed.university || ed.institution || "UG College";
          eduUpdate.ugUniversityName = ed.university || ed.institution || "UG University";
          eduUpdate.ugDegree = ed.degree || "UG";
          eduUpdate.ugDepartmentCourse = ed.stream || ed.course || "General";
          eduUpdate.ugYearOfPassing = Number(ed.yearOfPassing || ed.year || 2022);
          const val = Number(String(ed.percentage || ed.cgpa || 8).replace(/[^0-9.]/g, ""));
          eduUpdate.ugCgpa = val > 10 ? Math.round(val / 10) : val;
          if (ed.documentUrl || ed.certificateUrl) eduUpdate.ugDocumentUrl = ed.documentUrl || ed.certificateUrl;
        }
      });
      if (Object.keys(eduUpdate).length > 0) {
        if (!eduUpdate.sslcSchoolName) {
          eduUpdate.sslcSchoolName = "Secondary School";
          eduUpdate.sslcBoard = "State Board";
          eduUpdate.sslcYearOfPassing = 2016;
          eduUpdate.sslcPercentage = 75;
        }
        if (!eduUpdate.hscSchoolName) {
          eduUpdate.hscSchoolName = "Higher Secondary School";
          eduUpdate.hscBoard = "State Board";
          eduUpdate.hscYearOfPassing = 2018;
          eduUpdate.hscPercentage = 80;
        }
        if (!eduUpdate.ugInstituteName) {
          eduUpdate.ugInstituteName = "University College";
          eduUpdate.ugUniversityName = "State University";
          eduUpdate.ugDegree = "UG Degree";
          eduUpdate.ugDepartmentCourse = "Engineering / Science";
          eduUpdate.ugYearOfPassing = 2022;
          eduUpdate.ugCgpa = 8.0;
        }
      }
    } else if (typeof rawEdu === "object") {
      eduUpdate = { ...rawEdu };
    }

    if (Object.keys(eduUpdate).length > 0) {
      await Education.findOneAndUpdate(
        { userId },
        {
          userId,
          ...eduUpdate,
        },
        { upsert: true, new: true }
      );
    }
  }

  // 4. Persist Past Work Experiences
  const rawExp = body.experience || body.experienceDetails;
  if (rawExp) {
    const expList = Array.isArray(rawExp) ? rawExp : [rawExp];
    const validExp = expList.filter(
      (e) => e && (e.companyName || e.prevCompany || e.designation || e.role || e.experience || e.experienceYears)
    );
    if (validExp.length > 0) {
      await Experience.deleteMany({ userId });
      for (const exp of validExp) {
        const compName = exp.companyName || exp.prevCompany || "Previous Company";
        const desig = exp.designation || exp.role || "Employee";
        const expLetter = exp.experienceLetter || exp.experienceLetterUrl || "";
        const paySlip = exp.payslip || exp.payslipUrl || "";
        const relLetter = exp.relievingLetter || exp.relievingLetterUrl || "";
        await Experience.create({
          userId,
          companyName: compName,
          designation: desig,
          description: exp.description || exp.roleDescription || "Previous Work Experience",
          startDate: exp.startDate || "2020",
          endDate: exp.endDate || "",
          isCurrentJob: exp.isCurrentJob === true || exp.isCurrentJob === "true",
          noticePeriod: exp.noticePeriod || "",
          expectedLastWorkingDate: exp.expectedLastWorkingDate ? new Date(exp.expectedLastWorkingDate) : null,
          employmentStatus: exp.employmentStatus || (exp.isCurrentJob === true || exp.isCurrentJob === "true" ? "CURRENTLY_EMPLOYED" : "RELIEVED"),
          experience: exp.experience || exp.experienceYears || "1 year",
          experienceLetter: expLetter,
          experienceLetterUrl: expLetter,
          payslip: paySlip,
          payslipUrl: paySlip,
          relievingLetter: relLetter,
          relievingLetterUrl: relLetter,
          documentUrl: exp.documentUrl || "",
          documentType: exp.documentType || "",
          documents: exp.documents || [],
        });
      }
    }
  }

  // 5. Persist Current Company / Professional Record
  const rawProf = body.professional || body.currentCompany;
  const isFresherCandidate = body.isFresher === true || body.isFresher === "true" || (Array.isArray(rawProf) && rawProf[0]?.isFresher);
  if (rawProf || isFresherCandidate) {
    const profList = Array.isArray(rawProf) ? rawProf : (rawProf ? [rawProf] : []);
    const compObj = profList[0] || {};
    const website = compObj.companyWebsite || compObj.website || compObj.linkedin || "";
    await CurrentCompany.findOneAndUpdate(
      { userId },
      {
        userId,
        companyName: isFresherCandidate ? "" : (compObj.companyName || user.department || "Current Company"),
        companyWebsite: isFresherCandidate ? "" : website,
        department: isFresherCandidate ? (user.department || "General") : (compObj.department || user.department || "General"),
        designation: isFresherCandidate ? (user.designation || "Fresher") : (compObj.designation || user.designation || "Employee"),
        role: isFresherCandidate ? (user.designation || "Fresher") : (compObj.role || compObj.designation || "Employee"),
        salary: isFresherCandidate ? "0" : String(compObj.salary || "0"),
        joiningDate: compObj.joiningDate ? new Date(compObj.joiningDate) : (user.joiningDate || new Date()),
        reportedTo: compObj.reportedTo && mongoose.Types.ObjectId.isValid(compObj.reportedTo)
          ? compObj.reportedTo
          : (user.reportingManager || user.tlCode || null),
        noticePeriod: isFresherCandidate ? "" : (compObj.noticePeriod || ""),
        expectedLastWorkingDate: isFresherCandidate ? null : (compObj.expectedLastWorkingDate ? new Date(compObj.expectedLastWorkingDate) : null),
        employmentStatus: isFresherCandidate ? "NOT_APPLICABLE" : (compObj.employmentStatus || "CURRENTLY_EMPLOYED"),
        isFresher: Boolean(isFresherCandidate),
        experienceLetterUrl: isFresherCandidate ? "" : (compObj.experienceLetterUrl || compObj.experienceLetter || ""),
        payslipUrl: isFresherCandidate ? "" : (compObj.payslipUrl || compObj.payslip || ""),
        relievingLetterUrl: isFresherCandidate ? "" : (compObj.relievingLetterUrl || compObj.relievingLetter || ""),
      },
      { upsert: true, new: true }
    );
  }
};

// =========================================================================
// 1. INITIATE ONBOARDING
// =========================================================================
export const initiateOnboardingService = async ({ req, body }) => {
  const {
    firstName,
    middleName,
    lastName,
    employeeCode,
    email,
    password,
    dob,
    gender,
    marriageStatus,
    mobileNo,
    roleId,
    department,
    designation,
    reportingManager,
    joiningDate,
    employmentType,
    noticePeriodDays,
    bankDetails,
    statutoryDetails,
    emergencyContact,
    tasks,
    provisionedAccess,
    agreements,
    orientations,
  } = body;

  if (!firstName || !lastName || !email || !mobileNo || !dob || !gender || !marriageStatus) {
    throw {
      statusCode: 400,
      message: "First name, last name, email, mobile number, DOB, gender, and marital status are required.",
    };
  }

  const normalizedEmail = email.toLowerCase().trim();
  const normalizedMobile = mobileNo.trim();

  // Validate duplicate user
  const existingUser = await User.findOne({
    $or: [{ email: normalizedEmail }, { mobileNo: normalizedMobile }],
  });

  if (existingUser) {
    throw {
      statusCode: 409,
      message: "An employee with this email or mobile number already exists in the system.",
    };
  }

  // Validate Role & Role Authority
  let roleDoc = null;
  if (roleId) {
    roleDoc = await Role.findById(roleId);
    if (!roleDoc) {
      throw { statusCode: 404, message: "Specified Role ID not found." };
    }
    if (req.user && !canAssignRole(req.user, roleDoc)) {
      throw {
        statusCode: 403,
        message: `Forbidden: You do not have authority to assign role '${roleDoc.roleName}'.`,
      };
    }
  } else {
    roleDoc = await Role.findOne({ roleCode: "EMPLOYEE" });
  }

  // Validate Reporting Manager if supplied
  if (reportingManager) {
    const managerDoc = await User.findById(reportingManager);
    if (!managerDoc) {
      throw { statusCode: 404, message: "Specified Reporting Manager not found." };
    }
  }

  let empCode = employeeCode ? employeeCode.trim().toUpperCase() : null;
  if (empCode) {
    const codeExists = await User.exists({ employeeCode: empCode });
    if (codeExists) {
      throw {
        statusCode: 409,
        message: `Employee code '${empCode}' is already assigned to another user.`,
      };
    }
  } else {
    empCode = await generateNextEmployeeCode();
  }

  const rawPassword = password || "Welcome@123";
  const hashedPassword = await bcrypt.hash(rawPassword, 10);

  // 1. Create User in ONBOARDING lifecycle status with hasLoginAccess = false
  const newUser = await User.create({
    firstName: firstName.trim(),
    middleName: middleName ? middleName.trim() : null,
    lastName: lastName.trim(),
    email: normalizedEmail,
    password: hashedPassword,
    dob: new Date(dob),
    gender,
    marriageStatus,
    mobileNo: normalizedMobile,
    employeeCode: empCode,
    role: roleDoc ? roleDoc._id : null,
    reportingManager: reportingManager || null,
    tlCode: reportingManager || null,
    department: department ? department.trim() : "General",
    designation: designation ? designation.trim() : "Employee",
    joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
    employmentType: employmentType || "FULL_TIME",
    noticePeriodDays: noticePeriodDays !== undefined ? noticePeriodDays : 60,
    lifecycleStatus: "ONBOARDING",
    hasLoginAccess: false,
    bankDetails: bankDetails ? {
      bankName: bankDetails.bankName || "",
      accountNumber: bankDetails.accountNumber || bankDetails.accountNo || "",
      ifscCode: bankDetails.ifscCode || bankDetails.ifsc || "",
      ifsc: bankDetails.ifsc || bankDetails.ifscCode || "",
      branchName: bankDetails.branchName || "",
    } : {},
    statutoryDetails: statutoryDetails || {},
    emergencyContact: emergencyContact || {},
  });

  // 2. Default standard onboarding tasks
  const defaultTasks = [
    {
      taskName: "Verify Government Identity Proofs (PAN/Aadhaar)",
      description: "Review and verify government ID uploads",
      responsibleGroup: "HR",
      category: "DOCUMENT_VERIFICATION",
      priority: "HIGH",
      status: "PENDING",
      isCompleted: false,
      isMandatory: true,
    },
    {
      taskName: "Collect & Verify Signed Employment Contract & Offer Letter",
      description: "Verify offer letter and contract acknowledgements",
      responsibleGroup: "HR",
      category: "DOCUMENT_VERIFICATION",
      priority: "HIGH",
      status: "PENDING",
      isCompleted: false,
      isMandatory: true,
    },
    {
      taskName: "Create Corporate Email & Communication Accounts",
      description: "Setup official email, Slack, and collaboration tools",
      responsibleGroup: "IT",
      category: "IT_PROVISIONING",
      priority: "HIGH",
      status: "PENDING",
      isCompleted: false,
      isMandatory: true,
    },
    {
      taskName: "Issue Laptop & IT Accessories",
      description: "Allocate workstation / laptop from inventory",
      responsibleGroup: "IT",
      category: "ASSET_ALLOCATION",
      priority: "MEDIUM",
      status: "PENDING",
      isCompleted: false,
      isMandatory: false,
    },
    {
      taskName: "Conduct Induction & Manager Introduction",
      description: "Complete team and department orientation sessions",
      responsibleGroup: "MANAGER",
      category: "TRAINING",
      priority: "MEDIUM",
      status: "PENDING",
      isCompleted: false,
      isMandatory: true,
    },
  ];

  // 3. Default standard system access items
  const defaultAccess = [
    {
      systemName: "Corporate Email",
      accessType: "STANDARD",
      status: "REQUESTED",
      isProvisioned: false,
      isMandatory: true,
    },
    {
      systemName: "HRMS Portal",
      accessType: "EMPLOYEE_SELF_SERVICE",
      status: "REQUESTED",
      isProvisioned: false,
      isMandatory: true,
    },
    {
      systemName: "Code Repository / Tooling",
      accessType: "DEVELOPER",
      status: "REQUESTED",
      isProvisioned: false,
      isMandatory: false,
    },
    {
      systemName: "Slack / Collaboration",
      accessType: "STANDARD",
      status: "REQUESTED",
      isProvisioned: false,
      isMandatory: true,
    },
  ];

  // 4. Default standard agreements & policies
  const defaultAgreements = [
    {
      agreementType: "OFFER_LETTER",
      title: "Formal Offer Letter",
      isRequired: true,
      status: "PENDING",
      isAcknowledged: false,
    },
    {
      agreementType: "EMPLOYMENT_AGREEMENT",
      title: "Employment Agreement & Terms",
      isRequired: true,
      status: "PENDING",
      isAcknowledged: false,
    },
    {
      agreementType: "NDA",
      title: "Non-Disclosure & Confidentiality Agreement",
      isRequired: true,
      status: "PENDING",
      isAcknowledged: false,
    },
    {
      agreementType: "COMPANY_POLICIES",
      title: "Employee Handbook & IT Code of Conduct",
      isRequired: true,
      status: "PENDING",
      isAcknowledged: false,
    },
  ];

  // 5. Default standard orientations / trainings
  const defaultOrientations = [
    {
      trainingName: "Company Orientation & Welcome",
      description: "Overview of company history, values, and mission",
      trainer: "HR Team",
      mandatory: true,
      status: "NOT_STARTED",
    },
    {
      trainingName: "HR Policies & Code of Conduct",
      description: "Review of workplace policies, leave rules, and ethics",
      trainer: "HR Team",
      mandatory: true,
      status: "NOT_STARTED",
    },
    {
      trainingName: "IT Security & Data Protection Awareness",
      description: "Information security protocols and credential hygiene",
      trainer: "IT Security Lead",
      mandatory: true,
      status: "NOT_STARTED",
    },
  ];

  const hasBankData = Boolean(bankDetails?.accountNumber);
  const hasStatutoryData = Boolean(statutoryDetails?.panNo && statutoryDetails?.aadhaarNo);

  const onboardingRecord = await Onboarding.create({
    employeeId: newUser._id,
    status: "ONBOARDING",
    startDate: new Date(),
    targetJoiningDate: joiningDate ? new Date(joiningDate) : new Date(),
    tasks: tasks && Array.isArray(tasks) && tasks.length > 0 ? tasks : defaultTasks,
    provisionedAccess:
      provisionedAccess && Array.isArray(provisionedAccess) && provisionedAccess.length > 0
        ? provisionedAccess
        : defaultAccess,
    agreements:
      agreements && Array.isArray(agreements) && agreements.length > 0 ? agreements : defaultAgreements,
    orientations:
      orientations && Array.isArray(orientations) && orientations.length > 0
        ? orientations
        : defaultOrientations,
    payrollReadiness: {
      isBankProvided: hasBankData,
      isStatutoryProvided: hasStatutoryData,
      isEligibleForPayroll: hasBankData && hasStatutoryData,
      payrollSetupStatus: hasBankData && hasStatutoryData ? "READY" : "PENDING",
    },
    createdBy: req.user ? req.user.id : newUser._id,
  });

  await persistEmployeeBackgroundDomains(newUser, body);

  await logAudit({
    req,
    action: "ONBOARDING_CREATED",
    module: "ONBOARDING",
    resourceId: onboardingRecord._id.toString(),
    newState: { user: newUser.toObject(), onboarding: onboardingRecord.toObject() },
    details: `Initiated onboarding for ${newUser.employeeCode} (${newUser.email})`,
  });

  return { user: newUser, onboarding: onboardingRecord };
};

// =========================================================================
// 2. GET ONBOARDING DETAILS (BY ID OR EMPLOYEE ID)
// =========================================================================
export const getOnboardingDetailsService = async (idOrEmployeeId) => {
  let query = {};
  if (mongoose.Types.ObjectId.isValid(idOrEmployeeId)) {
    query = {
      $or: [{ _id: idOrEmployeeId }, { employeeId: idOrEmployeeId }],
    };
  } else {
    throw { statusCode: 400, message: "Invalid ID format" };
  }

  const onboarding = await Onboarding.findOne(query)
    .populate({
      path: "employeeId",
      populate: [
        { path: "role", select: "roleName roleCode priority" },
        { path: "reportingManager", select: "firstName lastName email employeeCode designation" },
      ],
    })
    .populate("assignedAssets")
    .populate("tasks.assignedTo", "firstName lastName email employeeCode")
    .populate("tasks.completedBy", "firstName lastName email employeeCode")
    .populate("agreements.acknowledgedBy", "firstName lastName email employeeCode")
    .populate("provisionedAccess.provisionedBy", "firstName lastName email employeeCode")
    .populate("createdBy", "firstName lastName email employeeCode");

  if (!onboarding) {
    throw { statusCode: 404, message: "Onboarding record not found" };
  }

    const onboardingObj = onboarding.toObject();
  const userId = onboarding.employeeId?._id || onboarding.employeeId;

  if (userId) {
    let userQuery = { userId };
    if (mongoose.Types.ObjectId.isValid(userId)) {
      const objId = new mongoose.Types.ObjectId(userId);
      userQuery = {
        $or: [{ userId }, { userId: objId }],
      };
    }

    const [currentCompanyDoc, educationDoc, experienceDocs, addressDocs, familyDoc] = await Promise.all([
      CurrentCompany.findOne(userQuery).lean().catch(() => null),
      Education.findOne(userQuery).lean().catch(() => null),
      Experience.find(userQuery).sort({ createdAt: -1 }).lean().catch(() => []),
      Address.find(userQuery).sort({ createdAt: -1 }).lean().catch(() => []),
      Family.findOne(userQuery).lean().catch(() => null),
    ]);

    onboardingObj.profileDetails = {
      currentCompany: currentCompanyDoc,
      professional: currentCompanyDoc ? [currentCompanyDoc] : [],
      education: educationDoc,
      experience: experienceDocs || [],
      addresses: addressDocs || [],
      family: familyDoc,
    };
  }

  return onboardingObj;
};

// =========================================================================
// 3. UPDATE EMPLOYEE INFO
// =========================================================================
export const updateEmployeeInfoService = async ({ req, onboardingId, body }) => {
  const onboarding = await Onboarding.findById(onboardingId);
  if (!onboarding) {
    throw { statusCode: 404, message: "Onboarding record not found" };
  }

  const user = await User.findById(onboarding.employeeId);
  if (!user) {
    throw { statusCode: 404, message: "Associated employee not found" };
  }

  const {
    firstName,
    middleName,
    lastName,
    dob,
    gender,
    marriageStatus,
    bloodGroup,
    mobileNo,
    emergencyContact,
    address,
    familyMembers,
    education,
    experience,
  } = body;

  const previousState = user.toObject();

  if (firstName) user.firstName = firstName.trim();
  if (middleName !== undefined) user.middleName = middleName ? middleName.trim() : null;
  if (lastName) user.lastName = lastName.trim();
  if (dob) user.dob = new Date(dob);
  if (gender) user.gender = gender;
  if (marriageStatus) user.marriageStatus = marriageStatus;
  if (bloodGroup) user.bloodGroup = bloodGroup;
  if (mobileNo) user.mobileNo = mobileNo.trim();
  if (body.department) user.department = String(body.department).trim();
  if (body.designation) user.designation = String(body.designation).trim();
  if (body.joiningDate) user.joiningDate = new Date(body.joiningDate);
  if (body.reportingManager !== undefined) user.reportingManager = body.reportingManager || null;
  if (body.employmentType) user.employmentType = body.employmentType;
  if (body.noticePeriodDays !== undefined) user.noticePeriodDays = Number(body.noticePeriodDays);
  if (body.bankDetails) {
    user.bankDetails = {
      bankName: body.bankDetails.bankName || user.bankDetails?.bankName || "",
      accountNumber: body.bankDetails.accountNumber || body.bankDetails.accountNo || user.bankDetails?.accountNumber || "",
      ifscCode: body.bankDetails.ifscCode || body.bankDetails.ifsc || user.bankDetails?.ifscCode || "",
      ifsc: body.bankDetails.ifsc || body.bankDetails.ifscCode || user.bankDetails?.ifsc || "",
      branchName: body.bankDetails.branchName || user.bankDetails?.branchName || "",
    };
  }
  if (body.statutoryDetails) {
    user.statutoryDetails = {
      panNo: body.statutoryDetails.panNo || user.statutoryDetails?.panNo || "",
      aadhaarNo: body.statutoryDetails.aadhaarNo || user.statutoryDetails?.aadhaarNo || "",
      pfUan: body.statutoryDetails.uanNo || body.statutoryDetails.pfUan || user.statutoryDetails?.pfUan || "",
      esiNo: body.statutoryDetails.esiNo || user.statutoryDetails?.esiNo || "",
    };
  }
  if (emergencyContact) {
    user.emergencyContact = {
      name: emergencyContact.name || user.emergencyContact?.name || "",
      relationship: emergencyContact.relationship || user.emergencyContact?.relationship || "",
      phone: emergencyContact.phone || user.emergencyContact?.phone || "",
    };
  }

  if (body.avatarUrl || body.profilePic || body.profilePicUrl || body.profileImage) {
    const pic = body.avatarUrl || body.profilePic || body.profilePicUrl || body.profileImage;
    user.avatarUrl = pic;
    user.profilePic = pic;
    user.profilePicUrl = pic;
    user.profileImage = pic;
  }

  await user.save();

  // Optionally persist Address entity
  if (address && (address.address1 || address.city || address.postalCode)) {
    await Address.findOneAndUpdate(
      { userId: user._id },
      {
        userId: user._id,
        address1: address.address1 || "N/A",
        address2: address.address2 || "",
        city: address.city || "City",
        state: address.state || "State",
        country: address.country || "India",
        postalCode: address.postalCode || "000000",
      },
      { upsert: true, new: true }
    );
  }

  // Optionally persist Family members
  if (Array.isArray(familyMembers) && familyMembers.length > 0) {
    const validRelationships = [
      "Father",
      "Mother",
      "Spouse",
      "Son",
      "Daughter",
      "Brother",
      "Sister",
      "Guardian",
      "Other",
    ];

    const formattedMembers = familyMembers
      .filter((m) => m && m.name && m.relationship)
      .map((m) => {
        const matchedRel = validRelationships.find(
          (r) => r.toLowerCase() === String(m.relationship).trim().toLowerCase()
        );
        return {
          name: String(m.name).trim(),
          relationship: matchedRel || "Other",
          gender: m.gender ? (["Male", "Female", "Other"].find(g => g.toLowerCase() === String(m.gender).trim().toLowerCase()) || "Other") : undefined,
          occupation: m.occupation ? String(m.occupation).trim() : undefined,
          phone: m.phone ? String(m.phone).trim() : (m.emergencyContact ? String(m.emergencyContact).trim() : undefined),
          email: m.email ? String(m.email).trim().toLowerCase() : undefined,
          isEmergencyContact: m.isEmergencyContact !== undefined ? Boolean(m.isEmergencyContact) : (Boolean(m.emergencyContact)),
          emergencyContactPriority: m.emergencyContactPriority ? Number(m.emergencyContactPriority) : undefined,
          address: m.address ? String(m.address).trim() : undefined,
        };
      });

    if (formattedMembers.length > 0) {
      await Family.findOneAndUpdate(
        { userId: user._id },
        {
          $set: {
            userId: user._id,
            familyMembers: formattedMembers,
          },
        },
        { upsert: true, new: true }
      );
    }
  }

  // Optionally persist Education
  if (education && (education.ugDegree || education.sslcSchoolName)) {
    await Education.findOneAndUpdate(
      { userId: user._id },
      {
        userId: user._id,
        ...education,
      },
      { upsert: true, new: true }
    );
  }

  // Optionally persist Experience
  if (Array.isArray(experience) && experience.length > 0) {
    for (const exp of experience) {
      if (exp.companyName && exp.designation) {
        const expLetter = exp.experienceLetter || exp.experienceLetterUrl || "";
        const paySlip = exp.payslip || exp.payslipUrl || "";
        const relLetter = exp.relievingLetter || exp.relievingLetterUrl || "";
        await Experience.create({
          userId: user._id,
          companyName: exp.companyName,
          designation: exp.designation,
          description: exp.description || "Previous work",
          startDate: exp.startDate || "2020",
          endDate: exp.endDate || "",
          isCurrentJob: exp.isCurrentJob === true || exp.isCurrentJob === "true",
          noticePeriod: exp.noticePeriod || "",
          expectedLastWorkingDate: exp.expectedLastWorkingDate ? new Date(exp.expectedLastWorkingDate) : null,
          employmentStatus: exp.employmentStatus || (exp.isCurrentJob === true || exp.isCurrentJob === "true" ? "CURRENTLY_EMPLOYED" : "RELIEVED"),
          experience: exp.experience || "1 year",
          experienceLetter: expLetter,
          experienceLetterUrl: expLetter,
          payslip: paySlip,
          payslipUrl: paySlip,
          relievingLetter: relLetter,
          relievingLetterUrl: relLetter,
          documentUrl: exp.documentUrl || "",
          documentType: exp.documentType || "",
          documents: exp.documents || [],
        });
      }
    }
  }

  // Optionally persist Current Company / Professional details
  const comp = body.currentCompany || (Array.isArray(body.professional) && body.professional[0]) || body.professional;
  const isFresherCandidate = comp?.isFresher === true || comp?.isFresher === "true" || body.isFresher === true || body.isFresher === "true";

  if (comp || isFresherCandidate) {
    const compObj = comp || {};
    const website = compObj.companyWebsite || compObj.website || "";
    await CurrentCompany.findOneAndUpdate(
      { userId: user._id },
      {
        userId: user._id,
        companyName: isFresherCandidate ? "" : (compObj.companyName || ""),
        companyWebsite: isFresherCandidate ? "" : website,
        department: isFresherCandidate ? (user.department || "General") : (compObj.department || user.department || "General"),
        designation: isFresherCandidate ? (user.designation || "Fresher") : (compObj.designation || user.designation || "Employee"),
        role: isFresherCandidate ? (user.designation || "Fresher") : (compObj.role || "Employee"),
        salary: isFresherCandidate ? (compObj.salary || "0") : (compObj.salary || "0"),
        joiningDate: compObj.joiningDate ? new Date(compObj.joiningDate) : (user.joiningDate || new Date()),
        reportedTo: compObj.reportedTo && mongoose.Types.ObjectId.isValid(compObj.reportedTo)
          ? compObj.reportedTo
          : (user.reportingManager || user.tlCode || null),
        noticePeriod: isFresherCandidate ? "" : (compObj.noticePeriod || ""),
        expectedLastWorkingDate: isFresherCandidate ? null : (compObj.expectedLastWorkingDate ? new Date(compObj.expectedLastWorkingDate) : null),
        employmentStatus: isFresherCandidate ? "NOT_APPLICABLE" : (compObj.employmentStatus || "CURRENTLY_EMPLOYED"),
        isFresher: isFresherCandidate,
        experienceLetterUrl: isFresherCandidate ? "" : (compObj.experienceLetterUrl || compObj.experienceLetter || ""),
        payslipUrl: isFresherCandidate ? "" : (compObj.payslipUrl || compObj.payslip || ""),
        relievingLetterUrl: isFresherCandidate ? "" : (compObj.relievingLetterUrl || compObj.relievingLetter || ""),
      },
      { upsert: true, new: true }
    );
  }

  if (onboarding.status === "ONBOARDING" || onboarding.status === "PENDING") {
    onboarding.status = "IN_PROGRESS";
    await onboarding.save();
  }

  await logAudit({
    req,
    action: "EMPLOYEE_INFO_UPDATED",
    module: "ONBOARDING",
    resourceId: onboarding._id.toString(),
    previousState,
    newState: user.toObject(),
    details: `Updated personal information for employee ${user.employeeCode}`,
  });

  return { user, onboarding };
};

// =========================================================================
// 4. UPDATE EMPLOYMENT DETAILS
// =========================================================================
export const updateEmploymentService = async ({ req, onboardingId, body }) => {
  const onboarding = await Onboarding.findById(onboardingId);
  if (!onboarding) {
    throw { statusCode: 404, message: "Onboarding record not found" };
  }

  const user = await User.findById(onboarding.employeeId);
  if (!user) {
    throw { statusCode: 404, message: "Associated employee not found" };
  }

  const {
    department,
    designation,
    roleId,
    reportingManager,
    joiningDate,
    employmentType,
    noticePeriodDays,
  } = body;

  const previousState = user.toObject();

  if (department) user.department = department.trim();
  if (designation) user.designation = designation.trim();
  if (joiningDate) {
    user.joiningDate = new Date(joiningDate);
    onboarding.targetJoiningDate = new Date(joiningDate);
  }
  if (employmentType) user.employmentType = employmentType;
  if (noticePeriodDays !== undefined) user.noticePeriodDays = Number(noticePeriodDays);

  if (reportingManager) {
    const managerDoc = await User.findById(reportingManager);
    if (!managerDoc) {
      throw { statusCode: 404, message: "Specified Reporting Manager not found" };
    }
    user.reportingManager = managerDoc._id;
    user.tlCode = managerDoc._id;
  }

  if (roleId) {
    const roleDoc = await Role.findById(roleId);
    if (!roleDoc) {
      throw { statusCode: 404, message: "Specified Role not found" };
    }
    if (req.user && !canAssignRole(req.user, roleDoc)) {
      throw {
        statusCode: 403,
        message: `Forbidden: You do not have authority to assign role '${roleDoc.roleName}'.`,
      };
    }
    user.role = roleDoc._id;
  }

  await user.save();

  if (onboarding.status === "ONBOARDING" || onboarding.status === "PENDING") {
    onboarding.status = "IN_PROGRESS";
  }
  await onboarding.save();

  await logAudit({
    req,
    action: "EMPLOYMENT_UPDATED",
    module: "ONBOARDING",
    resourceId: onboarding._id.toString(),
    previousState,
    newState: user.toObject(),
    details: `Updated employment parameters for employee ${user.employeeCode}`,
  });

  return { user, onboarding };
};

// =========================================================================
// 5. UPDATE PAYROLL & STATUTORY DETAILS
// =========================================================================
export const updatePayrollDetailsService = async ({ req, onboardingId, body }) => {
  const onboarding = await Onboarding.findById(onboardingId);
  if (!onboarding) {
    throw { statusCode: 404, message: "Onboarding record not found" };
  }

  const user = await User.findById(onboarding.employeeId);
  if (!user) {
    throw { statusCode: 404, message: "Associated employee not found" };
  }

  const { bankDetails, statutoryDetails } = body;

  if (bankDetails) {
    user.bankDetails = {
      accountNumber: bankDetails.accountNumber || user.bankDetails?.accountNumber || "",
      ifscCode: bankDetails.ifscCode ? bankDetails.ifscCode.toUpperCase() : user.bankDetails?.ifscCode || "",
      bankName: bankDetails.bankName || user.bankDetails?.bankName || "",
      branchName: bankDetails.branchName || user.bankDetails?.branchName || "",
    };
  }

  if (statutoryDetails) {
    user.statutoryDetails = {
      panNo: statutoryDetails.panNo ? statutoryDetails.panNo.toUpperCase() : user.statutoryDetails?.panNo || "",
      aadhaarNo: statutoryDetails.aadhaarNo || user.statutoryDetails?.aadhaarNo || "",
      pfUan: statutoryDetails.pfUan || user.statutoryDetails?.pfUan || "",
      esiNo: statutoryDetails.esiNo || user.statutoryDetails?.esiNo || "",
    };
  }

  await user.save();

  const isBankProvided = Boolean(user.bankDetails?.accountNumber && user.bankDetails?.ifscCode);
  const isStatutoryProvided = Boolean(user.statutoryDetails?.panNo && user.statutoryDetails?.aadhaarNo);
  const isEligible = isBankProvided && isStatutoryProvided;

  onboarding.payrollReadiness = {
    isBankProvided,
    isStatutoryProvided,
    isEligibleForPayroll: isEligible,
    payrollSetupStatus: isEligible ? "READY" : "PENDING",
    setupCompletedBy: req.user ? req.user.id : null,
    setupCompletedAt: isEligible ? new Date() : null,
  };

  if (onboarding.status === "ONBOARDING" || onboarding.status === "PENDING") {
    onboarding.status = "IN_PROGRESS";
  }
  await onboarding.save();

  await logAudit({
    req,
    action: "PAYROLL_UPDATED",
    module: "ONBOARDING",
    resourceId: onboarding._id.toString(),
    details: `Updated bank and statutory payroll setup for employee ${user.employeeCode}`,
  });

  return { user, onboarding };
};

// =========================================================================
// 6. ONBOARDING TASKS MANAGEMENT
// =========================================================================
export const addTaskService = async ({ req, onboardingId, body }) => {
  const onboarding = await Onboarding.findById(onboardingId);
  if (!onboarding) {
    throw { statusCode: 404, message: "Onboarding record not found" };
  }

  const {
    taskName,
    description,
    responsibleGroup,
    assignedTo,
    category,
    priority,
    dueDate,
    isMandatory,
  } = body;

  if (!taskName?.trim()) {
    throw { statusCode: 400, message: "Task name is required" };
  }

  const newTask = {
    taskName: taskName.trim(),
    description: description || "",
    responsibleGroup: responsibleGroup || "HR",
    assignedTo: assignedTo || null,
    category: category || "OTHER",
    priority: priority || "MEDIUM",
    dueDate: dueDate ? new Date(dueDate) : null,
    status: "PENDING",
    isCompleted: false,
    isMandatory: isMandatory !== undefined ? isMandatory : true,
  };

  onboarding.tasks.push(newTask);
  if (onboarding.status === "ONBOARDING" || onboarding.status === "PENDING") {
    onboarding.status = "IN_PROGRESS";
  }
  await onboarding.save();

  await logAudit({
    req,
    action: "TASK_CREATED",
    module: "ONBOARDING",
    resourceId: onboarding._id.toString(),
    details: `Created onboarding task '${taskName}'`,
  });

  return onboarding;
};

export const updateTaskService = async ({ req, onboardingId, taskId, body }) => {
  const onboarding = await Onboarding.findById(onboardingId);
  if (!onboarding) {
    throw { statusCode: 404, message: "Onboarding record not found" };
  }

  const task = onboarding.tasks.id(taskId);
  if (!task) {
    throw { statusCode: 404, message: "Onboarding task not found" };
  }

  const {
    status,
    isCompleted,
    notes,
    assignedTo,
    priority,
    dueDate,
    taskName,
    description,
    responsibleGroup,
    category,
  } = body;

  if (taskName) task.taskName = taskName.trim();
  if (description !== undefined) task.description = description;
  if (responsibleGroup) task.responsibleGroup = responsibleGroup;
  if (category) task.category = category;
  if (priority) task.priority = priority;
  if (dueDate !== undefined) task.dueDate = dueDate ? new Date(dueDate) : null;
  if (assignedTo !== undefined) task.assignedTo = assignedTo || null;
  if (notes !== undefined) task.notes = notes;

  if (status) {
    task.status = status;
    if (status === "COMPLETED") {
      task.isCompleted = true;
      task.completedAt = new Date();
      task.completedBy = req.user ? req.user.id : null;
    } else {
      task.isCompleted = false;
      task.completedAt = null;
      task.completedBy = null;
    }
  } else if (isCompleted !== undefined) {
    task.isCompleted = isCompleted;
    task.status = isCompleted ? "COMPLETED" : "IN_PROGRESS";
    if (isCompleted) {
      task.completedAt = new Date();
      task.completedBy = req.user ? req.user.id : null;
    } else {
      task.completedAt = null;
      task.completedBy = null;
    }
  }

  // NOTE: We do NOT auto-complete onboarding here!
  // Workflow state simply reflects active progress.
  if (onboarding.status === "ONBOARDING" || onboarding.status === "PENDING") {
    onboarding.status = "IN_PROGRESS";
  }

  await onboarding.save();

  await logAudit({
    req,
    action: task.isCompleted ? "TASK_COMPLETED" : "TASK_ASSIGNED",
    module: "ONBOARDING",
    resourceId: onboarding._id.toString(),
    details: `Updated task '${task.taskName}' (Status: ${task.status})`,
  });

  return onboarding;
};

export const deleteTaskService = async ({ req, onboardingId, taskId }) => {
  const onboarding = await Onboarding.findById(onboardingId);
  if (!onboarding) {
    throw { statusCode: 404, message: "Onboarding record not found" };
  }

  const task = onboarding.tasks.id(taskId);
  if (!task) {
    throw { statusCode: 404, message: "Task not found" };
  }

  task.remove ? task.remove() : onboarding.tasks.pull({ _id: taskId });
  await onboarding.save();

  await logAudit({
    req,
    action: "TASK_DELETED",
    module: "ONBOARDING",
    resourceId: onboarding._id.toString(),
    details: `Deleted onboarding task '${task.taskName}'`,
  });

  return onboarding;
};

// =========================================================================
// 7. ASSET ALLOCATION MANAGEMENT
// =========================================================================
export const assignAssetService = async ({ req, onboardingId, body }) => {
  const { assetId, conditionOnAssign, remarks } = body;
  if (!assetId || !mongoose.Types.ObjectId.isValid(assetId)) {
    throw { statusCode: 400, message: "Valid Asset ID is required" };
  }

  const onboarding = await Onboarding.findById(onboardingId);
  if (!onboarding) {
    throw { statusCode: 404, message: "Onboarding record not found" };
  }

  const asset = await Asset.findById(assetId);
  if (!asset) {
    throw { statusCode: 404, message: "Asset not found in inventory" };
  }

  if (asset.status === "ASSIGNED" && asset.currentAssignee?.toString() !== onboarding.employeeId.toString()) {
    throw { statusCode: 409, message: `Asset ${asset.assetCode} is currently assigned to another employee` };
  }

  // Update Asset Record
  asset.status = "ASSIGNED";
  asset.currentAssignee = onboarding.employeeId;
  asset.assignmentHistory.push({
    assignedTo: onboarding.employeeId,
    assignedBy: req.user ? req.user.id : onboarding.employeeId,
    assignedDate: new Date(),
    conditionOnAssign: conditionOnAssign || "GOOD",
    remarks: remarks || "Assigned during onboarding",
  });
  await asset.save();

  // Add to onboarding assignedAssets array if not already present
  if (!onboarding.assignedAssets.some((id) => id.toString() === asset._id.toString())) {
    onboarding.assignedAssets.push(asset._id);
  }

  if (onboarding.status === "ONBOARDING" || onboarding.status === "PENDING") {
    onboarding.status = "IN_PROGRESS";
  }
  await onboarding.save();

  await logAudit({
    req,
    action: "ASSET_ASSIGNED",
    module: "ASSET",
    resourceId: asset._id.toString(),
    details: `Assigned asset ${asset.assetCode} (${asset.name}) for employee onboarding`,
  });

  return onboarding;
};

export const unassignAssetService = async ({ req, onboardingId, assetId, body }) => {
  const onboarding = await Onboarding.findById(onboardingId);
  if (!onboarding) {
    throw { statusCode: 404, message: "Onboarding record not found" };
  }

  const asset = await Asset.findById(assetId);
  if (!asset) {
    throw { statusCode: 404, message: "Asset not found" };
  }

  const { conditionOnReturn, remarks } = body || {};

  // Close history record
  const lastHistory = asset.assignmentHistory[asset.assignmentHistory.length - 1];
  if (lastHistory && !lastHistory.returnedDate) {
    lastHistory.returnedDate = new Date();
    lastHistory.conditionOnReturn = conditionOnReturn || "GOOD";
    if (remarks) lastHistory.remarks += ` | Unassigned from onboarding: ${remarks}`;
  }

  asset.status = conditionOnReturn === "DAMAGED" ? "DAMAGED" : "AVAILABLE";
  asset.currentAssignee = null;
  await asset.save();

  onboarding.assignedAssets = onboarding.assignedAssets.filter(
    (id) => id.toString() !== asset._id.toString()
  );
  await onboarding.save();

  await logAudit({
    req,
    action: "ASSET_RETURNED",
    module: "ASSET",
    resourceId: asset._id.toString(),
    details: `Unassigned asset ${asset.assetCode} from onboarding`,
  });

  return onboarding;
};

// =========================================================================
// 8. SYSTEM ACCESS PROVISIONING MANAGEMENT
// =========================================================================
export const addSystemAccessService = async ({ req, onboardingId, body }) => {
  const onboarding = await Onboarding.findById(onboardingId);
  if (!onboarding) {
    throw { statusCode: 404, message: "Onboarding record not found" };
  }

  const { systemName, accessType, isMandatory, notes } = body;
  if (!systemName?.trim()) {
    throw { statusCode: 400, message: "System name is required" };
  }

  const newAccess = {
    systemName: systemName.trim(),
    accessType: accessType || "STANDARD",
    requestedBy: req.user ? req.user.id : null,
    status: "REQUESTED",
    isProvisioned: false,
    isMandatory: isMandatory !== undefined ? isMandatory : true,
    notes: notes || "",
  };

  onboarding.provisionedAccess.push(newAccess);
  if (onboarding.status === "ONBOARDING" || onboarding.status === "PENDING") {
    onboarding.status = "IN_PROGRESS";
  }
  await onboarding.save();

  await logAudit({
    req,
    action: "ACCESS_REQUESTED",
    module: "ONBOARDING",
    resourceId: onboarding._id.toString(),
    details: `Requested access for system '${systemName}'`,
  });

  return onboarding;
};

export const updateSystemAccessService = async ({ req, onboardingId, accessId, body }) => {
  const onboarding = await Onboarding.findById(onboardingId);
  if (!onboarding) {
    throw { statusCode: 404, message: "Onboarding record not found" };
  }

  const access = onboarding.provisionedAccess.id(accessId);
  if (!access) {
    throw { statusCode: 404, message: "System access record not found" };
  }

  const { status, isProvisioned, notes, approvedBy, accessType } = body;

  if (accessType) access.accessType = accessType;
  if (notes !== undefined) access.notes = notes;
  if (approvedBy) access.approvedBy = approvedBy;

  if (status) {
    access.status = status;
    if (status === "ACTIVE") {
      access.isProvisioned = true;
      access.provisionedAt = new Date();
      access.provisionedBy = req.user ? req.user.id : null;
    } else if (status === "REVOKED") {
      access.isProvisioned = false;
      access.revokedAt = new Date();
    }
  } else if (isProvisioned !== undefined) {
    access.isProvisioned = isProvisioned;
    access.status = isProvisioned ? "ACTIVE" : "PROVISIONING";
    if (isProvisioned) {
      access.provisionedAt = new Date();
      access.provisionedBy = req.user ? req.user.id : null;
    }
  }

  await onboarding.save();

  await logAudit({
    req,
    action: access.status === "ACTIVE" ? "ACCESS_PROVISIONED" : "ACCESS_REQUESTED",
    module: "ONBOARDING",
    resourceId: onboarding._id.toString(),
    details: `Updated access for system '${access.systemName}' (Status: ${access.status})`,
  });

  return onboarding;
};

// =========================================================================
// 9. ORIENTATION & TRAINING MANAGEMENT
// =========================================================================
export const addOrientationService = async ({ req, onboardingId, body }) => {
  const onboarding = await Onboarding.findById(onboardingId);
  if (!onboarding) {
    throw { statusCode: 404, message: "Onboarding record not found" };
  }

  const { trainingName, description, trainer, scheduledDate, dueDate, mandatory } = body;
  if (!trainingName?.trim()) {
    throw { statusCode: 400, message: "Training name is required" };
  }

  const newOrientation = {
    trainingName: trainingName.trim(),
    description: description || "",
    trainer: trainer || "HR Team",
    scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
    dueDate: dueDate ? new Date(dueDate) : null,
    mandatory: mandatory !== undefined ? mandatory : true,
    status: "NOT_STARTED",
  };

  onboarding.orientations.push(newOrientation);
  await onboarding.save();

  return onboarding;
};

export const updateOrientationService = async ({ req, onboardingId, trainingId, body }) => {
  const onboarding = await Onboarding.findById(onboardingId);
  if (!onboarding) {
    throw { statusCode: 404, message: "Onboarding record not found" };
  }

  const orientation = onboarding.orientations.id(trainingId);
  if (!orientation) {
    throw { statusCode: 404, message: "Orientation session not found" };
  }

  const { status, remarks, trainer, scheduledDate, dueDate } = body;

  if (trainer) orientation.trainer = trainer;
  if (remarks !== undefined) orientation.remarks = remarks;
  if (scheduledDate !== undefined) orientation.scheduledDate = scheduledDate ? new Date(scheduledDate) : null;
  if (dueDate !== undefined) orientation.dueDate = dueDate ? new Date(dueDate) : null;

  if (status) {
    orientation.status = status;
    if (status === "COMPLETED") {
      orientation.completedAt = new Date();
      orientation.completedBy = req.user ? req.user.id : null;
    } else {
      orientation.completedAt = null;
      orientation.completedBy = null;
    }
  }

  await onboarding.save();

  await logAudit({
    req,
    action: "TRAINING_COMPLETED",
    module: "ONBOARDING",
    resourceId: onboarding._id.toString(),
    details: `Updated training '${orientation.trainingName}' (Status: ${orientation.status})`,
  });

  return onboarding;
};

// =========================================================================
// 10. AGREEMENTS & POLICY ACKNOWLEDGEMENT MANAGEMENT
// =========================================================================
export const addAgreementService = async ({ req, onboardingId, body }) => {
  const onboarding = await Onboarding.findById(onboardingId);
  if (!onboarding) {
    throw { statusCode: 404, message: "Onboarding record not found" };
  }

  const { agreementType, title, documentUrl, isRequired } = body;
  if (!agreementType || !title?.trim()) {
    throw { statusCode: 400, message: "Agreement type and title are required" };
  }

  const newAgreement = {
    agreementType,
    title: title.trim(),
    documentUrl: documentUrl || "",
    isRequired: isRequired !== undefined ? isRequired : true,
    status: "PENDING",
    isAcknowledged: false,
  };

  onboarding.agreements.push(newAgreement);
  await onboarding.save();

  return onboarding;
};

export const acknowledgeAgreementService = async ({ req, onboardingId, agreementId, body }) => {
  const onboarding = await Onboarding.findById(onboardingId);
  if (!onboarding) {
    throw { statusCode: 404, message: "Onboarding record not found" };
  }

  const agreement = onboarding.agreements.id(agreementId);
  if (!agreement) {
    throw { statusCode: 404, message: "Agreement not found" };
  }

  const { accepted, rejectionReason } = body;

  if (accepted === false) {
    agreement.status = "REJECTED";
    agreement.isAcknowledged = false;
    agreement.rejectedAt = new Date();
    agreement.rejectionReason = rejectionReason || "Declined by employee";
  } else {
    agreement.status = "ACCEPTED";
    agreement.isAcknowledged = true;
    agreement.acknowledgedAt = new Date();
    agreement.acknowledgedBy = req.user ? req.user.id : onboarding.employeeId;
    agreement.rejectedAt = null;
    agreement.rejectionReason = "";
  }

  await onboarding.save();

  await logAudit({
    req,
    action: agreement.status === "ACCEPTED" ? "AGREEMENT_ACKNOWLEDGED" : "AGREEMENT_REJECTED",
    module: "ONBOARDING",
    resourceId: onboarding._id.toString(),
    details: `Agreement '${agreement.title}' status updated to ${agreement.status}`,
  });

  return onboarding;
};

// =========================================================================
// 11. VALIDATION ENGINE EXECUTION
// =========================================================================
export const runValidationService = async ({ req, onboardingId }) => {
  const validationResult = await validateOnboarding(onboardingId);
  const onboarding = await Onboarding.findById(onboardingId);

  onboarding.validationSummary = {
    lastValidatedAt: new Date(),
    lastValidatedBy: req.user ? req.user.id : null,
    isValid: validationResult.valid,
    missingRequirements: validationResult.missingRequirements,
    sectionStatuses: validationResult.sections,
  };

  if (validationResult.valid) {
    onboarding.status = "READY_FOR_COMPLETION";
  } else {
    onboarding.status = "VALIDATION_FAILED";
  }

  await onboarding.save();

  await logAudit({
    req,
    action: validationResult.valid ? "VALIDATION_PASSED" : "VALIDATION_FAILED",
    module: "ONBOARDING",
    resourceId: onboarding._id.toString(),
    details: validationResult.valid
      ? "Onboarding validation passed successfully"
      : `Validation failed with ${validationResult.missingRequirements.length} missing requirements`,
  });

  return {
    valid: validationResult.valid,
    status: onboarding.status,
    sections: validationResult.sections,
    missingRequirements: validationResult.missingRequirements,
  };
};

// =========================================================================
// 12. ONBOARDING COMPLETION WORKFLOW
// =========================================================================
export const completeOnboardingService = async ({ req, onboardingId }) => {
  // 1. Run rigorous validation engine
  const validation = await validateOnboarding(onboardingId);

  if (!validation.valid) {
    throw {
      statusCode: 422,
      message: "Onboarding validation failed. All mandatory requirements must be fulfilled before completion.",
      missingRequirements: validation.missingRequirements,
      sections: validation.sections,
    };
  }

  const onboarding = await Onboarding.findById(onboardingId);
  if (!onboarding) {
    throw { statusCode: 404, message: "Onboarding record not found" };
  }

  if (onboarding.status === "COMPLETED") {
    return {
      message: "Onboarding is already completed.",
      onboarding,
    };
  }

  // 2. Mark status as COMPLETED
  onboarding.status = "COMPLETED";
  onboarding.completedDate = new Date();
  onboarding.validationSummary.isValid = true;
  onboarding.validationSummary.missingRequirements = [];
  onboarding.validationSummary.lastValidatedAt = new Date();
  onboarding.validationSummary.lastValidatedBy = req.user ? req.user.id : null;

  await onboarding.save();

  await logAudit({
    req,
    action: "ONBOARDING_COMPLETED",
    module: "ONBOARDING",
    resourceId: onboarding._id.toString(),
    details: `Onboarding completed for employee ${onboarding.employeeId}`,
  });

  return {
    message: "Onboarding completed successfully. Employee is now ready for activation.",
    onboarding,
  };
};

// =========================================================================
// 13. EMPLOYEE ACTIVATION WORKFLOW
// =========================================================================
export const activateEmployeeService = async ({ req, onboardingId }) => {
  const onboarding = await Onboarding.findById(onboardingId);
  if (!onboarding) {
    throw { statusCode: 404, message: "Onboarding record not found" };
  }

  // Enforce lifecycle state protection: Must be COMPLETED
  if (onboarding.status !== "COMPLETED") {
    throw {
      statusCode: 400,
      message: `Cannot activate employee. Onboarding must be in COMPLETED status (current status: ${onboarding.status}).`,
    };
  }

  const employee = await User.findById(onboarding.employeeId);
  if (!employee) {
    throw { statusCode: 404, message: "Employee user record not found" };
  }

  const previousStatus = employee.lifecycleStatus;
  employee.lifecycleStatus = "ACTIVE";
  employee.isActive = true;

  await employee.save();

  onboarding.activationDetails = {
    activatedBy: req.user ? req.user.id : null,
    activatedAt: new Date(),
    previousStatus,
    newStatus: "ACTIVE",
  };
  await onboarding.save();

  await logAudit({
    req,
    action: "EMPLOYEE_ACTIVATED",
    module: "ONBOARDING",
    resourceId: employee._id.toString(),
    previousState: { lifecycleStatus: previousStatus },
    newState: { lifecycleStatus: "ACTIVE", isActive: true },
    details: `Activated employee ${employee.employeeCode}. Login access remains unprovisioned until credentials are set.`,
  });

  return {
    message: "Employee successfully activated. Account provisioning can now be performed.",
    employee: {
      _id: employee._id,
      employeeCode: employee.employeeCode,
      firstName: employee.firstName,
      lastName: employee.lastName,
      lifecycleStatus: employee.lifecycleStatus,
      hasLoginAccess: employee.hasLoginAccess,
    },
    onboarding,
  };
};

// =========================================================================
// 14. LOGIN PROVISIONING & ENABLEMENT
// =========================================================================
export const provisionAccountService = async ({ req, onboardingId, body }) => {
  const onboarding = await Onboarding.findById(onboardingId);
  if (!onboarding) {
    throw { statusCode: 404, message: "Onboarding record not found" };
  }

  const employee = await User.findById(onboarding.employeeId).populate("role");
  if (!employee) {
    throw { statusCode: 404, message: "Employee user record not found" };
  }

  // Enforce lifecycle state: Must be ACTIVE
  if (employee.lifecycleStatus !== "ACTIVE") {
    throw {
      statusCode: 400,
      message: `Employee must have lifecycleStatus = 'ACTIVE' before account provisioning (current: ${employee.lifecycleStatus}).`,
    };
  }

  const { password, roleId } = body;

  if (roleId) {
    const targetRole = await Role.findById(roleId);
    if (!targetRole) {
      throw { statusCode: 404, message: "Target role not found" };
    }
    if (req.user && !canAssignRole(req.user, targetRole)) {
      throw {
        statusCode: 403,
        message: `Forbidden: You do not have authority to assign role '${targetRole.roleName}'.`,
      };
    }
    employee.role = targetRole._id;
  }

  if (password && password.trim()) {
    if (password.trim().length < 6) {
      throw { statusCode: 400, message: "Password must be at least 6 characters long" };
    }
    employee.password = await bcrypt.hash(password.trim(), 10);
  }

  employee.hasLoginAccess = true;
  employee.accountProvisionedAt = new Date();
  employee.accountProvisionedBy = req.user ? req.user.id : null;
  await employee.save();

  await logAudit({
    req,
    action: "ACCOUNT_PROVISIONED",
    module: "USER_MANAGEMENT",
    resourceId: employee._id.toString(),
    details: `Provisioned login credentials and enabled login access for ${employee.employeeCode}`,
  });

  return {
    message: "Login credentials provisioned and login access enabled successfully.",
    employee: {
      _id: employee._id,
      employeeCode: employee.employeeCode,
      email: employee.email,
      hasLoginAccess: employee.hasLoginAccess,
      accountProvisionedAt: employee.accountProvisionedAt,
    },
  };
};

export const toggleLoginAccessService = async ({ req, onboardingId, body }) => {
  const onboarding = await Onboarding.findById(onboardingId);
  if (!onboarding) {
    throw { statusCode: 404, message: "Onboarding record not found" };
  }

  const employee = await User.findById(onboarding.employeeId).populate("role");
  if (!employee) {
    throw { statusCode: 404, message: "Employee user record not found" };
  }

  const { enable } = body;
  if (enable === true && employee.lifecycleStatus !== "ACTIVE") {
    throw {
      statusCode: 400,
      message: "Cannot enable login for employee whose lifecycle status is not ACTIVE.",
    };
  }

  employee.hasLoginAccess = Boolean(enable);
  await employee.save();

  await logAudit({
    req,
    action: enable ? "LOGIN_ENABLED" : "LOGIN_DISABLED",
    module: "USER_MANAGEMENT",
    resourceId: employee._id.toString(),
    details: `${enable ? "Enabled" : "Disabled"} login access for ${employee.employeeCode}`,
  });

  return {
    message: `Login access ${enable ? "enabled" : "disabled"} successfully.`,
    employee: {
      _id: employee._id,
      employeeCode: employee.employeeCode,
      hasLoginAccess: employee.hasLoginAccess,
    },
  };
};
