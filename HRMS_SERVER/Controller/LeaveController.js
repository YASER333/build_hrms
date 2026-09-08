import Leave from "../Modules/LeaveModule.js";
import User from "../Modules/UserModule.js";
import Role from "../Modules/RoleModules.js";

// Helper: Format Date to YYYY-MM-DD in local time
const formatDateString = (dateObj) => {
    const d = new Date(dateObj);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

// Helper: Check if a date string is Sunday
const isSunday = (dateStr) => {
    // Append T00:00:00 to force local date interpretation
    const d = new Date(`${dateStr}T00:00:00`);
    return d.getDay() === 0;
};

// Helper: Calculate Leave Balance for an Employee for a specific month & year
export const calculateEmployeeLeaveBalance = async (employeeId, year, month) => {
    const startDateStr = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDayNum = new Date(year, month, 0).getDate();
    const endDateStr = `${year}-${String(month).padStart(2, "0")}-${String(lastDayNum).padStart(2, "0")}`;

    const startBoundary = new Date(`${startDateStr}T00:00:00.000Z`);
    const endBoundary = new Date(`${endDateStr}T23:59:59.999Z`);

    // Fetch approved leaves for this month
    const approvedLeaves = await Leave.find({
        employeeId,
        status: "Approved",
        startDate: { $gte: startBoundary, $lte: endBoundary }
    }).lean();

    let usedSL = 0;
    let usedCL = 0;
    let usedLOP = 0;

    approvedLeaves.forEach((l) => {
        if (l.leaveType === "SL") usedSL += l.totalDays;
        else if (l.leaveType === "CL") usedCL += l.totalDays;
        else if (l.leaveType === "LOP") usedLOP += l.totalDays;
    });

    const allocatedSL = 2.0;
    const allocatedCL = 1.0;

    const remainingSL = Math.max(0, allocatedSL - usedSL);
    const remainingCL = Math.max(0, allocatedCL - usedCL);

    return {
        SL: {
            allocated: allocatedSL,
            used: usedSL,
            remaining: remainingSL
        },
        CL: {
            allocated: allocatedCL,
            used: usedCL,
            remaining: remainingCL
        },
        LOP: {
            allocated: "No Limit",
            used: usedLOP,
            remaining: "No Limit"
        }
    };
};

/**
 * 1. Apply Leave (Employee / HR / Admin Self-Service)
 */
export const applyLeave = async (req, res) => {
    try {
        // Owner role cannot apply for leave
        if (req.user.priority === 1 || req.user.roleCode === "OWNER") {
            return res.status(403).json({
                success: false,
                message: "Owner role does not apply for leave."
            });
        }

        // Derive requester strictly from req.user
        const employeeId = req.user.id;
        const { leaveType, date, isHalfDay, halfDayPeriod, reason } = req.body;

        // 1. Validate required fields
        if (!leaveType || !date || !reason) {
            return res.status(400).json({
                success: false,
                message: "Leave type, date, and reason are required."
            });
        }

        // 2. Validate leave type (V1 allows only SL, CL, LOP)
        const validTypes = ["SL", "CL", "LOP"];
        if (!validTypes.includes(leaveType)) {
            return res.status(400).json({
                success: false,
                message: `Invalid leave type '${leaveType}'. Allowed V1 types: SL (Sick Leave), CL (Casual Leave), LOP (Unpaid Leave).`
            });
        }

        // 3. Validate reason length
        if (typeof reason !== "string" || reason.trim().length < 5) {
            return res.status(400).json({
                success: false,
                message: "Reason must be at least 5 characters long."
            });
        }

        // 4. Calculate total days & validate half-day period
        const halfDayBool = Boolean(isHalfDay);
        let period = null;

        if (halfDayBool) {
            if (!["Morning", "Afternoon"].includes(halfDayPeriod)) {
                return res.status(400).json({
                    success: false,
                    message: "Half day leave requires period to be specified as 'Morning' or 'Afternoon'."
                });
            }
            period = halfDayPeriod;
        }

        const totalDays = halfDayBool ? 0.5 : 1.0;

        // 5. Sunday Rule Validation
        const formattedDateStr = formatDateString(date);
        if (isSunday(formattedDateStr)) {
            return res.status(400).json({
                success: false,
                message: "Sunday is a non-working day. Leave cannot be requested on Sundays."
            });
        }

        // 6. Past Date Rule Validation
        const todayStr = formatDateString(new Date());
        if (formattedDateStr < todayStr) {
            return res.status(400).json({
                success: false,
                message: "Self-service leave cannot be applied for past dates."
            });
        }

        // 7. Duplicate / Overlapping Date Check
        const requestDateObj = new Date(`${formattedDateStr}T00:00:00.000Z`);
        const existingActiveLeave = await Leave.findOne({
            employeeId,
            startDate: requestDateObj,
            status: { $in: ["Pending", "Approved"] }
        });

        if (existingActiveLeave) {
            return res.status(400).json({
                success: false,
                message: `You already have a ${existingActiveLeave.status.toLowerCase()} leave request for date ${formattedDateStr}.`
            });
        }

        // 8. Balance Check (Server-Calculated)
        const reqYear = requestDateObj.getUTCFullYear();
        const reqMonth = requestDateObj.getUTCMonth() + 1;
        const currentBalance = await calculateEmployeeLeaveBalance(employeeId, reqYear, reqMonth);

        if (leaveType === "SL" && totalDays > currentBalance.SL.remaining) {
            return res.status(400).json({
                success: false,
                message: `Insufficient Sick Leave balance. Available: ${currentBalance.SL.remaining} day(s), Requested: ${totalDays} day(s).`
            });
        }

        if (leaveType === "CL" && totalDays > currentBalance.CL.remaining) {
            return res.status(400).json({
                success: false,
                message: `Insufficient Casual Leave balance. Available: ${currentBalance.CL.remaining} day(s), Requested: ${totalDays} day(s).`
            });
        }

        // Fetch employee details for audit trail
        const requesterUser = await User.findById(employeeId).select("firstName lastName").lean();
        const requesterName = requesterUser ? `${requesterUser.firstName} ${requesterUser.lastName}`.trim() : "Employee";

        // Create Leave Record
        const leave = await Leave.create({
            employeeId,
            leaveType,
            startDate: requestDateObj,
            endDate: requestDateObj,
            totalDays,
            isHalfDay: halfDayBool,
            halfDayPeriod: period,
            title: `${leaveType === "SL" ? "Sick Leave" : leaveType === "CL" ? "Casual Leave" : "Unpaid Leave"} (${totalDays} Day)`,
            reason: reason.trim(),
            status: "Pending",
            auditTrail: [
                {
                    action: "SUBMITTED",
                    oldStatus: null,
                    newStatus: "Pending",
                    performedBy: employeeId,
                    performedByName: requesterName,
                    performedAt: new Date()
                }
            ]
        });

        return res.status(201).json({
            success: true,
            message: "Leave application submitted successfully.",
            data: leave
        });
    } catch (error) {
        console.error("Apply Leave Error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 2. Get Calculated Leave Balance for Authenticated Employee (or target user for managers)
 */
export const getLeaveBalance = async (req, res) => {
    try {
        let targetUserId = req.user.id;

        if (req.query.userId && req.query.userId !== req.user.id) {
            const permissions = req.user.permissions || [];
            const canViewOthers =
                req.user.priority === 1 ||
                permissions.includes("*") ||
                permissions.includes("leave.read.team") ||
                permissions.includes("leave.read.all");

            if (!canViewOthers) {
                return res.status(403).json({
                    success: false,
                    message: "Access denied. Insufficient permissions to view another employee's leave balance."
                });
            }
            targetUserId = req.query.userId;
        }

        const today = new Date();
        const year = req.query.year ? parseInt(req.query.year, 10) : today.getFullYear();
        const month = req.query.month ? parseInt(req.query.month, 10) : today.getMonth() + 1;

        const balance = await calculateEmployeeLeaveBalance(targetUserId, year, month);

        return res.status(200).json({
            success: true,
            data: {
                year,
                month,
                balance
            }
        });
    } catch (error) {
        console.error("Get Leave Balance Error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 3. Get Authenticated Employee's Own Leaves
 */
export const getMyLeaves = async (req, res) => {
    try {
        const leaves = await Leave.find({ employeeId: req.user.id })
            .populate("approvedBy", "firstName lastName employeeCode")
            .sort({ createdAt: -1 });

        return res.status(200).json({ success: true, data: leaves });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 4. Get Team Leaves (HR / Manager Scope)
 */
export const getTeamLeaves = async (req, res) => {
    try {
        let teamUserIds = [];

        if (req.user.roleCode === "HR") {
            // HR manages/approves leaves for all standard employees and direct reports
            const nonHrAdminRoles = await Role.find({
                roleCode: { $nin: ["OWNER", "ADMIN", "HR"] }
            }).select("_id");
            const nonHrAdminRoleIds = nonHrAdminRoles.map((r) => r._id);

            const teamUsers = await User.find({
                $or: [
                    { role: { $in: nonHrAdminRoleIds } },
                    { reportingManager: req.user.id },
                    { tlCode: req.user.id }
                ]
            }).select("_id");

            teamUserIds = teamUsers.map((u) => u._id);
        } else {
            // Standard Manager / TL manages direct reports
            const teamUsers = await User.find({
                $or: [{ reportingManager: req.user.id }, { tlCode: req.user.id }]
            }).select("_id");

            teamUserIds = teamUsers.map((u) => u._id);
            teamUserIds.push(req.user.id);
        }

        const leaves = await Leave.find({ employeeId: { $in: teamUserIds } })
            .populate("employeeId", "firstName lastName employeeCode email department designation")
            .populate("approvedBy", "firstName lastName employeeCode")
            .sort({ createdAt: -1 });

        return res.status(200).json({ success: true, data: leaves });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 5. Get All Company Leaves (Admin / Owner Scope)
 */
export const getAllLeaves = async (req, res) => {
    try {
        const leaves = await Leave.find()
            .populate("employeeId", "firstName lastName employeeCode email department designation")
            .populate("approvedBy", "firstName lastName employeeCode")
            .sort({ createdAt: -1 });

        return res.status(200).json({ success: true, data: leaves });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 6. Get Leave Details by ID (with IDOR Defense & Scope Enforcement)
 */
export const getLeaveById = async (req, res) => {
    try {
        const leave = await Leave.findById(req.params.id)
            .populate("employeeId", "firstName lastName employeeCode email department designation reportingManager tlCode")
            .populate("approvedBy", "firstName lastName employeeCode")
            .populate("auditTrail.performedBy", "firstName lastName employeeCode");

        if (!leave) {
            return res.status(404).json({ success: false, message: "Leave request not found." });
        }

        const requesterIdStr = leave.employeeId._id.toString();
        const currentUserIdStr = req.user.id.toString();
        const permissions = req.user.permissions || [];

        // Check Access Rights:
        // 1. Own Leave
        const isOwn = requesterIdStr === currentUserIdStr;
        // 2. Team Scope
        const isManager =
            leave.employeeId.reportingManager?.toString() === currentUserIdStr ||
            leave.employeeId.tlCode?.toString() === currentUserIdStr;

        const hasOwnAccess = isOwn && (permissions.includes("leave.read.own") || permissions.includes("leave.create.own"));
        const hasTeamAccess = isManager && permissions.includes("leave.read.team");
        const hasAllAccess =
            req.user.priority === 1 ||
            permissions.includes("*") ||
            permissions.includes("leave.read.all");

        if (!hasOwnAccess && !hasTeamAccess && !hasAllAccess) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Insufficient scope to view this leave application."
            });
        }

        return res.status(200).json({ success: true, data: leave });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 7. Cancel Own Pending Leave Request
 */
export const cancelLeave = async (req, res) => {
    try {
        const leave = await Leave.findById(req.params.id);
        if (!leave) {
            return res.status(404).json({ success: false, message: "Leave request not found." });
        }

        // Ownership Verification
        if (leave.employeeId.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "Access denied. You can only cancel your own leave requests."
            });
        }

        // Status Verification
        if (leave.status !== "Pending") {
            return res.status(400).json({
                success: false,
                message: "Only pending leave requests can be cancelled."
            });
        }

        const user = await User.findById(req.user.id).select("firstName lastName").lean();
        const userName = user ? `${user.firstName} ${user.lastName}`.trim() : "Employee";

        leave.status = "Cancelled";
        leave.auditTrail.push({
            action: "CANCELLED",
            oldStatus: "Pending",
            newStatus: "Cancelled",
            performedBy: req.user.id,
            performedByName: userName,
            performedAt: new Date()
        });

        await leave.save();

        return res.status(200).json({
            success: true,
            message: "Leave request cancelled successfully.",
            data: leave
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Helper: Enforce Server-Side Approval Hierarchy & Anti-Self-Approval
 */
const validateApprovalHierarchy = async (requesterId, approverUser) => {
    // 1. Rule: NO SELF APPROVAL
    if (requesterId.toString() === approverUser.id.toString()) {
        return {
            allowed: false,
            message: "Self-approval is forbidden. You cannot approve or process your own leave request."
        };
    }

    // Fetch Requester and populate role
    const requester = await User.findById(requesterId)
        .select("_id role employeeCode")
        .populate("role", "roleCode priority")
        .lean();

    if (!requester) {
        return { allowed: false, message: "Requester account not found." };
    }

    const requesterPriority = requester.role?.priority || 3;
    const requesterRoleCode = requester.role?.roleCode || "EMPLOYEE";

    const approverPriority = approverUser.priority;
    const approverRoleCode = approverUser.roleCode;

    // System Owner (Priority 1) has universal final approval authority over all employee, HR, and Admin leaves
    if (approverPriority === 1 || approverRoleCode === "OWNER") {
        return { allowed: true };
    }

    // Workflow Rule 1: Employee Leave -> HR, Admin, or Owner
    if (requesterRoleCode === "EMPLOYEE" || requesterPriority >= 3) {
        if (approverRoleCode === "HR" || approverPriority <= 2 || approverRoleCode === "ADMIN") {
            return { allowed: true };
        }
        return {
            allowed: false,
            message: "Employee leave requests must be approved by HR, Admin, or Owner."
        };
    }

    // Workflow Rule 2: HR Leave -> Admin or Owner (HR cannot approve HR leave)
    if (requesterRoleCode === "HR") {
        if (approverPriority <= 2 || approverRoleCode === "ADMIN") {
            return { allowed: true };
        }
        return {
            allowed: false,
            message: "HR leave requests must be approved by Admin or Owner."
        };
    }

    // Workflow Rule 3: Admin Leave -> Another Authorized Admin or Owner
    if (approverPriority <= 2 || approverRoleCode === "ADMIN") {
        if (approverPriority <= 2 || approverRoleCode === "ADMIN") {
            // Already verified requesterId !== approverUser.id above
            return { allowed: true };
        }
        return {
            allowed: false,
            message: "Admin leave requests must be approved by another authorized Admin or Owner."
        };
    }

    return {
        allowed: false,
        message: "Insufficient hierarchical authority to approve leave for this user."
    };
};

/**
 * 8. Approve Leave Request (with Server-Side Hierarchy & Balance Protection)
 */
export const approveLeave = async (req, res) => {
    try {
        const leave = await Leave.findById(req.params.id);
        if (!leave) {
            return res.status(404).json({ success: false, message: "Leave request not found." });
        }

        // Atomic Status Check
        if (leave.status !== "Pending") {
            return res.status(400).json({
                success: false,
                message: `Cannot approve. Leave request is currently in '${leave.status}' status.`
            });
        }

        // Validate Hierarchy and Anti-Self-Approval
        const hierarchyCheck = await validateApprovalHierarchy(leave.employeeId, req.user);
        if (!hierarchyCheck.allowed) {
            return res.status(403).json({
                success: false,
                message: hierarchyCheck.message
            });
        }

        // Server-Side Balance Re-Verification before deduction
        const reqDateObj = new Date(leave.startDate);
        const reqYear = reqDateObj.getUTCFullYear();
        const reqMonth = reqDateObj.getUTCMonth() + 1;

        const currentBalance = await calculateEmployeeLeaveBalance(leave.employeeId, reqYear, reqMonth);

        if (leave.leaveType === "SL" && leave.totalDays > currentBalance.SL.remaining) {
            return res.status(400).json({
                success: false,
                message: `Employee has insufficient Sick Leave balance. Remaining: ${currentBalance.SL.remaining} day(s), Requested: ${leave.totalDays} day(s).`
            });
        }

        if (leave.leaveType === "CL" && leave.totalDays > currentBalance.CL.remaining) {
            return res.status(400).json({
                success: false,
                message: `Employee has insufficient Casual Leave balance. Remaining: ${currentBalance.CL.remaining} day(s), Requested: ${leave.totalDays} day(s).`
            });
        }

        const approverUser = await User.findById(req.user.id).select("firstName lastName").lean();
        const approverName = approverUser ? `${approverUser.firstName} ${approverUser.lastName}`.trim() : "Approver";

        let balBefore = 0;
        let balAfter = 0;
        if (leave.leaveType === "SL") {
            balBefore = currentBalance.SL.remaining;
            balAfter = balBefore - leave.totalDays;
        } else if (leave.leaveType === "CL") {
            balBefore = currentBalance.CL.remaining;
            balAfter = balBefore - leave.totalDays;
        }

        leave.status = "Approved";
        leave.approvedBy = req.user.id;
        leave.approvedAt = new Date();
        leave.balanceBefore = balBefore;
        leave.balanceAfter = balAfter;

        leave.auditTrail.push({
            action: "APPROVED",
            oldStatus: "Pending",
            newStatus: "Approved",
            performedBy: req.user.id,
            performedByName: approverName,
            performedAt: new Date()
        });

        await leave.save();

        return res.status(200).json({
            success: true,
            message: "Leave request approved successfully.",
            data: leave
        });
    } catch (error) {
        console.error("Approve Leave Error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 9. Reject Leave Request (with Server-Side Hierarchy Protection)
 */
export const rejectLeave = async (req, res) => {
    try {
        const leave = await Leave.findById(req.params.id);
        if (!leave) {
            return res.status(404).json({ success: false, message: "Leave request not found." });
        }

        if (leave.status !== "Pending") {
            return res.status(400).json({
                success: false,
                message: `Cannot reject. Leave request is currently in '${leave.status}' status.`
            });
        }

        // Validate Hierarchy and Anti-Self-Approval
        const hierarchyCheck = await validateApprovalHierarchy(leave.employeeId, req.user);
        if (!hierarchyCheck.allowed) {
            return res.status(403).json({
                success: false,
                message: hierarchyCheck.message
            });
        }

        const rejectionReason = req.body.reason ? String(req.body.reason).trim() : "Rejected by approver";

        const approverUser = await User.findById(req.user.id).select("firstName lastName").lean();
        const approverName = approverUser ? `${approverUser.firstName} ${approverUser.lastName}`.trim() : "Approver";

        leave.status = "Rejected";
        leave.rejectionReason = rejectionReason;
        leave.approvedBy = req.user.id;
        leave.approvedAt = new Date();

        leave.auditTrail.push({
            action: "REJECTED",
            oldStatus: "Pending",
            newStatus: "Rejected",
            performedBy: req.user.id,
            performedByName: approverName,
            reason: rejectionReason,
            performedAt: new Date()
        });

        await leave.save();

        return res.status(200).json({
            success: true,
            message: "Leave request rejected.",
            data: leave
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 10. Get Leave Audit History Log
 */
export const getLeaveAudit = async (req, res) => {
    try {
        const leave = await Leave.findById(req.params.id)
            .select("title leaveType startDate totalDays status auditTrail")
            .populate("auditTrail.performedBy", "firstName lastName employeeCode role");

        if (!leave) {
            return res.status(404).json({ success: false, message: "Leave request not found." });
        }

        return res.status(200).json({
            success: true,
            data: {
                leaveId: leave._id,
                title: leave.title,
                leaveType: leave.leaveType,
                status: leave.status,
                auditTrail: leave.auditTrail
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 11. Delete Leave (Disabled for V1 HR Audit Integrity)
 */
export const deleteLeave = async (req, res) => {
    return res.status(400).json({
        success: false,
        message: "Leave deletion is disabled to preserve HR audit history. Please cancel pending requests instead."
    });
};
