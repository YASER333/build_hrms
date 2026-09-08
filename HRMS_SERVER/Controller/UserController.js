import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import User from "../Modules/UserModule.js";
import Role from "../Modules/RoleModules.js";
import Attendance from "../Modules/AttendanceModule.js";
import { canAssignRole, canModifyUserAccount } from "../Utils/RoleAuthority.js";
import { logAudit } from "../Utils/AuditLogger.js";
import { processCloudinaryUpload } from "../Services/UploadService.js";

const SALT_ROUNDS = 10;

// ======================================================
// HELPERS
// ======================================================

const getDistanceInMeters = (lat1, lon1, lat2, lon2) => {
  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lon2)
  ) {
    return null;
  }

  const R = 6371000;
  const rad = Math.PI / 180;

  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;

  const a = Math.min(
    1,
    Math.max(
      0,
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * rad) *
      Math.cos(lat2 * rad) *
      Math.sin(dLon / 2) ** 2
    )
  );

  const c =
    2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

const getTodayString = () => {
  return new Date().toISOString().split("T")[0];
};

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

// ======================================================
// REGISTER USER (Common Registration Endpoint)
// ======================================================
export const register = async (req, res) => {
  try {
    const {
      firstName,
      middleName,
      lastName,
      name,
      fullName,
      email,
      password,
      mobileNo,
      mobileNumber,
      employeeCode,
      role,
      roleId,
      roleCode,
      dob,
      gender,
      marriageStatus,
      bloodGroup,
      department,
      designation,
      employmentType,
      joiningDate,
      tlCode,
      hasLoginAccess,
      avatarUrl,
      profilePic,
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const phone = mobileNo || mobileNumber || req.body.phone;

    // 1. Check duplicate email or mobile
    const existingUser = await User.findOne({
      $or: [
        { email: normalizedEmail },
        ...(phone ? [{ mobileNo: phone.trim() }] : []),
      ],
    });

    if (existingUser) {
      const isEmailMatch = existingUser.email === normalizedEmail;
      return res.status(409).json({
        success: false,
        message: isEmailMatch
          ? "User with this email already exists."
          : "User with this mobile number already exists.",
      });
    }

    // 2. Names parsing
    let fName = firstName;
    let lName = lastName;

    if (!fName && (name || fullName)) {
      const rawName = (name || fullName).trim();
      const parts = rawName.split(" ");
      fName = parts[0];
      lName = parts.slice(1).join(" ") || parts[0];
    }

    fName = (fName || "Employee").trim();
    lName = (lName || "User").trim();

    // 3. Employee Code
    let empCode = employeeCode ? employeeCode.trim().toUpperCase() : null;
    if (!empCode) {
      empCode = await generateNextEmployeeCode();
    } else {
      const codeExists = await User.exists({ employeeCode: empCode });
      if (codeExists) {
        empCode = await generateNextEmployeeCode();
      }
    }

    // 4. Role determination
    let assignedRoleId = null;
    let userRoleDoc = null;

    if (roleId && mongoose.Types.ObjectId.isValid(roleId)) {
      userRoleDoc = await Role.findById(roleId);
    } else if (role && mongoose.Types.ObjectId.isValid(role)) {
      userRoleDoc = await Role.findById(role);
    } else if (roleCode || typeof role === "string") {
      const searchCode = (roleCode || role).trim().toUpperCase();
      userRoleDoc = await Role.findOne({
        $or: [{ roleCode: searchCode }, { roleName: new RegExp(`^${searchCode}$`, "i") }],
      });
    }

    if (!userRoleDoc) {
      // Default to EMPLOYEE role
      userRoleDoc = await Role.findOne({
        $or: [{ roleCode: "EMPLOYEE" }, { roleName: /employee/i }],
      });

      if (!userRoleDoc) {
        userRoleDoc = await Role.create({
          roleName: "Employee",
          roleCode: "EMPLOYEE",
          priority: 5,
          isSystemRole: false,
          isActive: true,
        });
      }
    }

    assignedRoleId = userRoleDoc._id;

    // 5. Handle optional profile picture file upload if multipart
    let profileImageUrl = avatarUrl || profilePic || req.body.profileImage || "";
    const file =
      req.file ||
      (req.files &&
        (req.files.profilePic ||
          req.files.avatar ||
          req.files.profileImage ||
          req.files.image ||
          (Array.isArray(req.files) ? req.files[0] : null)));

    if (file) {
      try {
        const uploadRes = await processCloudinaryUpload({
          file,
          folder: "hrms_profile",
          entityId: empCode,
        });
        profileImageUrl = uploadRes.fileUrl;
      } catch (uploadErr) {
        console.warn("Profile upload warning during register:", uploadErr.message);
      }
    }

    // 6. Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // 7. Create User
    const newUser = await User.create({
      firstName: fName,
      middleName: middleName ? middleName.trim() : null,
      lastName: lName,
      email: normalizedEmail,
      mobileNo: phone ? phone.trim() : `${Date.now()}`.slice(-10),
      password: hashedPassword,
      employeeCode: empCode,
      dob: dob ? new Date(dob) : new Date("1995-01-01"),
      gender: ["Male", "Female", "Others"].includes(gender) ? gender : "Male",
      marriageStatus: ["Married", "Unmarried"].includes(marriageStatus) ? marriageStatus : "Unmarried",
      bloodGroup: bloodGroup || null,
      role: assignedRoleId,
      hasLoginAccess: hasLoginAccess !== undefined ? Boolean(hasLoginAccess) : true,
      department: department ? department.trim() : "General",
      designation: designation ? designation.trim() : "Employee",
      employmentType: employmentType || "FULL_TIME",
      joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
      lifecycleStatus: "ACTIVE",
      isActive: true,
      isBlocked: false,
      avatarUrl: profileImageUrl,
      profilePic: profileImageUrl,
      profilePicUrl: profileImageUrl,
      profileImage: profileImageUrl,
    });

    // 8. Generate JWT Token
    const jwtPayload = {
      id: newUser._id,
      email: newUser.email,
      role: userRoleDoc.roleCode || "EMPLOYEE",
      priority: userRoleDoc.priority || 5,
    };
    const token = jwt.sign(jwtPayload, process.env.JWT || "secret_key", {
      expiresIn: "7d",
    });

    const sanitizedUser = newUser.toObject();
    delete sanitizedUser.password;

    await logAudit({
      req,
      action: "REGISTER_USER",
      module: "USER_MANAGEMENT",
      resourceId: newUser._id.toString(),
      details: `User registered: ${newUser.employeeCode} (${newUser.email})`,
    });

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      data: {
        user: sanitizedUser,
        role: userRoleDoc.roleCode || "EMPLOYEE",
      },
    });
  } catch (error) {
    console.error("register Error:", error);
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email, mobile number, or employee code already exists.",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Failed to register user: " + error.message,
    });
  }
};

