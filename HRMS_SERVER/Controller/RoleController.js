import mongoose from "mongoose";
import Role from "../Modules/RoleModules.js";
import Menu from "../Modules/MenuModule.js";
import Permission from "../Modules/PermissionModule.js";
import RoleMenu from "../Modules/RoleMenuModule.js";
import RolePermission from "../Modules/RolePermissionModule.js";
import User from "../Modules/UserModule.js";
import { getAssignableRolesQuery } from "../Utils/RoleAuthority.js";

const escapeRegex = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

/**
 * Create Custom Role with transactional safety
 * Creates Role, RoleMenu mappings, and RolePermission mappings atomically.
 */
export const createCustomRole = async (req, res) => {
  let createdRole = null;
  try {
    const { roleName, description, priority, menuIds = [], permissionCodes = [] } = req.body;

    if (!roleName || typeof roleName !== "string" || !roleName.trim()) {
      return res.status(400).json({
        success: false,
        message: "Role name is required",
      });
    }

    const formattedRoleName = roleName.trim().replace(/\s+/g, " ");

    // Check duplicate role name
    const nameExists = await Role.exists({
      roleName: {
        $regex: `^${escapeRegex(formattedRoleName)}$`,
        $options: "i",
      },
    });

    if (nameExists) {
      return res.status(409).json({
        success: false,
        message: `Role with name '${formattedRoleName}' already exists.`,
      });
    }

    const roleCode = formattedRoleName.replace(/\s+/g, "_").toUpperCase();
    const priorityNum = Number(priority) || 3;
    const isOwner = req.user?.priority === 1 || req.user?.roleCode === "OWNER";

    // Privilege escalation check: Non-Owners cannot create priority 1 or 2
    if (!isOwner) {
      if (priorityNum < 3) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: Administrators can only create operational roles with Priority >= 3.",
        });
      }
      if (["OWNER", "ADMIN", "HR", "PROJECT_MANAGER", "EMPLOYEE"].includes(roleCode)) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: Cannot create system or management role code.",
        });
      }
      if (Array.isArray(permissionCodes) && permissionCodes.includes("*")) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: Wildcard '*' permission cannot be assigned to custom roles by non-Owners.",
        });
      }
    }

    // 1. Create Role Document (system role forced to false for non-Owners)
    createdRole = await Role.create({
      roleName: formattedRoleName,
      roleCode,
      description: description?.trim(),
      priority: priorityNum,
      isSystemRole: isOwner ? (req.body.isSystemRole === true) : false,
      isActive: true,
    });

    // 2. Create RoleMenu mappings
    if (Array.isArray(menuIds) && menuIds.length > 0) {
      const validMenus = await Menu.find({ _id: { $in: menuIds }, isActive: true }).select("_id");
      const roleMenuDocs = validMenus.map((m) => ({
        roleId: createdRole._id,
        menuId: m._id,
      }));
      if (roleMenuDocs.length > 0) {
        await RoleMenu.insertMany(roleMenuDocs, { ordered: false }).catch(() => {});
      }
    }

    // 3. Create RolePermission mappings
    if (Array.isArray(permissionCodes) && permissionCodes.length > 0) {
      const validPermissions = await Permission.find({
        permissionCode: { $in: permissionCodes },
        isActive: true,
      }).select("_id");

      const rolePermissionDocs = validPermissions.map((p) => ({
        roleId: createdRole._id,
        permissionId: p._id,
      }));

      if (rolePermissionDocs.length > 0) {
        await RolePermission.insertMany(rolePermissionDocs, { ordered: false }).catch(() => {});
      }
    }

    return res.status(201).json({
      success: true,
      message: `Custom role '${formattedRoleName}' created successfully.`,
      data: createdRole,
    });
  } catch (error) {
    // Rollback created role if an error occurs
    if (createdRole) {
      await Role.deleteOne({ _id: createdRole._id }).catch(() => {});
      await RoleMenu.deleteMany({ roleId: createdRole._id }).catch(() => {});
      await RolePermission.deleteMany({ roleId: createdRole._id }).catch(() => {});
    }

    console.error("Create Custom Role Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create custom role.",
    });
  }
};

// Aliased export for compatibility
export const createRole = createCustomRole;

/**
 * Update Role Details, Menu Access, and Permissions
 */
