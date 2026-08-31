/**
 * @fileoverview Union & CBA Controller
 * @description Manages CBAs, dues calculations, and grievance arbitration lifecycles.
 * Issue: #1475
 */
const { CollectiveBargainingAgreement, UnionDuesTier, GrievanceArbitration } = require('../models/unionCBA.model');
const Employee = require('../models/employee.model');
const { calculateUnionDues, evaluateArbitrationSLAs } = require('../utils/duesCalculator.utils');
const logger = require('../utils/logger');

exports.createCBA = async (req, res, next) => {
    try {
        const cba = await CollectiveBargainingAgreement.create({
            ...req.body
        });
        res.status(201).json({ message: 'CBA created', cba });
    } catch (error) { next(error); }
};

exports.addTier = async (req, res, next) => {
    try {
        const tier = await UnionDuesTier.create({
            ...req.body
        });
        res.status(201).json({ message: 'Dues tier added', tier });
    } catch (error) { next(error); }
};

exports.calculateDuesBatch = async (req, res, next) => {
    try {
        const { cbaId } = req.body;
        const cba = await CollectiveBargainingAgreement.findOne({
            _id: cbaId
        });
        if (!cba) return res.status(404).json({ message: 'CBA not found' });

        const tiers = await UnionDuesTier.find({
            cbaId
        });

        // Fetch all active employees covered by this CBA (simplified: all active employees)
        const employees = await Employee.find({
            isActive: true
        }).select('_id fullName monthlySalary');

        const results = [];
        for (const emp of employees) {
            const calc = calculateUnionDues(cba, tiers, emp.monthlySalary || 0);
            results.push({
                employeeId: emp._id,
                fullName: emp.fullName,
                basePay: emp.monthlySalary,
                ...calc
            });
        }

        res.status(200).json({ message: 'Dues calculated for batch', results });
    } catch (error) { next(error); }
};

exports.fileGrievance = async (req, res, next) => {
    try {
        const { employeeId, title, description, stepDeadlineDays } = req.body;

        // Calculate initial deadline (e.g., 14 days for Step 1)
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + (stepDeadlineDays || 14));

        const grievance = await GrievanceArbitration.create({
            employeeId,
            cbaId: req.body.cbaId,
            title,
            description,
            filedDate: new Date(),
            stepDeadline: deadline
        });

        res.status(201).json({ message: 'Grievance filed', grievance });
    } catch (error) { next(error); }
};

exports.checkSLABreaches = async (req, res, next) => {
    try {
        const openGrievances = await GrievanceArbitration.find({
            status: { $in: ['Open', 'Escalated'] }
        }).populate('employeeId', 'fullName');

        const breached = evaluateArbitrationSLAs(openGrievances, new Date());

        // Update DB flags
        if (breached.length > 0) {
            const breachedIds = breached.map(b => b.grievanceId);
            await GrievanceArbitration.updateMany(
                { _id: { $in: breachedIds } },
                { $set: { isSLABreached: true } }
            );
            logger.warn(`[Union] ${breached.length} grievance SLAs breached!`);
        }

        res.status(200).json({ breached });
    } catch (error) { next(error); }
};

exports.getAdminDashboard = async (req, res, next) => {
    try {
        const cbas = await CollectiveBargainingAgreement.find({}).sort({ effectiveFrom: -1 });
        const grievances = await GrievanceArbitration.find({})
            .populate('employeeId', 'fullName')
            .sort({ filedDate: -1 }).limit(50);

        res.status(200).json({ cbas, grievances });
    } catch (error) { next(error); }
};