// ======================================================
// REGISTER OWNER (Dedicated One-Time Initial Setup Endpoint)
// ======================================================
export const registerOwner = async (req, res) => {
  try {
    // 1. Verify Setup Key Header
    const setupKeyHeader = req.get("X-HRMS-Setup-Key");
    const configuredSetupKey = process.env.HRMS_SETUP_KEY;

    if (!configuredSetupKey || !setupKeyHeader || setupKeyHeader.trim() !== configuredSetupKey.trim()) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Invalid or missing X-HRMS-Setup-Key header.",
      });
    }

    // 2. Check if an Owner account already exists in DB
    const existingOwnerRole = await Role.findOne({
      $or: [{ roleCode: "OWNER" }, { priority: 1 }],
    }).lean();

    if (existingOwnerRole) {
      const ownerUserExists = await User.exists({ role: existingOwnerRole._id });
      if (ownerUserExists) {
        return res.status(403).json({
          success: false,
          message: "System Owner account already initialized and exists.",
        });
      }
    }

    // 3. Extract credentials & employee info (strictly ignoring client-supplied role/priority/permissions)
    const { employeeCode, firstName, name, lastName, email, password, mobileNo, dob, gender, marriageStatus } = req.body;

    const fName = firstName || (name ? name.split(" ")[0] : "System");
    const lName = lastName || (name && name.split(" ").length > 1 ? name.split(" ").slice(1).join(" ") : "Owner");

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const ownerCode = employeeCode ? employeeCode.trim().toUpperCase() : "OWN001";
    const phone = mobileNo ? mobileNo.trim() : "9999999999";

    // 4. Find or Create the predefined System Owner Role
    let ownerRole = existingOwnerRole ? await Role.findById(existingOwnerRole._id) : null;
    if (!ownerRole) {
      ownerRole = await Role.create({
        roleName: "Owner",
        roleCode: "OWNER",
        priority: 1,
        isSystemRole: true,
        isActive: true,
        isBlocked: false,
        isBlock: false,
      });
    }

    // 5. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 6. Create Owner User
    const ownerUser = await User.create({
      firstName: fName,
      lastName: lName,
      email: normalizedEmail,
      mobileNo: phone,
      password: hashedPassword,
      employeeCode: ownerCode,
      dob: dob ? new Date(dob) : new Date("1990-01-01"),
      gender: gender || "Male",
      marriageStatus: marriageStatus || "Married",
      role: ownerRole._id,
      lifecycleStatus: "ACTIVE",
      isActive: true,
      isBlocked: false,
      wfh: { isApproved: true },
    });

    return res.status(201).json({
      success: true,
      message: "Owner account created successfully",
      data: {
        userId: ownerUser._id,
        employeeCode: ownerUser.employeeCode,
        role: "OWNER",
      },
    });
  } catch (error) {
    console.error("registerOwner Error:", error);
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Owner email, mobile number, or employee code already exists.",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Failed to initialize Owner account: " + error.message,
    });
  }
};

