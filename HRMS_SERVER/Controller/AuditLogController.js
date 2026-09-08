import AuditLog from "../Modules/AuditLogModule.js";
import { getPagination, formatPaginatedResponse } from "../Utils/Pagination.js";

export const getAuditLogs = async (req, res) => {
  try {
    const { page, limit, skip, sort } = getPagination(req.query);
    const { module, action, performedBy, startDate, endDate } = req.query;

    const query = {};

    if (module) query.module = module;
    if (action) query.action = { $regex: action, $options: "i" };
    if (performedBy) query.performedBy = performedBy;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const logs = await AuditLog.find(query)
      .populate("performedBy", "firstName lastName email employeeCode")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await AuditLog.countDocuments(query);

    return res.status(200).json(formatPaginatedResponse({
      data: logs,
      total,
      page,
      limit,
    }));
  } catch (error) {
    console.error("getAuditLogs Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
