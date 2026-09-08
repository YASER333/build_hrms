import jwt from "jsonwebtoken";
import User from "../Modules/UserModule.js";
import Menu from "../Modules/MenuModule.js";
import RoleMenu from "../Modules/RoleMenuModule.js";
import RolePermission from "../Modules/RolePermissionModule.js";

/**
 * Authentication Middleware
 *
 * Validates JWT Bearer token, fetches live user and role from database,
 * retrieves all assigned permissions from RolePermission and menus from RoleMenu,
 * and attaches complete authorization context to req.user.
 */
export const Authentication = async (req, res, next) => {
  try {
    // 1. Read Bearer token
    const authHeader = req.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication token required",
      });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication token required",
      });
    }

    // 2. JWT Secret check
    const jwtSecret = process.env.JWT;
    if (!jwtSecret) {
      console.error("JWT secret is not configured in environment");
      return res.status(500).json({
        success: false,
        message: "Authentication service unavailable",
      });
    }

    // 3. Verify JWT signature, issuer, and audience
    const decoded = jwt.verify(token, jwtSecret, {
      issuer: "hrms",
      audience: "hrms-client",
    });

    if (!decoded.sub) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token: missing subject",
      });
    }

    // 4. Fetch User and populate Role
    const user = await User.findById(decoded.sub)
      .select("_id employeeCode role isActive isBlocked")
      .populate({
        path: "role",
        select: "_id roleName roleCode priority isActive isBlock isBlocked isSystemRole",
      })
      .lean();

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account not found",
      });
    }

    // 5. User Account Status checks
    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Your account has been blocked by administrator",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account is currently inactive",
      });
    }

    // 6. Role Status checks
    if (!user.role) {
      return res.status(403).json({
        success: false,
        message: "No active role assigned to this user",
      });
    }

    const isRoleBlocked = user.role.isBlock || user.role.isBlocked || false;
    if (isRoleBlocked) {
      return res.status(403).json({
        success: false,
        message: "Your assigned role has been blocked",
      });
    }

    if (!user.role.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your assigned role is currently inactive",
      });
    }

    // 7. Retrieve Granular Permissions from RolePermission collection (Single Source of Truth)
    const rolePermissionDocs = await RolePermission.find({ roleId: user.role._id })
      .populate({
        path: "permissionId",
        select: "permissionCode isActive",
      })
      .lean();

    const activePermissionsFromDB = rolePermissionDocs
      .filter((rp) => rp.permissionId && rp.permissionId.isActive)
      .map((rp) => rp.permissionId.permissionCode);

    // 8. Retrieve Assigned Menus from RoleMenu collection
    const roleMenuDocs = await RoleMenu.find({ roleId: user.role._id })
      .populate({
        path: "menuId",
        select: "menuCode isActive isBlock",
      })
      .lean();

    let activeMenusFromDB = roleMenuDocs
      .filter((rm) => rm.menuId && rm.menuId.isActive && !rm.menuId.isBlock)
      .map((rm) => rm.menuId.menuCode);

    // System Owner (priority 1 or roleCode OWNER) has universal access to all active system menus
    if (user.role.priority === 1 || user.role.roleCode === "OWNER") {
      const allActiveSystemMenus = await Menu.find({ isActive: true, isBlock: false })
        .select("menuCode")
        .lean();
      activeMenusFromDB = Array.from(
        new Set([...activeMenusFromDB, ...allActiveSystemMenus.map((m) => m.menuCode)])
      );
    }

    // 9. Store complete Authorization Context in req.user
    req.user = {
      id: user._id.toString(),
      employeeCode: user.employeeCode,
      roleId: user.role._id.toString(),
      roleName: user.role.roleName,
      roleCode: user.role.roleCode,
      priority: user.role.priority,
      isSystemRole: user.role.isSystemRole || false,
      permissions: activePermissionsFromDB,
      menus: activeMenusFromDB,
    };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Authentication token has expired. Please log in again.",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token signature",
      });
    }

    console.error("Authentication Middleware Error:", error);
    return res.status(500).json({
      success: false,
      message: "Authentication processing failed",
    });
  }
};

// Aliased export for legacy references
export const Authendication = Authentication;

/**
 * RBAC Granular Permission Authorization Middleware
 *
 * Verifies if the authenticated user's role has the required permission code,
 * possesses wildcard '*', or is a priority 1 (Owner).
 *
 * @param {string} requiredPermission - Permission code (e.g. 'attendance.punch_in', 'project.create')
 */
