import Task from "../Modules/TaskModule.js";
import TimeTracking from "../Modules/TimeTrackingModule.js";

export const getProjectDashboard = async (req, res) => {
    try {
        const { projectId } = req.params;

        const totalTasks = await Task.countDocuments({ projectId });

        const completedTasks = await Task.countDocuments({
            projectId,
            status: "Completed"
        });

        const overdueTasks = await Task.countDocuments({
            projectId,
            status: { $ne: "Completed" },
            dueDate: { $lt: new Date() }
        });

        const tasks = await Task.find({ projectId }).select("_id");
        const taskIds = tasks.map((t) => t._id);

        const timeTracks = await TimeTracking.find({ taskId: { $in: taskIds } });

        let totalLoggedMinutes = 0;
        timeTracks.forEach((t) => {
            totalLoggedMinutes += t.durationMinutes || 0;
        });

        const totalLoggedHours = (totalLoggedMinutes / 60).toFixed(2);

        return res.status(200).json({
            success: true,
            data: {
                totalTasks,
                completedTasks,
                overdueTasks,
                totalLoggedHours: parseFloat(totalLoggedHours),
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
