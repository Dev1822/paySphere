/**
 * @fileoverview Shift Allowance Controller
 * @description Manages allowance rules, on-call schedules, and batch calculations.
 * Issue: #1473
 */
const { AllowanceRule, OnCallSchedule, PayoutLineItem } = require('../models/shiftAllowance.model');
const Employee = require('../models/employee.model');
const { calculateShiftAllowances, calculateOnCallStipends } = require('../utils/allowanceCalculator.utils');
const logger = require('../utils/logger');

exports.createRule = async (req, res, next) => {
    try {
        const rule = await AllowanceRule.create({
            ...req.body
        });
        res.status(201).json({ message: 'Allowance rule created', rule });
    } catch (error) { next(error); }
};

exports.getRules = async (req, res, next) => {
    try {
        const rules = await AllowanceRule.find({
            isActive: true
        });
        res.status(200).json({ rules });
    } catch (error) { next(error); }
};

exports.assignOnCall = async (req, res, next) => {
    try {
        const { employeeId, startDate, endDate, dailyStipend } = req.body;
        const schedule = await OnCallSchedule.create({
            employeeId,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            dailyStipend
        });
        res.status(201).json({ message: 'On-call schedule created', schedule });
    } catch (error) { next(error); }
};

/**
 * POST /api/shift-allowances/calculate
 * Triggers the allowance calculation engine for a specific month.
 * Expects mock punch logs in the body for demonstration.
 */
exports.calculateMonthlyAllowances = async (req, res, next) => {
    try {
        const { month, year, employeeId, punchLogs, baseHourlyRate, publicHolidays } = req.body;

        const rules = await AllowanceRule.find({
            isActive: true
        });

        // 1. Calculate Shift Differentials
        const shiftItems = calculateShiftAllowances(punchLogs, rules, baseHourlyRate, publicHolidays || []);

        // 2. Calculate On-Call Stipends
        const onCallSchedules = await OnCallSchedule.find({
            employeeId,
            status: { $in: ['Scheduled', 'Completed'] }
        });
        const onCallItem = calculateOnCallStipends(onCallSchedules, month, year);

        const allItems = [...shiftItems];
        if (onCallItem.amount > 0) allItems.push(onCallItem);

        // 3. Save to PayoutLineItem (Clear existing drafts for this month first)
        await PayoutLineItem.deleteMany({
            employeeId,
            month,
            year,
            status: 'Calculated'
        });

        const payloads = allItems.map(item => ({
            employeeId,
            month,
            year,
            componentName: item.componentName,
            ruleId: item.ruleId,
            premiumHours: item.premiumHours,
            amount: item.amount,
            anomalies: item.anomalies,
            status: 'Calculated'
        }));

        if (payloads.length > 0) {
            await PayoutLineItem.insertMany(payloads);
        }

        logger.info(`[Allowance] Calculated ${payloads.length} line items for employee ${employeeId} in ${month}/${year}`);
        res.status(200).json({ message: 'Allowances calculated', lineItems: payloads });
    } catch (error) { next(error); }
};

exports.getAuditBatch = async (req, res, next) => {
    try {
        const { month, year } = req.query;
        const query = {};
        if (month) query.month = Number(month);
        if (year) query.year = Number(year);

        const items = await PayoutLineItem.find(query)
            .populate('employeeId', 'fullName department')
            .sort({ status: 1, amount: -1 });

        res.status(200).json({ items });
    } catch (error) { next(error); }
};

exports.approveBatch = async (req, res, next) => {
    try {
        const { itemIds } = req.body;
        await PayoutLineItem.updateMany(
            {
                _id: { $in: itemIds }
            },
            { $set: { status: 'Approved' } }
        );
        res.status(200).json({ message: 'Batch approved for payroll injection' });
    } catch (error) { next(error); }
};