// ======================================================
// LOGIN
// ======================================================

export const login = async (req, res) => {
  try {
    // ==================================================
    // GET LOGIN DATA
    // ==================================================

    const {
      identifier,
      email,
      password,
      latitude,
      longitude,
    } = req.body;

    const loginIdentifier = identifier || email;

    // ==================================================
    // VALIDATE LOGIN INPUT
    // ==================================================

    if (
      typeof loginIdentifier !== "string" ||
      typeof password !== "string" ||
      !loginIdentifier.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Email/mobile number and password are required",
      });
    }

    const value = loginIdentifier.trim();

    // ==================================================
    // FIND USER
    // ==================================================

    const user = await User.findOne({
      $or: [
        {
          email: value.toLowerCase(),
        },
        {
          mobileNo: value,
        },
      ],
    })
      .select("+password")
      .lean();

    if (!user || !user.password || typeof password !== "string") {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // ==================================================
    // PASSWORD CHECK
    // ==================================================

    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // ==================================================
    // USER STATUS & LOGIN PROVISIONING CHECK
    // ==================================================

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Your account has been blocked",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive",
      });
    }

    if (user.hasLoginAccess === false) {
      return res.status(403).json({
        success: false,
        message: "Login access has not been provisioned for this employee. Please contact HR or your administrator.",
      });
    }

    // ==================================================
    // ROLE VALIDATION
    // ==================================================

    if (!user.role) {
      return res.status(403).json({
        success: false,
        message: "No role assigned to this user",
      });
    }

    const userRoleDoc = await Role.findById(user.role)
      .select(
        "_id roleName roleCode priority isActive isBlocked isBlock"
      )
      .lean();

    if (!userRoleDoc) {
      return res.status(403).json({
        success: false,
        message: "User role not found",
      });
    }

    // Support both existing field names while your schema
    // is being standardized.
    const roleBlocked =
      userRoleDoc.isBlocked === true ||
      userRoleDoc.isBlock === true;

    if (roleBlocked) {
      return res.status(403).json({
        success: false,
        message: "Your role has been blocked",
      });
    }

    if (userRoleDoc.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "Your role is inactive",
      });
    }

    // ==================================================
    // JWT SECRET
    // ==================================================

    const jwtSecret = process.env.JWT;

    if (!jwtSecret) {
      console.error("JWT secret is missing");

      return res.status(500).json({
        success: false,
        message:
          "Authentication service unavailable",
      });
    }

    // ==================================================
    // GENERATE JWT
    // ==================================================

    const token = jwt.sign(
      {
        sub: user._id.toString(),
      },
      jwtSecret,
      {
        expiresIn: "9h",
        issuer: "hrms",
        audience: "hrms-client",
      }
    );

    // ==================================================
    // LAST LOGIN TIMESTAMP
    // ==================================================

    const now = new Date();

    await User.updateOne(
      {
        _id: user._id,
      },
      {
        $set: { lastLoginAt: now },
      }
    );

    // ==================================================
    // LOGIN SUCCESS
    // ==================================================

    return res
      .status(200)
      .header("hrms-auth-token", token)
      .json({
        success: true,
        message: "Login successful",
        token,
        user: {
          id: user._id,
          employeeCode: user.employeeCode,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          mobileNo: user.mobileNo,
          avatarUrl: user.avatarUrl || user.profilePic || user.profileImage || "",
          profilePic: user.profilePic || user.avatarUrl || "",
          role: user.role,
          roleCode: userRoleDoc.roleCode,
          roleName: userRoleDoc.roleName,
          priority: userRoleDoc.priority,
          tlCode: user.tlCode,
        },
      });
  } catch (error) {
    console.error("Login Error:", error);

    return res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
};

