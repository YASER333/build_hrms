import Attendance from '../Modules/AttendanceModule.js';
import User from '../Modules/UserModule.js';
import Leave from '../Modules/LeaveModule.js';

// Helper to calculate total working minutes
const calculateMinutes = (loginTime, logoutTime) => {
    if (!loginTime || !logoutTime) return 0;
    const diffMs = new Date(logoutTime) - new Date(loginTime);
    return Math.floor(diffMs / (1000 * 60));
};

const getDistanceInMeters = (lat1, lon1, lat2, lon2) => {
    if (
        !Number.isFinite(lat1) ||
        !Number.isFinite(lon1) ||
        !Number.isFinite(lat2) ||
        !Number.isFinite(lon2)
    ) {
        return null;
    }

    const R = 6371000;
    const rad = Math.PI / 180;

    const dLat = (lat2 - lat1) * rad;
    const dLon = (lon2 - lon1) * rad;

    const a = Math.min(
        1,
        Math.max(
            0,
            Math.sin(dLat / 2) ** 2 +
                Math.cos(lat1 * rad) *
                    Math.cos(lat2 * rad) *
                    Math.sin(dLon / 2) ** 2
        )
    );

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
};

const getTodayString = () => {
    return new Date().toISOString().split("T")[0];
};

// Check if punch in time is late (e.g. after 09:15 AM local time)
const checkIfLate = (loginDate) => {
    const hours = loginDate.getHours();
    const minutes = loginDate.getMinutes();
    // Standard threshold: 09:15 AM (9 hours, 15 minutes)
    return hours > 9 || (hours === 9 && minutes > 15);
};

// ======================================================
// PUNCH IN
// ======================================================
export const punchIn = async (req, res) => {
    try {
        const userId = req.user.id;
        const now = new Date();
        const dateString = getTodayString();

        // 1. Check if user already punched in today
        const existingAttendance = await Attendance.findOne({
            userId,
            date: dateString,
        });

        if (existingAttendance) {
            return res.status(400).json({
                success: false,
                message: "You have already punched in for today",
                data: existingAttendance,
            });
        }

        // 2. Fetch User to verify account status and WFH approval
        const user = await User.findById(userId).select("wfh isActive isBlocked firstName lastName").lean();
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        if (user.isBlocked || !user.isActive) {
            return res.status(403).json({
                success: false,
                message: "User account is inactive or blocked",
            });
        }

        // 3. Location / Geofencing / WFH Validation
        const { latitude, longitude, accuracy } = req.body;
        const userLatitude = Number(latitude);
        const userLongitude = Number(longitude);

        const hasValidLocation =
            Number.isFinite(userLatitude) &&
            Number.isFinite(userLongitude) &&
            userLatitude >= -90 &&
            userLatitude <= 90 &&
            userLongitude >= -180 &&
            userLongitude <= 180;

        if (!hasValidLocation) {
            return res.status(400).json({
                success: false,
                message: "Valid latitude and longitude are required for punch in",
            });
        }

        const officeLatitude = Number(process.env.OFFICE_LATITUDE);
        const officeLongitude = Number(process.env.OFFICE_LONGITUDE);
        const officeRadius = Number(process.env.OFFICE_RADIUS_METERS || 200);

        if (
            !Number.isFinite(officeLatitude) ||
            !Number.isFinite(officeLongitude) ||
            !Number.isFinite(officeRadius) ||
            officeRadius <= 0
        ) {
            console.error("Invalid office location configuration");
            return res.status(500).json({
                success: false,
                message: "Office location is not configured correctly",
            });
        }

        const distance = getDistanceInMeters(
            userLatitude,
            userLongitude,
            officeLatitude,
            officeLongitude
        );

        if (distance === null) {
            return res.status(400).json({
                success: false,
                message: "Unable to calculate distance from office",
            });
        }

        // Geofence distance check (debug logs removed for production)

        const isAtOffice = distance <= officeRadius;
        let locationType;

        if (isAtOffice) {
            locationType = "Office";
        } else {
            locationType = "WFH";
            if (user.wfh?.isApproved !== true) {
                return res.status(403).json({
                    success: false,
                    message: "You are outside the office location and do not have WFH approval",
                    locationType: "WFH",
                    distance: Math.round(distance),
                    allowedRadius: officeRadius,
                });
            }
        }

        const isLate = checkIfLate(now);

        // 4. Create today's attendance record
        const attendance = await Attendance.create({
            userId,
            date: dateString,
            loginTime: now,
            logoutTime: null,
            totalWorkingMinutes: 0,
            totalHours: 0,
            locationType,
            status: "Working",
            isLate,
            punchInLocation: {
                latitude: userLatitude,
                longitude: userLongitude,
                accuracy: Number(accuracy) || 0
            }
        });

        return res.status(201).json({
            success: true,
            message: "Punched in successfully",
            data: attendance,
            location: {
                type: locationType,
                distanceFromOffice: Math.round(distance),
                allowedRadius: officeRadius,
            },
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: "You have already punched in for today",
            });
        }
        console.error("Punch In Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to punch in",
        });
    }
};

