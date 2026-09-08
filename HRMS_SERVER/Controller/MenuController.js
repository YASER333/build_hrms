import mongoose from 'mongoose';
import Menu from '../Modules/MenuModule.js';

// CREATE MENU
export const createMenu = async (req, res) => {
  try {
    const { menuName, menuCode, isActive, isBlock } = req.body;

    if (!menuName || !menuCode) {
      return res.status(400).json({
        success: false,
        message: "menuName and menuCode are required"
      });
    }

    const formattedCode = menuCode.trim().toUpperCase();

    const exMenu = await Menu.findOne({ menuCode: formattedCode });
    if (exMenu) {
      return res.status(409).json({
        success: false,
        message: "Menu code already exists"
      });
    }

    const newMenu = new Menu({
      menuName: menuName.trim(),
      menuCode: formattedCode,
      isActive: isActive !== undefined ? isActive : true,
      isBlock: isBlock !== undefined ? isBlock : false
    });

    const saveMenu = await newMenu.save();

    return res.status(201).json({
      success: true,
      message: "Menu created successfully",
      data: saveMenu
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET ALL MENUS
export const getAllMenu = async (req, res) => {
  try {
    const menus = await Menu.find().sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      success: true,
      data: menus
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET MENU BY ID
export const getMenuId = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid menu ID"
      });
    }

    const menu = await Menu.findById(id).lean();

    if (!menu) {
      return res.status(404).json({
        success: false,
        message: "Menu not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: menu
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE MENU
export const updateMenu = async (req, res) => {
  try {
    const id = req.params.id || req.body.id;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid menu ID"
      });
    }

    const updates = { ...req.body };
    delete updates.id;

    if (updates.menuCode) {
      updates.menuCode = updates.menuCode.trim().toUpperCase();

      const existingCode = await Menu.findOne({
        menuCode: updates.menuCode,
        _id: { $ne: id }
      });

      if (existingCode) {
        return res.status(409).json({
          success: false,
          message: "Menu code already exists"
        });
      }
    }

    const menu = await Menu.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    if (!menu) {
      return res.status(404).json({
        success: false,
        message: "Menu not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Menu updated successfully",
      data: menu
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE MENU
export const deleteMenu = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid menu ID"
      });
    }

    const menu = await Menu.findByIdAndDelete(id).lean();

    if (!menu) {
      return res.status(404).json({
        success: false,
        message: "Menu not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Menu deleted successfully"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};