export const requirePermission = (requiredPermission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication context required",
      });
    }

    const permissions = req.user.permissions || [];

    // Owner (Priority 1) or Wildcard '*' has unrestricted access
    if (
      req.user.priority === 1 ||
      permissions.includes("*") ||
      permissions.includes(requiredPermission)
    ) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Access denied. Requires permission: '${requiredPermission}'`,
    });
  };
};

// Aliased export
export const checkPermission = requirePermission;

/**
 * Ownership or Permission Middleware (IDOR Defense)
 *
 * Grants access if:
 * 1. User is Owner (priority 1) or has wildcard '*'
 * 2. User has the broad permission (e.g. 'attendance.read.all')
 * 3. The target resource belongs to the user (req.params[paramKey] === req.user.id)
 *    AND user has the own permission (e.g. 'attendance.read.own')
 *
 * @param {string} paramKey - URL param containing target userId (e.g. 'userId', 'id', 'employeeId')
 * @param {string} ownPermission - Permission code required when accessing own data (e.g. 'attendance.read.own')
 * @param {string} allPermission - Permission code allowing access to any employee's data (e.g. 'attendance.read.all')
 */
export const requireOwnershipOrPermission = (paramKey, ownPermission, allPermission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication context required",
      });
    }

    // 1. Owner or Wildcard access
    if (req.user.priority === 1 || req.user.permissions?.includes("*")) {
      return next();
    }

    const permissions = req.user.permissions || [];

    // 2. Broad access (e.g. attendance.read.all)
    if (allPermission && permissions.includes(allPermission)) {
      return next();
    }

    // 3. Ownership check
    const targetId = req.params[paramKey] || req.body[paramKey];
    if (targetId && targetId.toString() === req.user.id.toString()) {
      if (!ownPermission || permissions.includes(ownPermission)) {
        return next();
      }
    }

    return res.status(403).json({
      success: false,
      message: `Access denied. Insufficient permissions to access this employee's resource.`,
    });
  };
};

/**
 * Admin Authority Authorization Middleware (Priority <= 2: Owner or Admin)
 */
export const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication context required",
    });
  }

  const userPriority = req.user.priority;
  if (
    userPriority === 1 ||
    userPriority === 2 ||
    req.user.permissions?.includes("*")
  ) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "Access denied. Administrative authority required.",
  });
};

/**
 * Module / Menu Access Authorization Middleware
 *
 * Checks if the user's role has access to the specified module/menu.
 */
export const checkMenuAccess = (requiredMenuCode) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.roleId) {
        return res.status(401).json({
          success: false,
          message: "Authentication context required",
        });
      }

      // Priority 1 or Wildcard grants all UI menus
      if (req.user.priority === 1 || req.user.permissions?.includes("*")) {
        return next();
      }

      // Check pre-loaded active menus from req.user
      if (req.user.menus?.includes(requiredMenuCode)) {
        return next();
      }

      // Fallback query if dynamic change occurred
      const menu = await Menu.findOne({
        menuCode: requiredMenuCode,
        isActive: true,
      }).select("_id");

      if (!menu) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Menu '${requiredMenuCode}' is not configured or inactive.`,
        });
      }

      const hasAccess = await RoleMenu.exists({
        roleId: req.user.roleId,
        menuId: menu._id,
      });

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Your role does not have access to module '${requiredMenuCode}'.`,
        });
      }

      next();
    } catch (error) {
      console.error("Menu Access Authorization Error:", error);
      return res.status(500).json({
        success: false,
        message: "Menu access authorization check failed",
      });
    }
  };
};

/**
 * Approval Authority Middleware
 */
export const checkApprovalAuthority = ({ minimumPriority = 4, allowSelfApproval = false } = {}) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication context required",
      });
    }

    const approverPriority = req.user.priority;
    const targetRequesterId = req.body?.requesterId || req.body?.employeeId;

    if (!allowSelfApproval && targetRequesterId && targetRequesterId.toString() === req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Self-approval is disabled for this workflow step.",
      });
    }

    if (approverPriority > minimumPriority) {
      return res.status(403).json({
        success: false,
        message: `Insufficient approval authority. Required priority level <= ${minimumPriority}, your priority is ${approverPriority}.`,
      });
    }

    next();
  };
};