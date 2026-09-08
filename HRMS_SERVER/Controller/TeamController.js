import Task from "../Modules/TaskModule.js";
import TimeTracking from "../Modules/TimeTrackingModule.js";
import User from "../Modules/UserModule.js";

export const getUserProductivity = async (req, res) => {
    try {
        const userId = req.params.userId === "me" ? (req.user ? req.user.id : req.params.userId) : req.params.userId;

        const user = await User.findById(userId).select("firstName lastName email employeeCode");
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const tasks = await Task.find({ assignedTo: userId });
        const tasksAssigned = tasks.length;
        const tasksCompleted = tasks.filter(t => t.status === "Completed").length;
        const inProgress = tasks.filter(t => t.status === "In Progress" || t.status === "Testing").length;

        // Fetch time logs for user
        const timeLogs = await TimeTracking.find({ userId });
        const totalDurationMinutes = timeLogs.reduce((acc, log) => acc + (log.durationMinutes || 0), 0);
        const hoursLogged = Math.round((totalDurationMinutes / 60) * 10) / 10;

        // Calculate average task duration based on logged hours & completed tasks
        let averageTaskDuration = 0;
        if (tasksCompleted > 0 && hoursLogged > 0) {
            averageTaskDuration = Math.round((hoursLogged / tasksCompleted) * 10) / 10;
        }

        return res.status(200).json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    name: `${user.firstName} ${user.lastName}`.trim(),
                    email: user.email,
                    employeeCode: user.employeeCode,
                },
                tasksAssigned,
                tasksCompleted,
                inProgress,
                hoursLogged,
                averageTaskDuration,
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
