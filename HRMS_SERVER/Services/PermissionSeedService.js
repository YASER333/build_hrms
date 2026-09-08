import Permission from "../Modules/PermissionModule.js";
import Role from "../Modules/RoleModules.js";
import Menu from "../Modules/MenuModule.js";
import RoleMenu from "../Modules/RoleMenuModule.js";
import RolePermission from "../Modules/RolePermissionModule.js";
import User from "../Modules/UserModule.js";

/**
 * Standard Permission Definitions Catalog
 */
export const STANDARD_PERMISSIONS = [
  // ── ATTENDANCE MODULE ──
  {
    permissionName: "Read Own Attendance",
    permissionCode: "attendance.read.own",
    module: "ATTENDANCE",
    description: "View own daily check-in times and attendance history",
  },
  {
    permissionName: "Read All Attendance",
    permissionCode: "attendance.read.all",
    module: "ATTENDANCE",
    description: "View attendance records and summaries for all employees",
  },
  {
    permissionName: "Punch In",
    permissionCode: "attendance.punch_in",
    module: "ATTENDANCE",
    description: "Record workday start time with geolocation",
  },
  {
    permissionName: "Punch Out",
    permissionCode: "attendance.punch_out",
    module: "ATTENDANCE",
    description: "Record workday end time and calculate total working hours",
  },
  {
    permissionName: "Read Team Attendance",
    permissionCode: "attendance.read.team",
    module: "ATTENDANCE",
    description: "View attendance records for team members and direct reports",
  },
  {
    permissionName: "Attendance Analytics",
    permissionCode: "attendance.analytics",
    module: "ATTENDANCE",
    description: "View organization-wide attendance analytics, metrics, and dashboards",
  },
  {
    permissionName: "Modify Attendance",
    permissionCode: "attendance.modify",
    module: "ATTENDANCE",
    description: "Adjust or correct employee check-in/out timestamps and status with audit trail",
  },
  {
    permissionName: "View Attendance Audit",
    permissionCode: "attendance.audit",
    module: "ATTENDANCE",
    description: "View correction audit history for attendance records",
  },

  // ── PROJECTS MODULE ──
  {
    permissionName: "Read Projects",
    permissionCode: "project.read",
    module: "PROJECTS",
    description: "View project details, sprints, tasks, and team rosters",
  },
  {
    permissionName: "Create Project",
    permissionCode: "project.create",
    module: "PROJECTS",
    description: "Create new projects and configure milestones",
  },
  {
    permissionName: "Update Project",
    permissionCode: "project.update",
    module: "PROJECTS",
    description: "Edit project parameters, descriptions, and timelines",
  },
  {
    permissionName: "Delete Project",
    permissionCode: "project.delete",
    module: "PROJECTS",
    description: "Permanently delete projects and associated boards",
  },
  {
    permissionName: "Add Project Member",
    permissionCode: "project.add_member",
    module: "PROJECTS",
    description: "Assign developers, leads, and managers to projects",
  },
  {
    permissionName: "Remove Project Member",
    permissionCode: "project.remove_member",
    module: "PROJECTS",
    description: "Remove team members from projects",
  },

  // ── ROLE MANAGEMENT MODULE ──
  {
    permissionName: "Read Roles",
    permissionCode: "role.read",
    module: "ROLE_MANAGEMENT",
    description: "View role list, permissions, and menu assignments",
  },
  {
    permissionName: "Create Custom Role",
    permissionCode: "role.create",
    module: "ROLE_MANAGEMENT",
    description: "Create custom roles with specific modules and granular permissions",
  },
  {
    permissionName: "Update Role",
    permissionCode: "role.update",
    module: "ROLE_MANAGEMENT",
    description: "Modify role metadata, menu access, and permission mappings",
  },
  {
    permissionName: "Delete Role",
    permissionCode: "role.delete",
    module: "ROLE_MANAGEMENT",
    description: "Delete custom roles not in use",
  },

  // ── ONBOARDING MODULE ──
  {
    permissionName: "Read Onboarding",
    permissionCode: "onboarding.read",
    module: "USER_MANAGEMENT",
    description: "View candidate onboarding progress and draft records",
  },
  {
    permissionName: "Create Onboarding",
    permissionCode: "onboarding.create",
    module: "USER_MANAGEMENT",
    description: "Initiate employee onboarding flow",
  },
  {
    permissionName: "Update Onboarding",
    permissionCode: "onboarding.update",
    module: "USER_MANAGEMENT",
    description: "Update onboarding candidate documents and details",
  },
  {
    permissionName: "Complete Onboarding",
    permissionCode: "onboarding.complete",
    module: "USER_MANAGEMENT",
    description: "Complete employee onboarding process",
  },

  // ── USER MANAGEMENT MODULE ──
  {
    permissionName: "Read All Users",
    permissionCode: "user.read",
    module: "USER_MANAGEMENT",
    description: "Browse employee directory and profiles",
  },
  {
    permissionName: "Read Own Profile",
    permissionCode: "user.read_own",
    module: "USER_MANAGEMENT",
    description: "View and edit personal profile information",
  },
  {
    permissionName: "Create User",
    permissionCode: "user.create",
    module: "USER_MANAGEMENT",
    description: "Onboard new employees and generate system credentials",
  },
  {
    permissionName: "Update User",
    permissionCode: "user.update",
    module: "USER_MANAGEMENT",
    description: "Edit user profile attributes and status",
  },
  {
    permissionName: "Delete User",
    permissionCode: "user.delete",
    module: "USER_MANAGEMENT",
    description: "Deactivate or delete user accounts",
  },
  {
    permissionName: "Manage User Roles",
    permissionCode: "user.manage_roles",
    module: "USER_MANAGEMENT",
    description: "Assign or modify roles assigned to users",
  },
  {
    permissionName: "Provision Login Account",
    permissionCode: "user.provision_account",
    module: "USER_MANAGEMENT",
    description: "Provision system login accounts and credentials for onboarded employees",
  },
  {
    permissionName: "Manage Account Status",
    permissionCode: "user.manage_status",
    module: "USER_MANAGEMENT",
    description: "Activate, deactivate, or block employee login accounts",
  },

  // ── LEAVE MANAGEMENT MODULE ──
  {
    permissionName: "Read Own Leaves",
    permissionCode: "leave.read.own",
    module: "LEAVE_MGMT",
    description: "View personal leave applications and balance",
  },
  {
    permissionName: "Create Own Leave",
    permissionCode: "leave.create.own",
    module: "LEAVE_MGMT",
    description: "Submit personal leave requests for review",
  },
  {
    permissionName: "Apply Leave",
    permissionCode: "leave.apply",
    module: "LEAVE_MGMT",
    description: "Submit leave requests for review",
  },
  {
    permissionName: "Cancel Own Leave",
    permissionCode: "leave.cancel.own",
    module: "LEAVE_MGMT",
    description: "Cancel own pending leave requests",
  },
  {
    permissionName: "Cancel Leave",
    permissionCode: "leave.cancel",
    module: "LEAVE_MGMT",
    description: "Cancel own pending leave requests",
  },
  {
    permissionName: "Read Team Leaves",
    permissionCode: "leave.read.team",
    module: "LEAVE_MGMT",
    description: "View leave requests for team members and direct reports",
  },
  {
    permissionName: "Read All Leaves",
    permissionCode: "leave.read.all",
    module: "LEAVE_MGMT",
    description: "View company-wide leave requests and team calendar",
  },
  {
    permissionName: "Approve Leave",
    permissionCode: "leave.approve",
    module: "LEAVE_MGMT",
    description: "Approve employee leave applications",
  },
  {
    permissionName: "Reject Leave",
    permissionCode: "leave.reject",
    module: "LEAVE_MGMT",
    description: "Reject employee leave applications",
  },
  {
    permissionName: "Manage Leaves",
    permissionCode: "leave.manage",
    module: "LEAVE_MGMT",
    description: "Administrative leave management and escalation",
  },
  {
    permissionName: "View Leave Audit",
    permissionCode: "leave.audit",
    module: "LEAVE_MGMT",
    description: "View leave workflow status audit history",
  },

  // ── ASSET MANAGEMENT MODULE ──
  {
    permissionName: "Read Assets",
    permissionCode: "asset.read",
    module: "ASSET",
    description: "View company asset inventory and allocations",
  },
  {
    permissionName: "Create Asset",
    permissionCode: "asset.create",
    module: "ASSET",
    description: "Add new assets to the company inventory",
  },
  {
    permissionName: "Assign Asset",
    permissionCode: "asset.assign",
    module: "ASSET",
    description: "Allocate inventory assets to employees",
  },
  {
    permissionName: "Return Asset",
    permissionCode: "asset.return",
    module: "ASSET",
    description: "Process return of assigned assets back to inventory",
  },
];

