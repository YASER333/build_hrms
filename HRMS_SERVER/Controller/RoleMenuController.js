import RoleMenu from "../Modules/RoleMenuModule.js";
import Role from "../Modules/RoleModules.js";
import Menu from "../Modules/MenuModule.js";
import mongoose from "mongoose";

// CREATE SINGLE MAPPING
export const createRoleMenu = async (req, res) => {
  try {
    const { roleId, menuId } = req.body;

    if (!roleId || !menuId) {
      return res.status(400).json({ success: false, message: "roleId & menuId required" });
    }

    if (
      !mongoose.Types.ObjectId.isValid(roleId) ||
      !mongoose.Types.ObjectId.isValid(menuId)
    ) {
      return res.status(400).json({ success: false, message: "Invalid roleId or menuId" });
    }

    const role = await Role.findById(roleId);
    const menu = await Menu.findById(menuId);

    if (!role || !menu) {
      return res.status(404).json({ success: false, message: "Role or Menu not found" });
    }

    const data = await RoleMenu.create({ roleId, menuId });

    return res.status(201).json({
      success: true,
      message: "RoleMenu mapped successfully",
      data
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "This role is already mapped to this menu"
      });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// BULK ASSIGN MENUS TO ROLE
export const bulkAssignRoleMenus = async (req, res) => {
  try {
    const { roleId, menuIds } = req.body;

    if (!roleId || !Array.isArray(menuIds)) {
      return res.status(400).json({
        success: false,
        message: "roleId and an array of menuIds are required"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(roleId)) {
      return res.status(400).json({ success: false, message: "Invalid roleId" });
    }

    const roleExists = await Role.findById(roleId);
    if (!roleExists) {
      return res.status(404).json({ success: false, message: "Role not found" });
    }

    // Validate menuIds
    for (const mId of menuIds) {
      if (!mongoose.Types.ObjectId.isValid(mId)) {
        return res.status(400).json({ success: false, message: `Invalid menuId: ${mId}` });
      }
    }

    // Replace all existing mappings for this roleId
    await RoleMenu.deleteMany({ roleId });

    if (menuIds.length === 0) {
      return res.status(200).json({
        success: true,
        message: "All menu mappings cleared for role",
        data: []
      });
    }

    const mappings = menuIds.map((menuId) => ({ roleId, menuId }));
    const created = await RoleMenu.insertMany(mappings);

    return res.status(201).json({
      success: true,
      message: "RoleMenu mapped successfully",
      data: created
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET ALL ROLE MENUS
export const getAllRoleMenus = async (req, res) => {
  try {
    const data = await RoleMenu.find()
      .populate("roleId")
      .populate("menuId")
      .lean();

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET MAPPED MENUS BY ROLE ID
export const getRoleMenusByRoleId = async (req, res) => {
  try {
    const { roleId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(roleId)) {
      return res.status(400).json({ success: false, message: "Invalid roleId" });
    }

    const data = await RoleMenu.find({ roleId })
      .populate("roleId")
      .populate("menuId")
      .lean();

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET BY MAPPING ID
export const getRoleMenuById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid RoleMenu ID" });
    }

    const data = await RoleMenu.findById(id)
      .populate("roleId")
      .populate("menuId")
      .lean();

    if (!data) {
      return res.status(404).json({ success: false, message: "RoleMenu mapping not found" });
    }

    return res.status(200).json({
      success: true,
      data
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// UPDATE (change role or menu mapping)
export const updateRoleMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const { roleId, menuId } = req.body;

    if (!roleId || !menuId) {
      return res.status(400).json({
        success: false,
        message: "roleId & menuId required"
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(id) ||
      !mongoose.Types.ObjectId.isValid(roleId) ||
      !mongoose.Types.ObjectId.isValid(menuId)
    ) {
      return res.status(400).json({ success: false, message: "Invalid ID(s)" });
    }

    const existingMapping = await RoleMenu.findOne({
      roleId,
      menuId,
      _id: { $ne: id }
    });

    if (existingMapping) {
      return res.status(400).json({
        success: false,
        message: "This role is already mapped to this menu"
      });
    }

    const data = await RoleMenu.findByIdAndUpdate(
      id,
      { roleId, menuId },
      { new: true }
    );

    if (!data) {
      return res.status(404).json({ success: false, message: "Mapping not found" });
    }

    return res.status(200).json({
      success: true,
      message: "RoleMenu updated successfully",
      data
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE
export const deleteRoleMenu = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid RoleMenu ID" });
    }

    const data = await RoleMenu.findByIdAndDelete(id);

    if (!data) {
      return res.status(404).json({ success: false, message: "Mapping not found" });
    }

    return res.status(200).json({
      success: true,
      message: "RoleMenu deleted successfully"
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
