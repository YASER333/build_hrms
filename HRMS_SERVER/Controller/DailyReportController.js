import DailyReport from "../Modules/DailyReportModule.js";
import Project from "../Modules/ProjectModule.js";

/**
 * Helper to evaluate user authority and project membership
 */
const evaluateProjectAccess = async (projectId, user) => {
  const isOwnerOrAdmin =
    user?.priority === 1 ||
    user?.priority === 2 ||
    ["OWNER", "ADMIN"].includes(user?.roleCode);

  const project = await Project.findById(projectId);
  if (!project) {
    return { projectExists: false, isOwnerOrAdmin, isPM: false, isMember: false, project: null };
  }

  const userIdStr = user.id ? user.id.toString() : "";
  const pmIdStr = project.projectManager ? project.projectManager.toString() : "";
  const isPM = isOwnerOrAdmin || (pmIdStr !== "" && pmIdStr === userIdStr);

  const isLead = (project.teamLeads || []).some(
    (m) => m.userId && m.userId.toString() === userIdStr
  );
  const isDev = (project.softwareDevelopers || []).some(
    (m) => m.userId && m.userId.toString() === userIdStr
  );
  const isIntern = (project.interns || []).some(
    (m) => m.userId && m.userId.toString() === userIdStr
  );

  const isMember = isOwnerOrAdmin || isPM || isLead || isDev || isIntern;

  return { projectExists: true, isOwnerOrAdmin, isPM, isMember, project };
};

export const submitDailyReport = async (req, res) => {
  try {
    const {
      projectId,
      reportDate,
      shift,
      title,
      description,
      preference,
      referenceLink
    } = req.body;

    if (!projectId || !description || !description.trim()) {
      return res.status(400).json({
        success: false,
        message: "Project and work description are required"
      });
    }

    const { projectExists, isMember } = await evaluateProjectAccess(projectId, req.user);
    if (!projectExists) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You are not assigned to this project."
      });
    }

    const date = reportDate ? new Date(reportDate) : new Date();
    date.setHours(0, 0, 0, 0);

    const reportTitle = (title && title.trim()) ? title.trim() : "Work Update";
    const reportShift = (shift && shift.trim()) ? shift.trim() : "FULL_DAY";

    const report = await DailyReport.create({
      submittedBy: req.user.id,
      projectId,
      reportDate: date,
      shift: reportShift,
      title: reportTitle,
      description: description.trim(),
      preference,
      referenceLink
    });

    const populatedReport = await DailyReport.findById(report._id)
      .populate("submittedBy", "firstName lastName email employeeCode role")
      .populate("projectId", "projectName")
      .populate("comments.commentedBy", "firstName lastName email employeeCode role");

    return res.status(201).json({
      success: true,
      message: "Daily report submitted successfully",
      data: populatedReport
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Daily report already exists for this project, date, and shift"
      });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyDailyReports = async (req, res) => {
  try {
    const { projectId } = req.query;
    const filter = { submittedBy: req.user.id };
    if (projectId) filter.projectId = projectId;

    const reports = await DailyReport.find(filter)
      .populate("submittedBy", "firstName lastName email employeeCode role")
      .populate("projectId", "projectName")
      .populate("comments.commentedBy", "firstName lastName email employeeCode role")
      .sort({ reportDate: -1, shift: 1 });

    return res.status(200).json({ success: true, data: reports });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getDailyReportsByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { userId } = req.query;

    const { projectExists, isOwnerOrAdmin, isPM, isMember } = await evaluateProjectAccess(projectId, req.user);
    if (!projectExists) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You are not a member of this project."
      });
    }

    const filter = { projectId };

    if (isOwnerOrAdmin || isPM) {
      // Project Manager / Owner / Admin can view all member reports for project, or filter by specific member
      if (userId) filter.submittedBy = userId;
    } else {
      // Standard employee / member: strictly view ONLY their own reports
      filter.submittedBy = req.user.id;
    }

    const reports = await DailyReport.find(filter)
      .populate("submittedBy", "firstName lastName email employeeCode role")
      .populate("projectId", "projectName")
      .populate("comments.commentedBy", "firstName lastName email employeeCode role")
      .sort({ reportDate: -1, shift: 1 });

    return res.status(200).json({ success: true, data: reports });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllDailyReports = async (req, res) => {
  try {
    const isOwnerOrAdmin =
      req.user?.priority === 1 ||
      req.user?.priority === 2 ||
      ["OWNER", "ADMIN"].includes(req.user?.roleCode);

    const { projectId } = req.query;
    const filter = {};

    if (!isOwnerOrAdmin) {
      filter.submittedBy = req.user.id;
    }

    if (projectId) filter.projectId = projectId;

    const reports = await DailyReport.find(filter)
      .populate("submittedBy", "firstName lastName email employeeCode role")
      .populate("projectId", "projectName")
      .populate("comments.commentedBy", "firstName lastName email employeeCode role")
      .sort({ reportDate: -1, shift: 1 });

    return res.status(200).json({ success: true, data: reports });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getDailyReportById = async (req, res) => {
  try {
    const report = await DailyReport.findById(req.params.id)
      .populate("submittedBy", "firstName lastName email employeeCode role")
      .populate("projectId", "projectName")
      .populate("comments.commentedBy", "firstName lastName email employeeCode role");

    if (!report) {
      return res.status(404).json({ success: false, message: "Daily report not found" });
    }

    const { isOwnerOrAdmin, isPM } = await evaluateProjectAccess(report.projectId._id || report.projectId, req.user);
    const isOwnerOfReport = report.submittedBy && (report.submittedBy._id || report.submittedBy).toString() === req.user.id.toString();

    if (!isOwnerOrAdmin && !isPM && !isOwnerOfReport) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You cannot view this daily report."
      });
    }

    return res.status(200).json({ success: true, data: report });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteDailyReport = async (req, res) => {
  try {
    const report = await DailyReport.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ success: false, message: "Daily report not found" });
    }

    const { isOwnerOrAdmin, isPM } = await evaluateProjectAccess(report.projectId, req.user);
    const isOwnerOfReport = report.submittedBy && report.submittedBy.toString() === req.user.id.toString();

    if (!isOwnerOrAdmin && !isPM && !isOwnerOfReport) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You cannot delete this report."
      });
    }

    await report.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Daily report deleted successfully"
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const addCommentToDailyReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { commentText } = req.body;

    if (!commentText || !commentText.trim()) {
      return res.status(400).json({
        success: false,
        message: "Comment text is required"
      });
    }

    const report = await DailyReport.findById(id);
    if (!report) {
      return res.status(404).json({ success: false, message: "Daily report not found" });
    }

    const { isOwnerOrAdmin, isPM } = await evaluateProjectAccess(report.projectId, req.user);
    const isOwnerOfReport = report.submittedBy && report.submittedBy.toString() === req.user.id.toString();

    if (!isOwnerOrAdmin && !isPM && !isOwnerOfReport) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You are not authorized to comment on this daily report."
      });
    }

    report.comments.push({
      commentedBy: req.user.id,
      commentText: commentText.trim(),
      createdAt: new Date()
    });

    await report.save();

    const updatedReport = await DailyReport.findById(id)
      .populate("submittedBy", "firstName lastName email employeeCode role")
      .populate("projectId", "projectName")
      .populate("comments.commentedBy", "firstName lastName email employeeCode role");

    return res.status(200).json({
      success: true,
      message: "Comment added successfully",
      data: updatedReport
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};