import TimeTracking from "../Modules/TimeTrackingModule.js";
import Task from "../Modules/TaskModule.js";

const calculateDuration = (startTime, endTime, manualDuration) => {
    if (startTime && endTime) {
        const start = new Date(`1970-01-01T${startTime}:00`);
        const end = new Date(`1970-01-01T${endTime}:00`);
        let durationMinutes = Math.round((end - start) / 60000);
        if (durationMinutes < 0) durationMinutes += 24 * 60;
        return durationMinutes;
    }
    return manualDuration || 0;
};

export const logTime = async (req, res) => {
    try {
        const { taskId, date, startTime, endTime, durationMinutes: reqDuration, description } = req.body;
        const userId = req.user ? req.user.id : req.body.userId;

        if (!taskId) {
            return res.status(400).json({ success: false, message: "taskId is required" });
        }

        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ success: false, message: "Task not found" });

        const durationMinutes = calculateDuration(startTime, endTime, reqDuration);

        const newTimeRecord = new TimeTracking({
            taskId,
            userId,
            date: date || new Date(),
            startTime,
            endTime,
            durationMinutes,
            description: description || "",
        });

        await newTimeRecord.save();

        return res.status(201).json({
            success: true,
            message: "Time log saved successfully",
            data: newTimeRecord,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const addTimeTracking = logTime;

export const getTimeLogsByTask = async (req, res) => {
    try {
        const taskId = req.params.taskId || req.params.id;
        const tracks = await TimeTracking.find({ taskId })
            .populate("userId", "firstName lastName email")
            .sort({ date: -1 });

        return res.status(200).json({ success: true, data: tracks });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getTimeTracksByTask = getTimeLogsByTask;

export const getTimeLogsByUser = async (req, res) => {
    try {
        const userId = req.params.userId === "me" ? (req.user ? req.user.id : req.params.userId) : req.params.userId;
        const tracks = await TimeTracking.find({ userId })
            .populate("taskId", "taskName status projectId")
            .sort({ date: -1 });

        return res.status(200).json({ success: true, data: tracks });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const updateTimeLog = async (req, res) => {
    try {
        const { id } = req.params;
        const { date, startTime, endTime, durationMinutes: reqDuration, description } = req.body;

        const timeRecord = await TimeTracking.findById(id);
        if (!timeRecord) return res.status(404).json({ success: false, message: "Time log entry not found" });

        if (startTime !== undefined) timeRecord.startTime = startTime;
        if (endTime !== undefined) timeRecord.endTime = endTime;
        if (date !== undefined) timeRecord.date = date;
        if (description !== undefined) timeRecord.description = description;

        timeRecord.durationMinutes = calculateDuration(
            timeRecord.startTime,
            timeRecord.endTime,
            reqDuration !== undefined ? reqDuration : timeRecord.durationMinutes
        );

        await timeRecord.save();

        return res.status(200).json({
            success: true,
            message: "Time log updated successfully",
            data: timeRecord,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
