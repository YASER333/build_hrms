import express from 'express';
import {
  punchIn,
  punchOut,
  getTodayAttendance,
  getMyAttendance,
  getAttendanceByMonth,
  getTeamAttendance,
  getAttendanceAnalytics,
  updateAttendanceCorrection,
  getTeamAttendanceToday,
} from '../Controller/AttendanceController.js';
import {
  Authentication,
  requirePermission,
} from '../Middleware/Auth.js';

const router = express.Router();

// Require valid JWT authentication for all attendance routes
router.use(Authentication);

// ── Punch In / Punch Out Actions (Employee & HR) ──
router.post('/punch-in', requirePermission('attendance.punch_in'), punchIn);
router.post('/punch-out', requirePermission('attendance.punch_out'), punchOut);
router.get('/today', requirePermission('attendance.read.own'), getTodayAttendance);

// ── Own Attendance Queries (Securely derives userId from req.user) ──
router.get('/my', requirePermission('attendance.read.own'), getMyAttendance);
router.get('/month/:month/:year', requirePermission('attendance.read.own'), getAttendanceByMonth);

// ── Team / Organization Attendance (HR uses read.team, Admin uses read.all) ──
router.get('/team/today', requirePermission('attendance.read.team'), getTeamAttendanceToday);
router.get('/team', requirePermission('attendance.read.team'), getTeamAttendance);
router.get('/all', requirePermission('attendance.read.all'), getTeamAttendance);

// ── Attendance Analytics (Admin & Owner) ──
router.get('/analytics', requirePermission('attendance.analytics'), getAttendanceAnalytics);

// ── Manual Attendance Correction with Audit Log (Admin & Owner) ──
router.put('/correction/:id', requirePermission('attendance.modify'), updateAttendanceCorrection);

export default router;