// ======================================================
// LOGOUT
// ======================================================

export const logout = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Logout Error:", error);
    return res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
};

// ======================================================
// PROFILE
// ======================================================

export const profile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select(
        "firstName middleName lastName email dob gender " +
        "marriageStatus bloodGroup mobileNo employeeCode " +
        "avatarUrl profilePic profilePicUrl profileImage " +
        "role tlCode isActive isBlocked wfh " +
        "lastLoginAt lastLoginLocation"
      )
      .populate({
        path: "role",
        select: "roleName",
      })
      .populate({
        path: "tlCode",
        select:
          "firstName middleName lastName employeeCode",
      })
      .lean();

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      data: user,
    });
  } catch (error) {
    console.error("Profile Error:", error);

    return res.status(500).json({
      message: "Failed to fetch profile",
    });
  }
};

// ======================================================
// GET AUTHENTICATED ACCESS CONTEXT (/api/auth/me)
// Returns user profile, active menus, and active permissions
// ======================================================

export const getAuthContext = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("firstName lastName email employeeCode role isActive isBlocked")
      .populate("role", "roleName roleCode priority isSystemRole")
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: req.user.id,
          employeeCode: req.user.employeeCode,
          firstName: user?.firstName || "",
          lastName: user?.lastName || "",
          email: user?.email || "",
          roleId: req.user.roleId,
          roleName: req.user.roleName,
          roleCode: req.user.roleCode,
          priority: req.user.priority,
          isSystemRole: req.user.isSystemRole,
        },
        menus: req.user.menus || [],
        permissions: req.user.permissions || [],
      },
    });
  } catch (error) {
    console.error("Get Auth Context Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve access context",
    });
  }
};

// ======================================================
// GET ALL USERS
// ======================================================

export const getAllUser = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      role,
      isActive,
    } = req.query;

    const pageNumber = Math.max(Number(page), 1);
    const limitNumber = Math.min(
      Math.max(Number(limit), 1),
      100
    );

    const filter = {};

    if (search?.trim()) {
      const searchValue = search.trim();

      filter.$or = [
        {
          firstName: {
            $regex: searchValue,
            $options: "i",
          },
        },
        {
          lastName: {
            $regex: searchValue,
            $options: "i",
          },
        },
        {
          email: {
            $regex: searchValue,
            $options: "i",
          },
        },
        {
          employeeCode: {
            $regex: searchValue,
            $options: "i",
          },
        },
      ];
    }

    if (role) {
      const roleDoc = await Role.findOne({
        roleName: role,
      })
        .select("_id")
        .lean();

      if (!roleDoc) {
        return res.status(200).json({
          data: [],
          pagination: {
            page: pageNumber,
            limit: limitNumber,
            total: 0,
            pages: 0,
          },
        });
      }

      filter.role = roleDoc._id;
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    const skip = (pageNumber - 1) * limitNumber;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select(
          "firstName middleName lastName email mobileNo " +
          "employeeCode avatarUrl profilePic profilePicUrl profileImage role tlCode isActive isBlocked wfh " +
          "hasLoginAccess accountProvisionedAt accountProvisionedBy " +
          "department designation lifecycleStatus joiningDate"
        )
        .populate({
          path: "role",
          select: "roleName roleCode priority isSystemRole",
        })
        .populate({
          path: "tlCode",
          select:
            "firstName middleName lastName employeeCode",
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber)
        .lean(),

      User.countDocuments(filter),
    ]);

    return res.status(200).json({
      data: users,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        pages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    console.error("Get Users Error:", error);

    return res.status(500).json({
      message: "Failed to fetch users",
    });
  }
};