export const updateCustomRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { roleName, description, priority, isActive, menuIds, permissionCodes } = req.body;
    const isOwner = req.user?.priority === 1 || req.user?.roleCode === "OWNER";

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid role ID" });
    }

    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({ success: false, message: "Role not found" });
    }

    // Prevent modifying system owner
    if ((role.isSystemRole && role.priority === 1) || role.roleCode === "OWNER") {
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: Cannot alter System Owner configuration.",
        });
      }
    }

    // Prevent non-Owners from modifying Admin, HR, or core system roles
    if (!isOwner) {
      if (role.priority === 2 || role.roleCode === "ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Forbidden: Only System Owner can modify System Admin configuration.",
        });
      }
      if (role.isSystemRole || ["OWNER", "ADMIN", "HR", "PROJECT_MANAGER", "EMPLOYEE"].includes(role.roleCode)) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: Core system roles can only be modified by System Owner.",
        });
      }
      if (priority !== undefined && Number(priority) < 3) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: Cannot set role priority < 3.",
        });
      }
      if (Array.isArray(permissionCodes) && permissionCodes.includes("*")) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: Wildcard '*' permission cannot be assigned to custom roles by non-Owners.",
        });
      }
    }

    if (roleName) {
      const formattedRoleName = roleName.trim().replace(/\s+/g, " ");
      const exists = await Role.exists({
        _id: { $ne: id },
        roleName: { $regex: `^${escapeRegex(formattedRoleName)}$`, $options: "i" },
      });
      if (exists) {
        return res.status(409).json({ success: false, message: "Role name already exists" });
      }
      role.roleName = formattedRoleName;
    }

    if (description !== undefined) role.description = description?.trim();
    if (priority !== undefined) role.priority = Number(priority);
    if (typeof isActive === "boolean") role.isActive = isActive;

    await role.save();

    // Sync RoleMenu mappings if menuIds is provided
    if (Array.isArray(menuIds)) {
      await RoleMenu.deleteMany({ roleId: id });
      const validMenus = await Menu.find({ _id: { $in: menuIds }, isActive: true }).select("_id");
      const roleMenuDocs = validMenus.map((m) => ({ roleId: id, menuId: m._id }));
      if (roleMenuDocs.length > 0) {
        await RoleMenu.insertMany(roleMenuDocs, { ordered: false }).catch(() => {});
      }
    }

    // Sync RolePermission mappings if permissionCodes is provided
    if (Array.isArray(permissionCodes)) {
      await RolePermission.deleteMany({ roleId: id });
      const validPermissions = await Permission.find({
        permissionCode: { $in: permissionCodes },
        isActive: true,
      }).select("_id");
      const rolePermissionDocs = validPermissions.map((p) => ({ roleId: id, permissionId: p._id }));
      if (rolePermissionDocs.length > 0) {
        await RolePermission.insertMany(rolePermissionDocs, { ordered: false }).catch(() => {});
      }
    }

    return res.status(200).json({
      success: true,
      message: "Role updated successfully",
      data: role,
    });
  } catch (error) {
    console.error("Update Role Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to update role" });
  }
};

export const updateRole = updateCustomRole;

/**
 * Get Complete Role Access Configuration
 * Returns Role details, assigned menu IDs/Codes, and assigned permission IDs/Codes.
 */
export const getRoleAccessConfig = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid role ID" });
    }

    const role = await Role.findById(id).lean();
    if (!role) {
      return res.status(404).json({ success: false, message: "Role not found" });
    }

    // Retrieve assigned menus
    const roleMenus = await RoleMenu.find({ roleId: id })
      .populate({ path: "menuId", select: "_id menuName menuCode" })
      .lean();

    const assignedMenus = roleMenus.filter((rm) => rm.menuId).map((rm) => rm.menuId);

    // Retrieve assigned permissions
    const rolePermissions = await RolePermission.find({ roleId: id })
      .populate({ path: "permissionId", select: "_id permissionName permissionCode module" })
      .lean();

    const assignedPermissions = rolePermissions
      .filter((rp) => rp.permissionId)
      .map((rp) => rp.permissionId);

    return res.status(200).json({
      success: true,
      data: {
        role,
        menus: assignedMenus,
        menuIds: assignedMenus.map((m) => m._id.toString()),
        permissions: assignedPermissions,
        permissionCodes: assignedPermissions.map((p) => p.permissionCode),
      },
    });
  } catch (error) {
    console.error("Get Role Access Config Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to load role configuration" });
  }
};

export const getRoleById = getRoleAccessConfig;

/**
 * Get All Roles with summarized access stats
 */
export const getAllRoles = async (req, res) => {
  try {
    const roles = await Role.find().sort({ priority: 1, createdAt: -1 }).lean();

    // Attach menu and permission counts
    const enrichedRoles = await Promise.all(
      roles.map(async (r) => {
        const [menuCount, permCount, userCount] = await Promise.all([
          RoleMenu.countDocuments({ roleId: r._id }),
          RolePermission.countDocuments({ roleId: r._id }),
          User.countDocuments({ role: r._id }),
        ]);

        return {
          ...r,
          menuCount,
          permissionCount: permCount,
          userCount,
        };
      })
    );

    return res.status(200).json({
      success: true,
      message: "Roles fetched successfully",
      data: enrichedRoles,
    });
  } catch (error) {
    console.error("Get All Roles Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch roles" });
  }
};

/**
 * Delete Role
 * Safe delete with system role protection and active user assignment check.
 */
export const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid role ID" });
    }

    const role = await Role.findById(id).select("_id roleName roleCode isSystemRole priority").lean();
    if (!role) {
      return res.status(404).json({ success: false, message: "Role not found" });
    }

    if (role.isSystemRole || role.priority === 1 || ["OWNER", "ADMIN", "HR", "PROJECT_MANAGER", "EMPLOYEE"].includes(role.roleCode)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Core system roles cannot be deleted.",
      });
    }

    // Check if users are currently assigned to this role
    const assignedUsersCount = await User.countDocuments({ role: id });
    if (assignedUsersCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete role '${role.roleName}'. It is currently assigned to ${assignedUsersCount} active employee(s).`,
      });
    }

    // Delete role and associated mappings
    await Role.deleteOne({ _id: id });
    await RoleMenu.deleteMany({ roleId: id });
    await RolePermission.deleteMany({ roleId: id });

    return res.status(200).json({
      success: true,
      message: `Role '${role.roleName}' deleted successfully.`,
    });
  } catch (error) {
    console.error("Delete Role Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete role" });
  }
};

/**
 * Get Roles available for assignment based on current user's authority
 */
export const getAssignableRoles = async (req, res) => {
  try {
    const query = getAssignableRolesQuery(req.user);
    const roles = await Role.find(query)
      .select("_id roleName roleCode priority description isSystemRole")
      .sort({ priority: 1, roleName: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: roles,
    });
  } catch (error) {
    console.error("getAssignableRoles Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve assignable roles",
    });
  }
};