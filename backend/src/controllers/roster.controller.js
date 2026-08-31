/**
 * @fileoverview Roster Controller
 * @description Manages shift templates, constraints, and triggers the auto-generation engine.
 * Issue: #1289
 */
const mongoose = require('mongoose');
const { RosterConstraint, ShiftTemplate, GeneratedRoster } = require('../models/roster.model');
const Employee = require('../models/employee.model');
const { generateAutoRoster, checkComplianceGuardrail } = require('../utils/rosteringEngine.utils');
const logger = require('../utils/logger');

exports.getConstraints = async (req, res, next) => {
    try {
        let constraints = await RosterConstraint.findOne({});
        if (!constraints) constraints = await RosterConstraint.create({});
        res.status(200).json({ constraints });
    } catch (error) { next(error); }
};

exports.updateConstraints = async (req, res, next) => {
    try {
        const constraints = await RosterConstraint.findOneAndUpdate(
            {},
            { ...req.body },
            { upsert: true, new: true }
        );
        res.status(200).json({ message: 'Constraints updated', constraints });
    } catch (error) { next(error); }
};

exports.triggerAutoGeneration = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.body;
        const start = new Date(startDate);
        const end = new Date(endDate);

        const employees = await Employee.find({
            isActive: true
        }).limit(50); // Limit for demo
        const templates = await ShiftTemplate.find({});
        const constraints = await RosterConstraint.findOne({});

        if (templates.length === 0) return res.status(400).json({ message: 'No shift templates defined.' });
        if (!constraints) return res.status(400).json({ message: 'Constraints not configured.' });

        // Clear existing drafts for this period to prevent duplicates
        await GeneratedRoster.deleteMany({
            date: { $gte: start, $lte: end },
            status: 'Draft'
        });

        const generatedShifts = generateAutoRoster(employees, templates, constraints, start, end);

        if (generatedShifts.length > 0) {
            await GeneratedRoster.insertMany(generatedShifts, { ordered: false });
        }

        logger.info(`[Roster] Auto-generated ${generatedShifts.length} shifts for tenant ${req.tenantId}`);
        res.status(201).json({ message: 'Roster generated successfully', count: generatedShifts.length });
    } catch (error) { next(error); }
};

exports.getCalendar = async (req, res, next) => {
    try {
        const { month, year } = req.query;
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0, 23, 59, 59);

        const roster = await GeneratedRoster.find({
            date: { $gte: start, $lte: end }
        })
            .populate('employeeId', 'fullName department')
            .populate('shiftTemplateId', 'name startTime endTime colorCode')
            .sort({ date: 1 });

        res.status(200).json({ roster });
    } catch (error) { next(error); }
};

exports.swapShifts = async (req, res, next) => {
    try {
        const { rosterId1, rosterId2 } = req.body;
        const r1 = await GeneratedRoster.findOne({
            _id: rosterId1
        });
        const r2 = await GeneratedRoster.findOne({
            _id: rosterId2
        });

        if (!r1 || !r2) return res.status(404).json({ message: 'One or both roster entries not found.' });

        // Swap employee assignments
        const tempEmp = r1.employeeId;
        r1.employeeId = r2.employeeId;
        r2.employeeId = tempEmp;

        r1.status = 'Swapped';
        r2.status = 'Swapped';

        await r1.save();
        await r2.save();

        res.status(200).json({ message: 'Shifts swapped successfully' });
    } catch (error) { next(error); }
};