// ======================================================
// GET USER BY ID
// ======================================================

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid user ID",
      });
    }

    const user = await User.findById(id)
      .select(
        "firstName middleName lastName email dob gender " +
        "marriageStatus bloodGroup mobileNo employeeCode " +
        "avatarUrl profilePic profilePicUrl profileImage " +
        "role tlCode isActive isBlocked wfh " +
        "lastLoginAt lastLoginLocation"
      )
      .populate({
        path: "role",
        select: "roleName",
      })
      .populate({
        path: "tlCode",
        select:
          "firstName middleName lastName employeeCode",
      })
      .lean();

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      data: user,
    });
  } catch (error) {
    console.error("Get User Error:", error);

    return res.status(500).json({
      message: "Failed to fetch user",
    });
  }
};

// ======================================================
// UPDATE USER
// ======================================================

export const updateUser = async (req, res) => {
  try {
    const id = req.params.id || req.body.id;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid user ID",
      });
    }

    const allowedFields = [
      "firstName",
      "middleName",
      "lastName",
      "email",
      "dob",
      "gender",
      "marriageStatus",
      "bloodGroup",
      "mobileNo",
      "employeeCode",
      "tlCode",
      "avatarUrl",
      "profilePic",
      "profilePicUrl",
      "profileImage",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // Process file upload if provided in multipart request
    const file = req.file || (req.files && (req.files.profilePic || req.files.avatar || req.files.image || (Array.isArray(req.files) ? req.files[0] : null)));
    if (file) {
      const uploadRes = await processCloudinaryUpload({
        file,
        folder: "hrms_profile",
        entityId: id,
      });
      updates.avatarUrl = uploadRes.fileUrl;
      updates.profilePic = uploadRes.fileUrl;
      updates.profilePicUrl = uploadRes.fileUrl;
      updates.profileImage = uploadRes.fileUrl;
    }

    if (updates.email) {
      updates.email = updates.email
        .toLowerCase()
        .trim();
    }

    if (updates.mobileNo) {
      updates.mobileNo = updates.mobileNo.trim();
    }

    if (updates.employeeCode) {
      updates.employeeCode = updates.employeeCode
        .trim()
        .toUpperCase();
    }

    if (updates.middleName === "") {
      updates.middleName = null;
    }

    if (updates.tlCode) {
      if (
        !mongoose.Types.ObjectId.isValid(updates.tlCode)
      ) {
        return res.status(400).json({
          message: "Invalid Team Lead ID",
        });
      }

      if (updates.tlCode.toString() === id.toString()) {
        return res.status(400).json({
          message: "User cannot be their own Team Lead",
        });
      }
    }

    const updatedUser =
      await User.findByIdAndUpdate(
        id,
        { $set: updates },
        {
          new: true,
          runValidators: true,
        }
      )
        .select(
          "firstName middleName lastName email dob gender " +
          "marriageStatus bloodGroup mobileNo employeeCode " +
          "avatarUrl profilePic profilePicUrl profileImage " +
          "role tlCode isActive isBlocked wfh"
        )
        .lean();

    if (!updatedUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      message: "User updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Update User Error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        message:
          "Email, mobile number or employee code already exists",
      });
    }

    return res.status(500).json({
      message: "Failed to update user",
    });
  }
};

// ======================================================
// PROVISION LOGIN ACCOUNT
// ======================================================

