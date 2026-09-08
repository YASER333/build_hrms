/**
 * Centralized Role Authority & Assignment Security Rules
 */

/**
 * Validates whether the requesting user has the authority to assign a given target role.
 *
 * Rules:
 * 1. Owner (priority === 1, roleCode === "OWNER"): Has full authority, can assign any role.
 * 2. Admin (priority === 2, roleCode === "ADMIN"): Can assign HR, Employee, and custom operational roles (priority > 2).
 *    CANNOT assign Owner (priority === 1) or Admin (priority === 2).
 * 3. HR (with user.provision_account): Can assign ONLY Employee and approved non-management operational roles (priority >= 3).
 *    CANNOT assign Owner, Admin, HR, or other system roles.
 * 4. Normal Employee / Unauthorized user: Cannot assign any role.
 */
export const canAssignRole = (requestingUser, targetRole) => {
  if (!requestingUser || !targetRole) return false;

  const reqPriority = requestingUser.priority;
  const targetPriority = targetRole.priority;
  const reqRoleCode = requestingUser.roleCode;
  const targetRoleCode = targetRole.roleCode;
  const isTargetSystemRole = targetRole.isSystemRole === true;

  // 1. System Owner has full system authority
  if (reqPriority === 1 || reqRoleCode === "OWNER") {
    return true;
  }

  // 2. Target role is Owner (priority === 1) -> ONLY Owner can assign it
  if (targetPriority === 1 || targetRoleCode === "OWNER") {
    return false;
  }

  // 3. Target role is Admin (priority === 2) -> ONLY Owner can assign it (Admin cannot create/assign Admin)
  if (targetPriority === 2 || targetRoleCode === "ADMIN") {
    return false;
  }

  // 4. Admin (priority === 2) can assign HR, Employee, and custom operational roles (priority > 2)
  if (reqPriority === 2 || reqRoleCode === "ADMIN") {
    return targetPriority > 2 && targetRoleCode !== "ADMIN" && targetRoleCode !== "OWNER";
  }

  // 5. HR / Provisioning user (with user.provision_account)
  if (requestingUser.permissions?.includes("user.provision_account")) {
    // HR can ONLY assign standard EMPLOYEE
    return targetRoleCode === "EMPLOYEE";
  }

  return false;
};

/**
 * Returns a MongoDB query filter for roles the requesting user is allowed to assign.
 */
export const getAssignableRolesQuery = (requestingUser) => {
  if (!requestingUser) return { _id: null };

  const reqPriority = requestingUser.priority;
  const reqRoleCode = requestingUser.roleCode;

  // Owner: All active roles
  if (reqPriority === 1 || reqRoleCode === "OWNER") {
    return { isActive: { $ne: false } };
  }

  // Admin: All active roles except Owner & Admin (includes HR, Employee, custom operational roles)
  if (reqPriority === 2 || reqRoleCode === "ADMIN") {
    return {
      isActive: { $ne: false },
      priority: { $gt: 2 },
      roleCode: { $nin: ["OWNER", "ADMIN"] },
    };
  }

  // HR / Provisioning: Strictly standard EMPLOYEE role only
  if (requestingUser.permissions?.includes("user.provision_account")) {
    return {
      isActive: { $ne: false },
      roleCode: "EMPLOYEE",
    };
  }

  return { _id: null };
};

/**
 * Validates whether the requesting user is allowed to modify the target user account
 * (e.g. update account status, reset password, delete account).
 */
export const canModifyUserAccount = (requestingUser, targetUserRole) => {
  if (!requestingUser || !targetUserRole) return false;

  const reqPriority = requestingUser.priority;
  const targetPriority = targetUserRole.priority;
  const reqRoleCode = requestingUser.roleCode;
  const targetRoleCode = targetUserRole.roleCode;

  // 1. Owner can modify any account
  if (reqPriority === 1 || reqRoleCode === "OWNER") {
    return true;
  }

  // 2. Non-Owner CANNOT modify Owner account
  if (targetPriority === 1 || targetRoleCode === "OWNER") {
    return false;
  }

  // 3. Non-Owner CANNOT modify Admin account (Admin cannot modify Admin account)
  if (targetPriority === 2 || targetRoleCode === "ADMIN") {
    return false;
  }

  // 4. Admin can modify HR, Employee, and custom operational accounts (priority > 2, not Admin/Owner)
  if (reqPriority === 2 || reqRoleCode === "ADMIN") {
    return targetPriority > 2 && targetRoleCode !== "ADMIN" && targetRoleCode !== "OWNER";
  }

  // 5. HR can modify standard employee and operational accounts (priority >= 3, not HR/Admin/Owner)
  if (
    requestingUser.permissions?.includes("user.manage_status") ||
    requestingUser.permissions?.includes("user.provision_account")
  ) {
    // HR cannot modify another HR account
    if (targetRoleCode === "HR") {
      return false;
    }
    return targetPriority >= 3 && targetRoleCode !== "ADMIN" && targetRoleCode !== "OWNER";
  }

  return false;
};