// ======================================================
// PUNCH OUT
// ======================================================
export const punchOut = async (req, res) => {
    try {
        const userId = req.user.id;
        const now = new Date();
        const dateString = getTodayString();

        // 1. Find today's attendance record
        const attendance = await Attendance.findOne({
            userId,
            date: dateString,
        });

        if (!attendance) {
            return res.status(400).json({
                success: false,
                message: "No punch in record found for today. You must punch in first.",
            });
        }

        // 2. Prevent duplicate punch out
        if (attendance.logoutTime) {
            return res.status(400).json({
                success: false,
                message: "Already punched out for today",
                data: attendance,
            });
        }

        // 3. Optional location recording for punch out
        const { latitude, longitude, accuracy } = req.body || {};
        if (Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))) {
            attendance.punchOutLocation = {
                latitude: Number(latitude),
                longitude: Number(longitude),
                accuracy: Number(accuracy) || 0
            };
        }

        // 4. Calculate total working minutes & status using company policy
        const totalMinutes = calculateMinutes(attendance.loginTime, now);
        const totalHours = parseFloat((totalMinutes / 60).toFixed(2));

        // Status derivation:
        // ≥510 min (8.5h) + not late → Present
        // ≥510 min (8.5h) + late → Late
        // ≥240 min (4h) → Half Day
        // <240 min → Half Day (employee attempted work; "Absent" is only for no-show days)
        let status;
        if (totalMinutes >= 510) {
            status = attendance.isLate ? "Late" : "Present";
        } else if (totalMinutes >= 240) {
            status = "Half Day";
        } else {
            // Short session — still counts as a half day attempt rather than absent
            status = "Half Day";
        }

        attendance.logoutTime = now;
        attendance.totalWorkingMinutes = totalMinutes;
        attendance.totalHours = totalHours;
        attendance.status = status;

        await attendance.save();

        return res.status(200).json({
            success: true,
            message: "Punched out successfully",
            data: attendance,
        });
    } catch (error) {
        console.error("Punch Out Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to punch out",
        });
    }
};

