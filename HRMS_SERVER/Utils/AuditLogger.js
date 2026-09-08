import AuditLog from "../Modules/AuditLogModule.js";

/**
 * Helper to write structured audit logs for HR operations and security events.
 */
export const logAudit = async ({
  req,
  performedBy,
  action,
  module,
  resourceId = null,
  previousState = null,
  newState = null,
  details = "",
}) => {
  try {
    const actor = performedBy || (req && req.user ? req.user.id || req.user._id : null);
    if (!actor) return;

    const ipAddress = req ? req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress : null;
    const userAgent = req ? req.headers["user-agent"] : null;

    await AuditLog.create({
      performedBy: actor,
      action,
      module,
      resourceId,
      previousState,
      newState,
      ipAddress,
      userAgent,
      details,
    });
  } catch (error) {
    console.error("Audit logging error:", error.message);
  }
};
