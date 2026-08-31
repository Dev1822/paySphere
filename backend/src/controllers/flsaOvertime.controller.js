/**
 * @fileoverview FLSA Overtime Controller
 * Issue: #1934
 */
const { StateOvertimeMatrix, AlternativeWorkweekSchedule, DailyTimesheetLedger } = require('../models/flsaOvertime.model');
const { calculateDailyOvertime, check7thDayStreak, preventPyramiding } = require('../utils/flsaOvertimeEngine.utils');

exports.saveMatrix = async (req, res, next) => {
    try {
        const matrix = await StateOvertimeMatrix.findOneAndUpdate(
            {
                stateCode: req.body.stateCode.toUpperCase()
            },
            {
                ...req.body,
                stateCode: req.body.stateCode.toUpperCase()
            },
            { upsert: true, new: true }
        );
        res.status(200).json({ message: 'Matrix saved', matrix });
    } catch (error) { next(error); }
};

exports.assignAWS = async (req, res, next) => {
    try {
        const aws = await AlternativeWorkweekSchedule.create({
            ...req.body,
            approvedBy: req.userId
        });
        res.status(201).json({ message: 'AWS assigned', aws });
    } catch (error) { next(error); }
};

exports.processDailyTimesheet = async (req, res, next) => {
    try {
        const { employeeId, workDate, hoursWorked, stateCode, dayOfWeek } = req.body;
        const matrix = await StateOvertimeMatrix.findOne({
            stateCode: stateCode.toUpperCase()
        });
        if (!matrix) return res.status(400).json({ message: 'State matrix not configured' });

        const aws = await AlternativeWorkweekSchedule.findOne({
            employeeId,
            effectiveFrom: { $lte: workDate },
            $or: [{ effectiveTo: null }, { effectiveTo: { $gte: workDate } }]
        });

        const dailyCalc = calculateDailyOvertime(hoursWorked, matrix, aws);
        const seventhDay = check7thDayStreak(dayOfWeek, matrix);

        if (seventhDay.applyDoubleTime) {
            dailyCalc.ot20 += dailyCalc.regular + dailyCalc.ot15;
            dailyCalc.regular = 0;
            dailyCalc.ot15 = 0;
        }

        const ledger = await DailyTimesheetLedger.findOneAndUpdate(
            {
                employeeId,
                workDate: new Date(workDate)
            },
            { ...dailyCalc, isSeventhDay: seventhDay.isSeventhDay },
            { upsert: true, new: true }
        );

        res.status(200).json({ message: 'Timesheet processed', ledger, seventhDay });
    } catch (error) { next(error); }
};

exports.getDashboard = async (req, res, next) => {
    try {
        const matrices = await StateOvertimeMatrix.find({});
        const awsSchedules = await AlternativeWorkweekSchedule.find({})
            .populate('employeeId', 'fullName').sort({ effectiveFrom: -1 }).limit(20);
        res.status(200).json({ matrices, awsSchedules });
    } catch (error) { next(error); }
};