export const provisionAccount = async (req, res) => {
  try {
    const { employeeId, roleId, password, isActive } = req.body;

    if (!employeeId || !mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Valid employee ID is required",
      });
    }

    if (!roleId || !mongoose.Types.ObjectId.isValid(roleId)) {
      return res.status(400).json({
        success: false,
        message: "Valid role ID is required",
      });
    }

    // 1. Verify target employee exists
    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee record not found",
      });
    }

    // 2. Prevent duplicate account provisioning
    if (employee.hasLoginAccess === true) {
      return res.status(400).json({
        success: false,
        message: "Login account already exists for this employee.",
      });
    }

    // 3. Verify target role exists
    const targetRole = await Role.findById(roleId).lean();
    if (!targetRole) {
      return res.status(404).json({
        success: false,
        message: "Requested role not found",
      });
    }

    // 4. Centralized Role Assignment Authority Check
    if (!canAssignRole(req.user, targetRole)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: You do not have authority to assign role '${targetRole.roleName}'.`,
      });
    }

    // 5. Hash initial password
    const rawPassword = password && password.trim() ? password.trim() : "Welcome@123";
    if (rawPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    // 6. Provision the account
    employee.password = hashedPassword;
    employee.role = targetRole._id;
    employee.hasLoginAccess = true;
    employee.accountProvisionedAt = new Date();
    employee.accountProvisionedBy = req.user.id;
    employee.isActive = isActive !== undefined ? isActive : true;
    if (employee.lifecycleStatus === "ONBOARDING") {
      employee.lifecycleStatus = "ACTIVE";
    }

    await employee.save();

    await logAudit({
      req,
      action: "PROVISION_USER_ACCOUNT",
      module: "USER_MANAGEMENT",
      resourceId: employee._id.toString(),
      details: `Provisioned login account for ${employee.employeeCode} (${employee.email}) with role ${targetRole.roleName}`,
    });

    return res.status(201).json({
      success: true,
      message: `Login account provisioned successfully for ${employee.firstName} ${employee.lastName}.`,
      data: {
        id: employee._id,
        employeeCode: employee.employeeCode,
        email: employee.email,
        roleId: targetRole._id,
        roleName: targetRole.roleName,
        hasLoginAccess: employee.hasLoginAccess,
        isActive: employee.isActive,
      },
    });
  } catch (error) {
    console.error("provisionAccount Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to provision login account",
      error: error.message,
    });
  }
};

// ======================================================
// UPDATE ACCOUNT STATUS (Activate / Deactivate / Block)
// ======================================================

export const updateAccountStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive, isBlocked } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    const employee = await User.findById(id).populate("role");
    if (!employee) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Security check: Verify caller can modify target user
    if (!canModifyUserAccount(req.user, employee.role)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not have authority to modify this user account.",
      });
    }

    if (isActive !== undefined) employee.isActive = isActive;
    if (isBlocked !== undefined) employee.isBlocked = isBlocked;

    await employee.save();

    await logAudit({
      req,
      action: "UPDATE_ACCOUNT_STATUS",
      module: "USER_MANAGEMENT",
      resourceId: employee._id.toString(),
      details: `Updated account status for ${employee.employeeCode} (isActive=${employee.isActive}, isBlocked=${employee.isBlocked})`,
    });

    return res.status(200).json({
      success: true,
      message: "Account status updated successfully",
      data: {
        id: employee._id,
        employeeCode: employee.employeeCode,
        isActive: employee.isActive,
        isBlocked: employee.isBlocked,
      },
    });
  } catch (error) {
    console.error("updateAccountStatus Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ======================================================
// RESET ACCOUNT CREDENTIALS
// ======================================================

export const resetAccountCredentials = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    if (!password || password.trim().length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    const employee = await User.findById(id).populate("role");
    if (!employee) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Security check: Verify caller can modify target user
    if (!canModifyUserAccount(req.user, employee.role)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not have authority to reset credentials for this account.",
      });
    }

    const hashedPassword = await bcrypt.hash(password.trim(), 10);
    employee.password = hashedPassword;
    await employee.save();

    await logAudit({
      req,
      action: "RESET_USER_PASSWORD",
      module: "USER_MANAGEMENT",
      resourceId: employee._id.toString(),
      details: `Reset password for employee ${employee.employeeCode}`,
    });

    return res.status(200).json({
      success: true,
      message: `Password reset successfully for ${employee.firstName} ${employee.lastName}.`,
    });
  } catch (error) {
    console.error("resetAccountCredentials Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ======================================================
// UPDATE ROLE
// ======================================================

export const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid user ID",
      });
    }

    if (!role) {
      return res.status(400).json({
        message: "Role is required",
      });
    }

    const user = await User.findById(id).populate("role");
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // 1. Check if caller can modify this user account (e.g. non-owners cannot modify Owner)
    if (!canModifyUserAccount(req.user, user.role)) {
      return res.status(403).json({
        message: "Forbidden: You do not have authority to modify this user account.",
      });
    }

    // 2. Find target role
    let roleDoc;
    if (mongoose.Types.ObjectId.isValid(role)) {
      roleDoc = await Role.findById(role).lean();
    } else {
      roleDoc = await Role.findOne({ roleName: role }).lean();
    }

    if (!roleDoc) {
      return res.status(400).json({
        message: "Invalid role",
      });
    }

    // 3. Check if caller has authority to assign this target role
    if (!canAssignRole(req.user, roleDoc)) {
      return res.status(403).json({
        message: `Forbidden: You do not have authority to assign role '${roleDoc.roleName}'.`,
      });
    }

    user.role = roleDoc._id;
    await user.save();

    await logAudit({
      req,
      action: "UPDATE_USER_ROLE",
      module: "USER_MANAGEMENT",
      resourceId: user._id.toString(),
      details: `Reassigned role for ${user.employeeCode} to ${roleDoc.roleName}`,
    });

    return res.status(200).json({
      message: "Role updated successfully",
      data: {
        id: user._id,
        employeeCode: user.employeeCode,
        role: roleDoc._id,
        roleName: roleDoc.roleName,
      },
    });
  } catch (error) {
    console.error("Update Role Error:", error);
    return res.status(500).json({
      message: "Failed to update role",
      error: error.message,
    });
  }
};

// ======================================================
// DELETE USER
// ======================================================

export const deleteUser = async (req, res) => {
  try {
    const id = req.params.id || req.body.id;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid user ID",
      });
    }

    const user = await User.findById(id).populate("role");
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Protect against non-owners deleting Owner
    if (!canModifyUserAccount(req.user, user.role)) {
      return res.status(403).json({
        message: "Forbidden: You do not have authority to delete this user account.",
      });
    }

    await User.findByIdAndDelete(id);

    await logAudit({
      req,
      action: "DELETE_USER",
      module: "USER_MANAGEMENT",
      resourceId: id.toString(),
      details: `Deleted user ${user.employeeCode} (${user.email})`,
    });

    return res.status(200).json({
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete User Error:", error);
    return res.status(500).json({
      message: "Failed to delete user",
      error: error.message,
    });
  }
};

// ======================================================
// UPLOAD PROFILE PICTURE
// ======================================================

export const uploadProfilePicture = async (req, res) => {
  try {
    const userId = req.params.id || req.body.userId || req.user?.id;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Valid user ID is required",
      });
    }

    const file =
      req.file ||
      (req.files &&
        (req.files.profilePic ||
          req.files.profileImage ||
          req.files.avatar ||
          req.files.photo ||
          req.files.image ||
          (Array.isArray(req.files) ? req.files[0] : null)));

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "No profile photo file uploaded",
      });
    }

    const uploadRes = await processCloudinaryUpload({
      file,
      folder: "hrms_profile",
      entityId: userId,
    });

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          avatarUrl: uploadRes.fileUrl,
          profilePic: uploadRes.fileUrl,
          profilePicUrl: uploadRes.fileUrl,
          profileImage: uploadRes.fileUrl,
        },
      },
      { new: true }
    )
      .select(
        "firstName middleName lastName email dob gender " +
        "marriageStatus bloodGroup mobileNo employeeCode " +
        "avatarUrl profilePic profilePicUrl profileImage " +
        "role tlCode isActive isBlocked wfh"
      )
      .lean();

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile photo uploaded successfully",
      data: {
        userId: updatedUser._id,
        avatarUrl: uploadRes.fileUrl,
        profilePic: uploadRes.fileUrl,
        profilePicUrl: uploadRes.fileUrl,
        profileImage: uploadRes.fileUrl,
        user: updatedUser,
      },
    });
  } catch (error) {
    console.error("Upload Profile Picture Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to upload profile photo: " + error.message,
    });
  }
};
