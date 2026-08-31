/**
 * @fileoverview WOTC Controller
 * Issue: #1935
 */
const { WOTCTargetGroup, WOTCCertificationTracker, QualifiedWageLedger } = require('../models/wotcTaxCredit.model');
const { evaluateWOTCCap, check28DaySLA } = require('../utils/wtcAllocationEngine.utils');

exports.addTargetGroup = async (req, res, next) => {
    try {
        const group = await WOTCTargetGroup.findOneAndUpdate(
            {
                groupCode: req.body.groupCode.toUpperCase()
            },
            {
                ...req.body,
                groupCode: req.body.groupCode.toUpperCase()
            },
            { upsert: true, new: true }
        );
        res.status(200).json({ message: 'Target group saved', group });
    } catch (error) { next(error); }
};

exports.logCertification = async (req, res, next) => {
    try {
        const cert = await WOTCCertificationTracker.create({
            ...req.body
        });
        res.status(201).json({ message: 'Certification logged', cert });
    } catch (error) { next(error); }
};

exports.allocatePayrollWages = async (req, res, next) => {
    try {
        const { payrollRunId, employeePayouts } = req.body;
        const allocations = [];

        for (const p of employeePayouts) {
            const cert = await WOTCCertificationTracker.findOne({
                employeeId: p.employeeId,
                form8850Submitted: true
            });
            if (!cert) continue;

            const group = await WOTCTargetGroup.findById(cert.targetGroupId);
            const lastLedger = await QualifiedWageLedger.findOne({ certificationId: cert._id }).sort({ createdAt: -1 });
            const ytd = lastLedger ? lastLedger.ytdAllocatedWages : 0;

            const calc = evaluateWOTCCap(p.grossWages, ytd, group.maxQualifiedWages);

            const ledger = await QualifiedWageLedger.create({
                certificationId: cert._id,
                payrollRunId,
                grossWages: p.grossWages,
                allocatedWages: calc.allocatedWages,
                ytdAllocatedWages: calc.newYtd,
                capReached: calc.capReached
            });
            allocations.push(ledger);
        }
        res.status(200).json({ message: 'Wages allocated', allocations });
    } catch (error) { next(error); }
};

exports.getDashboard = async (req, res, next) => {
    try {
        const groups = await WOTCTargetGroup.find({});
        const certs = await WOTCCertificationTracker.find({})
            .populate('employeeId', 'fullName').populate('targetGroupId', 'groupCode');

        const slaAlerts = certs.map(c => ({
            ...c.toObject(),
            sla: check28DaySLA(c.hireDate, c.submissionDate, new Date())
        })).filter(c => c.sla.daysRemaining <= 7 && !c.form8850Submitted);

        res.status(200).json({ groups, certs, slaAlerts });
    } catch (error) { next(error); }
};