export const STANDARD_MENUS = [
  { menuName: "Dashboard", menuCode: "DASHBOARD" },
  { menuName: "Attendance", menuCode: "ATTENDANCE" },
  { menuName: "Projects", menuCode: "PROJECTS" },
  { menuName: "HR Onboarding", menuCode: "USER_MANAGEMENT" },
  { menuName: "Organisation", menuCode: "ORGANISATION" },
  { menuName: "Leave Request", menuCode: "LEAVE_MGMT" },
  { menuName: "Payslip", menuCode: "PAYSLIP" },
  { menuName: "EPFO", menuCode: "EPFO" },
  { menuName: "MIS", menuCode: "MIS" },
  { menuName: "Assets", menuCode: "ASSETS" },
];

/**
 * Seed all standard permissions, menus, and standard role permissions safely.
 * Non-destructive: creates missing records without overwriting custom data.
 */
export const seedRBACFoundation = async () => {
  try {
    // 1. Seed Permissions
    const seededPermissions = [];
    for (const perm of STANDARD_PERMISSIONS) {
      const doc = await Permission.findOneAndUpdate(
        { permissionCode: perm.permissionCode },
        {
          $set: {
            permissionName: perm.permissionName,
            module: perm.module,
            description: perm.description,
            isActive: true,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      seededPermissions.push(doc);
    }

    // 2. Seed Menus
    const seededMenus = [];
    for (const m of STANDARD_MENUS) {
      let menuDoc = await Menu.findOne({ menuCode: m.menuCode });
      if (!menuDoc) {
        menuDoc = await Menu.create({
          menuName: m.menuName,
          menuCode: m.menuCode,
          isActive: true,
          isBlock: false,
        });
      }
      seededMenus.push(menuDoc);
    }

    // 3. Ensure Standard Roles exist
    let ownerRole = await Role.findOne({ $or: [{ priority: 1 }, { roleCode: "OWNER" }] });
    if (!ownerRole) {
      ownerRole = await Role.create({
        roleName: "Owner",
        roleCode: "OWNER",
        priority: 1,
        isSystemRole: true,
        description: "Primary system administrator with unrestricted access",
      });
    }

    let adminRole = await Role.findOne({ $or: [{ priority: 2 }, { roleCode: "ADMIN" }] });
    if (!adminRole) {
      adminRole = await Role.create({
        roleName: "Admin",
        roleCode: "ADMIN",
        priority: 2,
        isSystemRole: true,
        description: "Administrative authority with full organizational access",
      });
    }

    let employeeRole = await Role.findOne({
      $or: [{ roleCode: "EMPLOYEE" }, { roleName: /^Employee/i }],
    });
    if (!employeeRole) {
      employeeRole = await Role.create({
        roleName: "Employee",
        roleCode: "EMPLOYEE",
        priority: 3,
        isSystemRole: true,
        description: "Standard employee role with self-service access",
      });
    }

    let projectManagerRole = await Role.findOne({
      $or: [{ roleCode: "PROJECT_MANAGER" }, { roleName: /^Project Manager/i }],
    });
    if (!projectManagerRole) {
      projectManagerRole = await Role.create({
        roleName: "Project Manager",
        roleCode: "PROJECT_MANAGER",
        priority: 3,
        isSystemRole: true,
        isActive: true,
        isBlock: false,
        isBlocked: false,
        description: "Protected standard Project Manager role with complete project management capabilities and standard employee self-service access",
      });
    } else {
      projectManagerRole.roleName = "Project Manager";
      projectManagerRole.roleCode = "PROJECT_MANAGER";
      projectManagerRole.priority = 3;
      projectManagerRole.isSystemRole = true;
      projectManagerRole.isActive = true;
      projectManagerRole.isBlock = false;
      projectManagerRole.isBlocked = false;
      projectManagerRole.description = "Protected standard Project Manager role with complete project management capabilities and standard employee self-service access";
      await projectManagerRole.save();
    }

    // HR Role Seeding / Migration to Protected Standard System Role
    const hrPermCodes = [
      "user.read",
      "user.read_own",
      "user.provision_account",
      "user.manage_status",
      "onboarding.read",
      "onboarding.create",
      "onboarding.update",
      "onboarding.complete",
      "attendance.read.all",
      "attendance.read.own",
      "attendance.read.team",
      "attendance.punch_in",
      "attendance.punch_out",
      "asset.read",
      "asset.create",
      "asset.assign",
      "asset.return",
      "leave.read.own",
      "leave.create.own",
      "leave.apply",
      "leave.cancel.own",
      "leave.cancel",
      "leave.read.team",
      "leave.approve",
      "leave.reject",
    ];

    const existingHrRoles = await Role.find({
      $or: [{ roleCode: "HR" }, { roleName: /^HR/i }],
    }).sort({ createdAt: 1 });

    let hrRole = null;
    if (existingHrRoles.length > 0) {
      hrRole = existingHrRoles[0];
      hrRole.roleName = "HR";
      hrRole.roleCode = "HR";
      hrRole.priority = 3;
      hrRole.isSystemRole = true;
      hrRole.isActive = true;
      hrRole.isBlock = false;
      hrRole.isBlocked = false;
      hrRole.description = "Protected standard HR role with employee onboarding, account provisioning, attendance management, and asset allocation";
      await hrRole.save();

      // Clean up duplicate HR roles if any exist, reassigning users to the primary hrRole
      if (existingHrRoles.length > 1) {
        for (let i = 1; i < existingHrRoles.length; i++) {
          const dupRole = existingHrRoles[i];
          await User.updateMany({ role: dupRole._id }, { $set: { role: hrRole._id } });
          await RoleMenu.deleteMany({ roleId: dupRole._id });
          await RolePermission.deleteMany({ roleId: dupRole._id });
          await Role.deleteOne({ _id: dupRole._id });
        }
      }
    } else {
      hrRole = await Role.create({
        roleName: "HR",
        roleCode: "HR",
        priority: 3,
        isSystemRole: true,
        isActive: true,
        isBlock: false,
        isBlocked: false,
        description: "Protected standard HR role with employee onboarding, account provisioning, attendance management, and asset allocation",
      });
    }

    // 4. Map Menus to Roles
    // Owner & Admin get all menus
    for (const menu of seededMenus) {
      if (ownerRole) {
        await RoleMenu.findOneAndUpdate(
          { roleId: ownerRole._id, menuId: menu._id },
          { $setOnInsert: { roleId: ownerRole._id, menuId: menu._id } },
          { upsert: true }
        );
      }
      if (adminRole) {
        await RoleMenu.findOneAndUpdate(
          { roleId: adminRole._id, menuId: menu._id },
          { $setOnInsert: { roleId: adminRole._id, menuId: menu._id } },
          { upsert: true }
        );
      }
    }

    // HR gets DASHBOARD, ATTENDANCE, USER_MANAGEMENT, ASSETS, LEAVE_MGMT
    const hrMenuCodes = ["DASHBOARD", "ATTENDANCE", "USER_MANAGEMENT", "ASSETS", "LEAVE_MGMT"];
    const hrMenus = seededMenus.filter((m) => hrMenuCodes.includes(m.menuCode));
    if (hrRole) {
      // Remove any unwanted menus from HR
      const unwantedMenus = seededMenus.filter((m) => !hrMenuCodes.includes(m.menuCode));
      if (unwantedMenus.length > 0) {
        await RoleMenu.deleteMany({
          roleId: hrRole._id,
          menuId: { $in: unwantedMenus.map((m) => m._id) },
        });
      }
      for (const menu of hrMenus) {
        await RoleMenu.findOneAndUpdate(
          { roleId: hrRole._id, menuId: menu._id },
          { $setOnInsert: { roleId: hrRole._id, menuId: menu._id } },
          { upsert: true }
        );
      }
    }

    // Employee gets Attendance, Projects, Dashboard, Leave
    const employeeMenuCodes = ["DASHBOARD", "ATTENDANCE", "PROJECTS", "LEAVE_MGMT"];
    const employeeMenus = seededMenus.filter((m) => employeeMenuCodes.includes(m.menuCode));
    if (employeeRole) {
      for (const menu of employeeMenus) {
        await RoleMenu.findOneAndUpdate(
          { roleId: employeeRole._id, menuId: menu._id },
          { $setOnInsert: { roleId: employeeRole._id, menuId: menu._id } },
          { upsert: true }
        );
      }
    }

    // Project Manager gets Attendance, Projects, Dashboard, Leave
    if (projectManagerRole) {
      for (const menu of employeeMenus) {
        await RoleMenu.findOneAndUpdate(
          { roleId: projectManagerRole._id, menuId: menu._id },
          { $setOnInsert: { roleId: projectManagerRole._id, menuId: menu._id } },
          { upsert: true }
        );
      }
    }

    // 5. Map Permissions to Roles in RolePermission collection (Single Source of Truth)
    // Owner & Admin get all permissions
    for (const perm of seededPermissions) {
      if (ownerRole) {
        await RolePermission.findOneAndUpdate(
          { roleId: ownerRole._id, permissionId: perm._id },
          { $setOnInsert: { roleId: ownerRole._id, permissionId: perm._id } },
          { upsert: true }
        );
      }
      if (adminRole) {
        await RolePermission.findOneAndUpdate(
          { roleId: adminRole._id, permissionId: perm._id },
          { $setOnInsert: { roleId: adminRole._id, permissionId: perm._id } },
          { upsert: true }
        );
      }
    }

    // Clean up obsolete/prohibited permissions from RolePermission collection for HR
    const prohibitedPermCodes = [
      "user.manage_roles",
      "role.create",
      "role.update",
      "role.delete",
      "permission.manage",
      "role_permission.manage",
      "*",
    ];
    const prohibitedPermDocs = await Permission.find({ permissionCode: { $in: prohibitedPermCodes } });
    if (prohibitedPermDocs.length > 0 && hrRole) {
      await RolePermission.deleteMany({
        roleId: hrRole._id,
        permissionId: { $in: prohibitedPermDocs.map((p) => p._id) },
      });
    }

    // HR gets HR permissions
    const hrPermDocs = seededPermissions.filter((p) => hrPermCodes.includes(p.permissionCode));
    if (hrRole) {
      for (const perm of hrPermDocs) {
        await RolePermission.findOneAndUpdate(
          { roleId: hrRole._id, permissionId: perm._id },
          { $setOnInsert: { roleId: hrRole._id, permissionId: perm._id } },
          { upsert: true }
        );
      }
    }

    // Employee gets employee permissions
    const employeePermCodes = [
      "attendance.read.own",
      "attendance.punch_in",
      "attendance.punch_out",
      "project.read",
      "user.read_own",
      "leave.read.own",
      "leave.create.own",
      "leave.apply",
      "leave.cancel.own",
      "leave.cancel",
    ];
    const employeePermDocs = seededPermissions.filter((p) =>
      employeePermCodes.includes(p.permissionCode)
    );

    if (employeeRole) {
      for (const perm of employeePermDocs) {
        await RolePermission.findOneAndUpdate(
          { roleId: employeeRole._id, permissionId: perm._id },
          { $setOnInsert: { roleId: employeeRole._id, permissionId: perm._id } },
          { upsert: true }
        );
      }
    }

    // Project Manager gets base employee permissions + ALL project permissions
    const projectManagerPermCodes = [
      "attendance.read.own",
      "attendance.punch_in",
      "attendance.punch_out",
      "user.read_own",
      "leave.read.own",
      "leave.create.own",
      "leave.apply",
      "leave.cancel.own",
      "leave.cancel",
      "project.read",
      "project.create",
      "project.update",
      "project.delete",
      "project.add_member",
      "project.remove_member",
    ];
    const projectManagerPermDocs = seededPermissions.filter((p) =>
      projectManagerPermCodes.includes(p.permissionCode)
    );

    if (projectManagerRole) {
      for (const perm of projectManagerPermDocs) {
        await RolePermission.findOneAndUpdate(
          { roleId: projectManagerRole._id, permissionId: perm._id },
          { $setOnInsert: { roleId: projectManagerRole._id, permissionId: perm._id } },
          { upsert: true }
        );
      }
    }

    // 6. Safe Data Migration: ensure all legacy Role.permissions are migrated to RolePermission
    const allExistingRawRoles = await Role.collection.find({}).toArray();
    for (const r of allExistingRawRoles) {
      if (Array.isArray(r.permissions) && r.permissions.length > 0) {
        const legacyCodes = r.permissions.filter((c) => c !== "*");
        if (legacyCodes.length > 0) {
          const matchingPerms = await Permission.find({ permissionCode: { $in: legacyCodes }, isActive: true }).select("_id");
          for (const mp of matchingPerms) {
            await RolePermission.findOneAndUpdate(
              { roleId: r._id, permissionId: mp._id },
              { $setOnInsert: { roleId: r._id, permissionId: mp._id } },
              { upsert: true }
            );
          }
        }
      }
    }

    // Remove deprecated permissions field from all Role documents in MongoDB directly
    await Role.collection.updateMany({}, { $unset: { permissions: "" } });

    // 7. Ensure existing active users have hasLoginAccess: true
    await User.updateMany(
      { hasLoginAccess: { $exists: false }, isActive: true },
      { $set: { hasLoginAccess: true } }
    );

    console.log("RBAC Foundation seeded successfully (Permissions, Menus, Role Mappings - RolePermission is Single Source of Truth).");
    return { success: true, permissionsCount: seededPermissions.length, menusCount: seededMenus.length };
  } catch (error) {
    console.error("RBAC Seeding Error:", error);
    return { success: false, error: error.message };
  }
};
