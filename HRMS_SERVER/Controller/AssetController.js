import Asset from "../Modules/AssetModule.js";
import User from "../Modules/UserModule.js";
import { logAudit } from "../Utils/AuditLogger.js";
import { getPagination, formatPaginatedResponse } from "../Utils/Pagination.js";

// Helper to generate next Asset Code AST0001
const generateNextAssetCode = async () => {
  const lastAsset = await Asset.findOne({ assetCode: { $regex: /^AST/ } })
    .sort({ createdAt: -1 })
    .select("assetCode")
    .lean();

  if (!lastAsset || !lastAsset.assetCode) {
    return "AST0001";
  }

  const numPart = parseInt(lastAsset.assetCode.replace(/\D/g, ""), 10);
  const nextNum = isNaN(numPart) ? 1 : numPart + 1;
  return `AST${String(nextNum).padStart(4, "0")}`;
};

// 1. Create Asset in Inventory
export const createAsset = async (req, res) => {
  try {
    const { name, category, serialNumber, modelName, manufacturer, purchaseDate, warrantyExpiryDate } = req.body;

    if (!name || !category || !serialNumber) {
      return res.status(400).json({
        success: false,
        message: "Asset name, category, and serial number are required.",
      });
    }

    const existingSerial = await Asset.findOne({ serialNumber: serialNumber.trim() });
    if (existingSerial) {
      return res.status(400).json({ success: false, message: "Asset with this serial number already exists." });
    }

    const assetCode = await generateNextAssetCode();

    const asset = await Asset.create({
      assetCode,
      name,
      category,
      serialNumber: serialNumber.trim(),
      modelName: modelName || "",
      manufacturer: manufacturer || "",
      purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
      warrantyExpiryDate: warrantyExpiryDate ? new Date(warrantyExpiryDate) : null,
      status: "AVAILABLE",
    });

    await logAudit({
      req,
      action: "CREATE_ASSET",
      module: "ASSET",
      resourceId: asset._id.toString(),
      newState: asset.toObject(),
      details: `Created asset ${assetCode} - ${name} (${serialNumber})`,
    });

    return res.status(201).json({
      success: true,
      message: "Asset created in inventory successfully.",
      data: asset,
    });
  } catch (error) {
    console.error("createAsset Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Assign Asset to Employee
export const assignAsset = async (req, res) => {
  try {
    const { assetId, employeeId, conditionOnAssign, remarks } = req.body;

    if (!assetId || !employeeId) {
      return res.status(400).json({ success: false, message: "Asset ID and Employee ID are required." });
    }

    const asset = await Asset.findById(assetId);
    if (!asset) {
      return res.status(404).json({ success: false, message: "Asset not found." });
    }

    const user = await User.findById(employeeId);
    if (!user) {
      return res.status(404).json({ success: false, message: "Employee not found." });
    }

    if (asset.status === "ASSIGNED") {
      return res.status(400).json({ success: false, message: `Asset is already assigned to another user.` });
    }

    asset.status = "ASSIGNED";
    asset.currentAssignee = employeeId;
    asset.assignmentHistory.push({
      assignedTo: employeeId,
      assignedBy: req.user.id,
      assignedDate: new Date(),
      conditionOnAssign: conditionOnAssign || "GOOD",
      remarks: remarks || "",
    });

    await asset.save();

    await logAudit({
      req,
      action: "ASSIGN_ASSET",
      module: "ASSET",
      resourceId: asset._id.toString(),
      details: `Assigned asset ${asset.assetCode} to employee ${user.employeeCode}`,
    });

    return res.status(200).json({
      success: true,
      message: "Asset assigned to employee successfully.",
      data: asset,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Return Asset
export const returnAsset = async (req, res) => {
  try {
    const { assetId } = req.params;
    const { conditionOnReturn, remarks } = req.body;

    const asset = await Asset.findById(assetId);
    if (!asset) {
      return res.status(404).json({ success: false, message: "Asset not found." });
    }

    if (asset.status !== "ASSIGNED") {
      return res.status(400).json({ success: false, message: "Asset is not currently assigned to any employee." });
    }

    // Update active assignment history record
    const lastHistory = asset.assignmentHistory[asset.assignmentHistory.length - 1];
    if (lastHistory) {
      lastHistory.returnedDate = new Date();
      lastHistory.conditionOnReturn = conditionOnReturn || "GOOD";
      if (remarks) lastHistory.remarks += ` | Return: ${remarks}`;
    }

    asset.status = conditionOnReturn === "DAMAGED" ? "DAMAGED" : "AVAILABLE";
    asset.currentAssignee = null;

    await asset.save();

    await logAudit({
      req,
      action: "RETURN_ASSET",
      module: "ASSET",
      resourceId: asset._id.toString(),
      details: `Returned asset ${asset.assetCode} with condition ${conditionOnReturn || "GOOD"}`,
    });

    return res.status(200).json({
      success: true,
      message: "Asset returned successfully.",
      data: asset,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 4. Get Assets (Inventory & Employee Allocations)
export const getAssets = async (req, res) => {
  try {
    const { page, limit, skip, sort } = getPagination(req.query);
    const { status, category, employeeId } = req.query;

    const query = {};
    if (status) query.status = status;
    if (category) query.category = category;
    if (employeeId) query.currentAssignee = employeeId;

    const assets = await Asset.find(query)
      .populate("currentAssignee", "firstName lastName email employeeCode department designation")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Asset.countDocuments(query);

    return res.status(200).json(formatPaginatedResponse({ data: assets, total, page, limit }));
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