// ======================================================
// GET TODAY'S ATTENDANCE STATUS
// ======================================================
export const getTodayAttendance = async (req, res) => {
    try {
        const userId = req.user.id;
        const dateString = getTodayString();

        const attendance = await Attendance.findOne({
            userId,
            date: dateString,
        });

        return res.status(200).json({
            success: true,
            data: attendance || null,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// ======================================================
// GET OWN ATTENDANCE (Strictly derives userId from req.user.id)
// ======================================================
export const getMyAttendance = async (req, res) => {
    try {
        const userId = req.user.id;
        const attendance = await Attendance.find({ userId }).sort({ date: -1 });
        return res.status(200).json({
            success: true,
            data: attendance,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// ======================================================
// GET ATTENDANCE BY MONTH
// ======================================================
export const getAttendanceByMonth = async (req, res) => {
    try {
        const { month, year } = req.params;
        const normalizedMonth = month.padStart(2, '0');

        // IDOR defense: only allow viewing another user's data if requester has team/all permissions
        let targetUserId = req.user.id;
        if (req.query.userId && req.query.userId !== req.user.id) {
            const permissions = req.user.permissions || [];
            const canViewOthers = req.user.priority === 1 ||
                permissions.includes('*') ||
                permissions.includes('attendance.read.team') ||
                permissions.includes('attendance.read.all');
            if (!canViewOthers) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied. You do not have permission to view another employee\'s attendance.',
                });
            }
            targetUserId = req.query.userId;
        }

        const startDateString = `${year}-${normalizedMonth}-01`;
        const lastDay = new Date(year, parseInt(month), 0).getDate();
        const endDateString = `${year}-${normalizedMonth}-${lastDay.toString().padStart(2, '0')}`;

        const attendance = await Attendance.find({
            userId: targetUserId,
            date: { $gte: startDateString, $lte: endDateString }
        }).sort({ date: 1 });

        // Query approved leaves for the target user in this date range
        const startBoundary = new Date(`${startDateString}T00:00:00.000Z`);
        const endBoundary = new Date(`${endDateString}T23:59:59.999Z`);
        const approvedLeaves = await Leave.find({
            employeeId: targetUserId,
            status: "Approved",
            startDate: { $gte: startBoundary, $lte: endBoundary }
        }).lean();

        const leaveMap = {};
        approvedLeaves.forEach((l) => {
            const dStr = new Date(l.startDate).toISOString().split("T")[0];
            leaveMap[dStr] = l;
        });

        const attendanceMap = {};
        attendance.forEach(a => {
            attendanceMap[a.date] = a.toObject();
        });

        const finalResult = [];
        const todayStr = getTodayString();

        for (let day = 1; day <= lastDay; day++) {
            const dateStr = `${year}-${normalizedMonth}-${day.toString().padStart(2, '0')}`;
            const currentLoopDate = new Date(`${dateStr}T00:00:00Z`);

            if (attendanceMap[dateStr]) {
                finalResult.push(attendanceMap[dateStr]);
            } else if (leaveMap[dateStr]) {
                const leaveRecord = leaveMap[dateStr];
                finalResult.push({
                    userId: targetUserId,
                    date: dateStr,
                    status: leaveRecord.isHalfDay ? "Half Day Leave" : "Leave",
                    leaveType: leaveRecord.leaveType,
                    halfDayPeriod: leaveRecord.halfDayPeriod || null,
                    isGenerated: true
                });
            } else {
                const dayOfWeek = currentLoopDate.getUTCDay(); // 0=Sun, 6=Sat
                const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

                let status = "Absent";
                if (isWeekend) {
                    status = "Weekend";
                } else if (dateStr > todayStr) {
                    status = "Future";
                }

                finalResult.push({
                    userId: targetUserId,
                    date: dateStr,
                    status: status,
                    isGenerated: true
                });
            }
        }

        return res.status(200).json({
            success: true,
            data: finalResult
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ======================================================
// GET TEAM / ALL ATTENDANCE (For HR / Admin / Owner)
// ======================================================
export const getTeamAttendance = async (req, res) => {
    try {
        const { search, date, startDate, endDate, status, page = 1, limit = 20 } = req.query;
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 20;
        const skip = (pageNum - 1) * limitNum;

        let query = {};

        if (date) {
            query.date = date;
        } else if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = startDate;
            if (endDate) query.date.$lte = endDate;
        }

        if (status) {
            query.status = status;
        }

        if (search) {
            const searchRegex = new RegExp(search.trim(), 'i');
            const matchingUsers = await User.find({
                $or: [
                    { firstName: searchRegex },
                    { lastName: searchRegex },
                    { email: searchRegex },
                    { employeeId: searchRegex }
                ]
            }).select('_id');
            const userIds = matchingUsers.map(u => u._id);
            query.userId = { $in: userIds };
        }

        const total = await Attendance.countDocuments(query);
        const attendance = await Attendance.find(query)
            .populate('userId', 'firstName lastName email employeeId department designation')
            .sort({ date: -1, createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        return res.status(200).json({
            success: true,
            data: attendance,
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum)
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ======================================================
// GET ATTENDANCE ANALYTICS (For Admin / Owner)
// ======================================================
export const getAttendanceAnalytics = async (req, res) => {
    try {
        const todayStr = getTodayString();

        const totalEmployees = await User.countDocuments({ isActive: true, isBlocked: false });
        const todayRecords = await Attendance.find({ date: todayStr });

        let presentToday = 0;
        let lateToday = 0;
        let halfDayToday = 0;
        let currentlyWorking = 0;

        todayRecords.forEach(r => {
            if (r.status === 'Present') presentToday++;
            else if (r.status === 'Late') { presentToday++; lateToday++; }
            else if (r.status === 'Half Day') halfDayToday++;
            else if (r.status === 'Working' || !r.logoutTime) {
                currentlyWorking++;
                if (r.isLate) lateToday++;
            }
        });

        const absentToday = Math.max(0, totalEmployees - (presentToday + halfDayToday + currentlyWorking));
        const attendancePercentage = totalEmployees > 0
            ? parseFloat((((presentToday + currentlyWorking) / totalEmployees) * 100).toFixed(1))
            : 0;

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
        const monthStart = `${currentYear}-${currentMonth}-01`;
        const monthEnd = `${currentYear}-${currentMonth}-31`;

        const monthAggregation = await Attendance.aggregate([
            { $match: { date: { $gte: monthStart, $lte: monthEnd } } },
            { $group: { _id: "$status", count: { $sum: 1 } } }
        ]);

        const monthlyStats = {
            Present: 0,
            Late: 0,
            "Half Day": 0,
            Absent: 0,
            Working: 0
        };

        monthAggregation.forEach(item => {
            if (monthlyStats[item._id] !== undefined) {
                monthlyStats[item._id] = item.count;
            }
        });

        return res.status(200).json({
            success: true,
            data: {
                totalEmployees,
                presentToday,
                absentToday,
                lateToday,
                currentlyWorking,
                halfDayToday,
                attendancePercentage,
                monthlyStats
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ======================================================
// UPDATE / CORRECT ATTENDANCE (Admin / Owner Manual Correction with Audit History)
// ======================================================
export const updateAttendanceCorrection = async (req, res) => {
    try {
        const { id } = req.params;
        const { loginTime, logoutTime, status, locationType, isLate, reason } = req.body;

        if (!reason || typeof reason !== 'string' || !reason.trim()) {
            return res.status(400).json({
                success: false,
                message: "A valid reason is required for manual attendance correction"
            });
        }

        const attendance = await Attendance.findById(id);
        if (!attendance) {
            return res.status(404).json({
                success: false,
                message: "Attendance record not found"
            });
        }

        const modifier = await User.findById(req.user.id).select('firstName lastName').lean();
        const modifierName = modifier ? `${modifier.firstName || ''} ${modifier.lastName || ''}`.trim() : 'Admin';

        const auditEntries = [];

        const trackChange = (field, oldVal, newVal) => {
            if (newVal !== undefined && String(oldVal) !== String(newVal)) {
                auditEntries.push({
                    modifiedBy: req.user.id,
                    modifiedByName: modifierName,
                    field,
                    oldValue: oldVal ? String(oldVal) : 'None',
                    newValue: String(newVal),
                    reason: reason.trim(),
                    modifiedAt: new Date()
                });
            }
        };

        if (loginTime) {
            trackChange('loginTime', attendance.loginTime?.toISOString(), new Date(loginTime).toISOString());
            attendance.loginTime = new Date(loginTime);
        }

        if (logoutTime) {
            trackChange('logoutTime', attendance.logoutTime?.toISOString(), new Date(logoutTime).toISOString());
            attendance.logoutTime = new Date(logoutTime);
            
            const totalMinutes = calculateMinutes(attendance.loginTime, attendance.logoutTime);
            attendance.totalWorkingMinutes = totalMinutes;
            attendance.totalHours = parseFloat((totalMinutes / 60).toFixed(2));
        }

        if (status) {
            trackChange('status', attendance.status, status);
            attendance.status = status;
        }

        if (locationType) {
            trackChange('locationType', attendance.locationType, locationType);
            attendance.locationType = locationType;
        }

        if (isLate !== undefined) {
            trackChange('isLate', attendance.isLate, isLate);
            attendance.isLate = isLate;
        }

        if (auditEntries.length > 0) {
            if (!attendance.auditHistory) attendance.auditHistory = [];
            attendance.auditHistory.push(...auditEntries);
        }

        await attendance.save();

        return res.status(200).json({
            success: true,
            message: "Attendance record corrected successfully",
            data: attendance
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to correct attendance record"
        });
    }
};

// ======================================================
// GET TEAM ATTENDANCE TODAY (HR / Admin / Owner Dashboard)
// ======================================================
export const getTeamAttendanceToday = async (req, res) => {
    try {
        const todayStr = getTodayString();

        // Get all active employees
        const activeEmployees = await User.find({
            isActive: true,
            isBlocked: false
        }).select('_id firstName lastName email employeeCode department designation').lean();

        const totalEmployees = activeEmployees.length;

        // Get today's attendance records with user info
        const todayRecords = await Attendance.find({ date: todayStr })
            .populate('userId', 'firstName lastName email employeeCode department designation')
            .lean();

        // Build a set of users who have attendance records today
        const checkedInUserIds = new Set(todayRecords.map(r => r.userId?._id?.toString() || r.userId?.toString()));

        // Categorize today's records
        let presentCount = 0;
        let lateCount = 0;
        let halfDayCount = 0;
        let workingCount = 0;
        const lateEmployees = [];
        const notPunchedOutEmployees = [];

        todayRecords.forEach(record => {
            const userName = record.userId
                ? `${record.userId.firstName || ''} ${record.userId.lastName || ''}`.trim()
                : 'Unknown';
            const userEmail = record.userId?.email || '';

            if (record.status === 'Present') {
                presentCount++;
            } else if (record.status === 'Late') {
                presentCount++;
                lateCount++;
                lateEmployees.push({ name: userName, email: userEmail, loginTime: record.loginTime });
            } else if (record.status === 'Half Day') {
                halfDayCount++;
            } else if (record.status === 'Working' || !record.logoutTime) {
                workingCount++;
                if (record.isLate) {
                    lateCount++;
                    lateEmployees.push({ name: userName, email: userEmail, loginTime: record.loginTime });
                }
                if (!record.logoutTime) {
                    notPunchedOutEmployees.push({ name: userName, email: userEmail, loginTime: record.loginTime });
                }
            }
        });

        // Employees who haven't checked in yet today
        const notCheckedInEmployees = activeEmployees
            .filter(emp => !checkedInUserIds.has(emp._id.toString()))
            .map(emp => ({
                name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
                email: emp.email,
                department: emp.department
            }));

        const absentCount = notCheckedInEmployees.length;

        return res.status(200).json({
            success: true,
            data: {
                date: todayStr,
                totalEmployees,
                presentCount,
                lateCount,
                halfDayCount,
                workingCount,
                absentCount,
                attendanceRate: totalEmployees > 0
                    ? parseFloat((((presentCount + workingCount) / totalEmployees) * 100).toFixed(1))
                    : 0,
                needsAttention: {
                    notCheckedIn: notCheckedInEmployees,
                    lateArrivals: lateEmployees,
                    notPunchedOut: notPunchedOutEmployees
                }
            }
        });
    } catch (error) {
        console.error("Team Attendance Today Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to load team attendance overview"
        });
    }
};
