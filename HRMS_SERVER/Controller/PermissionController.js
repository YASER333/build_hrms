import Permission from "../Modules/PermissionModule.js";

/**
 * Get Permission Catalog grouped by Module
 * Used by frontend Custom Role Creator to render module checkboxes and granular action rights.
 */
export const getPermissionCatalog = async (req, res) => {
  try {
    const permissions = await Permission.find({ isActive: true })
      .sort({ module: 1, permissionName: 1 })
      .lean();

    // Group by module
    const catalog = permissions.reduce((acc, perm) => {
      const mod = perm.module || "GENERAL";
      if (!acc[mod]) {
        acc[mod] = [];
      }
      acc[mod].push(perm);
      return acc;
    }, {});

    return res.status(200).json({
      success: true,
      data: catalog,
    });
  } catch (error) {
    console.error("Get Permission Catalog Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load permission catalog",
    });
  }
};

/**
 * Get all available permissions flat list
 */
export const getAllPermissions = async (req, res) => {
  try {
    const permissions = await Permission.find()
      .sort({ module: 1, permissionCode: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: permissions,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load permissions",
    });
  }
};

/**
 * Create a new permission (Admin only)
 */
export const createPermission = async (req, res) => {
  try {
    const { permissionName, permissionCode, module, description } = req.body;

    if (!permissionName || !permissionCode || !module) {
      return res.status(400).json({
        success: false,
        message: "permissionName, permissionCode, and module are required.",
      });
    }

    const cleanCode = permissionCode.trim().toLowerCase();
    const existing = await Permission.findOne({ permissionCode: cleanCode });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Permission with code '${cleanCode}' already exists.`,
      });
    }

    const permission = await Permission.create({
      permissionName: permissionName.trim(),
      permissionCode: cleanCode,
      module: module.trim().toUpperCase(),
      description: description?.trim(),
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: "Permission created successfully",
      data: permission,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create permission",
    });
  }
};
