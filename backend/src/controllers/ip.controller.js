/**
 * @fileoverview IP Controller
 * @description Manages invention disclosures, patent milestones, and bonus payouts.
 * Issue: #1622
 */
const mongoose = require('mongoose');
const { InventionDisclosure, PatentMilestone, IPBonusPayout } = require('../models/intellectualProperty.model');
const Employee = require('../models/employee.model');
const { validateInventorSplits, calculateSplitPayouts, generatePayrollInjections } = require('../utils/ipBonusEngine.utils');
const logger = require('../utils/logger');

exports.submitDisclosure = async (req, res, next) => {
    try {
        const { title, description, inventors } = req.body;

        const validation = validateInventorSplits(inventors);
        if (!validation.isValid) return res.status(400).json({ message: validation.reason });

        const disclosure = await InventionDisclosure.create({
            tenantId: req.tenantId, title, description, inventors, submittedBy: req.userId
        });

        res.status(201).json({ message: 'Invention disclosure submitted', disclosure });
    } catch (error) { next(error); }
};

exports.recordMilestone = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { disclosureId, stage, patentNumber, bonusAmountTotal } = req.body;

        const disclosure = await InventionDisclosure.findById(disclosureId).session(session);
        if (!disclosure) throw new Error('Disclosure not found');

        const milestone = await PatentMilestone.create([{
            tenantId: req.tenantId, disclosureId, stage, achievedDate: new Date(),
            patentNumber, bonusAmountTotal
        }], { session });

        // Calculate splits and create pending payouts
        const payouts = calculateSplitPayouts(bonusAmountTotal, disclosure.inventors);
        const payoutDocs = payouts.map(p => ({
            tenantId: req.tenantId, milestoneId: milestone[0]._id,
            employeeId: p.employeeId, amount: p.amount
        }));

        if (payoutDocs.length > 0) {
            await IPBonusPayout.insertMany(payoutDocs, { session });
        }

        await session.commitTransaction();
        logger.info(`[IP] Milestone ${stage} recorded for disclosure ${disclosureId}`);
        res.status(201).json({ message: 'Milestone recorded and payouts generated', milestone: milestone[0] });
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};

exports.injectToPayroll = async (req, res, next) => {
    try {
        const { milestoneId } = req.params;
        const milestone = await PatentMilestone.findById(milestoneId);
        if (!milestone || milestone.isPaidOut) {
            return res.status(400).json({ message: 'Milestone not found or already paid.' });
        }

        const payouts = await IPBonusPayout.find({ milestoneId, status: 'Pending Payroll' });
        const injections = generatePayrollInjections(payouts, milestone.stage);

        // Mark as injected
        await IPBonusPayout.updateMany(
            { _id: { $in: payouts.map(p => p._id) } },
            { $set: { status: 'Injected' } }
        );

        milestone.isPaidOut = true;
        await milestone.save();

        res.status(200).json({ message: 'IP bonuses injected into payroll', injections });
    } catch (error) { next(error); }
};

exports.getMyIP = async (req, res, next) => {
    try {
        const employee = await Employee.findOne({ userId: req.userId, tenantId: req.tenantId });
        if (!employee) return res.status(404).json({ message: 'Employee profile not found' });

        // Find disclosures where this employee is an inventor
        const disclosures = await InventionDisclosure.find({
            tenantId: req.tenantId,
            'inventors.employeeId': employee._id
        }).sort({ createdAt: -1 });

        const payouts = await IPBonusPayout.find({ employeeId: employee._id, tenantId: req.tenantId })
            .populate('milestoneId', 'stage patentNumber');

        res.status(200).json({ disclosures, payouts });
    } catch (error) { next(error); }
};
