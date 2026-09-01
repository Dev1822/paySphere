/**
 * @fileoverview Workers' Compensation Controller
 * @description Manages NCCI codes, employee mappings, payroll processing, and audit reports.
 * Issue: #2061
 */
const mongoose = require('mongoose');
const { WCClassCode, WCEmployeeMapping, WCPayrollLedger, WCAuditReport } = require('../models/workersComp.model');
const { stripOvertimePremium, calculateEstimatedPremium, auditGuardrail, evaluateEMRStatus } = require('../utils/wcPremiumEngine.utils');
const logger = require('../utils/logger');

exports.saveClassCode = async (req, res, next) => {
    try {
        const { ncciCode, description, baseManualRate, stateCode, allowsOTExclusion } = req.body;

        const code = await WCClassCode.findOneAndUpdate(
            { tenantId: req.tenantId, ncciCode, stateCode: stateCode.toUpperCase() },
            { description, baseManualRate, allowsOTExclusion },
            { upsert: true, new: true }
        );

        res.status(200).json({ message: 'NCCI class code saved', code });
    } catch (error) { next(error); }
        const { ncciCode, description, ratePer100, officerMaxRemuneration, isExecutiveCode } = req.body;
        const classification = await RiskClassification.create({
            ncciCode,
            description,
            ratePer100,
            officerMaxRemuneration,
            isExecutiveCode
        });
        res.status(201).json({ message: 'Risk classification created', classification });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: 'NCCI code already exists for this tenant.' });
        next(error);
    }
};

exports.mapEmployee = async (req, res, next) => {
    try {
        const { employeeId, primaryNCCI, secondaryNCCI, splitPercentage, effectiveFrom } = req.body;

        // Close previous mappings
        await WCEmployeeMapping.updateMany(
            { tenantId: req.tenantId, employeeId, effectiveTo: null },
            { effectiveTo: new Date(effectiveFrom) }
        const mapping = await EmployeeRiskMapping.findOneAndUpdate(
            {
                employeeId
            },
            { riskClassificationId, isCorporateOfficer, effectiveFrom: new Date() },
            { upsert: true, new: true }
        );

        const mapping = await WCEmployeeMapping.create({
            tenantId: req.tenantId, employeeId, primaryNCCI, secondaryNCCI,
            splitPercentage: splitPercentage || 100, effectiveFrom: new Date(effectiveFrom)
        });

        res.status(201).json({ message: 'Employee mapped to NCCI code', mapping });
    } catch (error) { next(error); }
};

exports.processPayrollForWC = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { payrollRunId, policyYear, companyEMR, employeePayouts } = req.body;
        // employeePayouts: [{ employeeId, grossWages, otHours, baseHourlyRate, stateCode, physicalHours }]

        const ledgers = [];
        const flags = [];

        for (const p of employeePayouts) {
            const mapping = await WCEmployeeMapping.findOne({
                tenantId: req.tenantId, employeeId: p.employeeId,
                effectiveFrom: { $lte: new Date() },
                $or: [{ effectiveTo: null }, { effectiveTo: { $gte: new Date() } }]
            }).session(session);
        for (const entry of entries) {
            const mapping = await EmployeeRiskMapping.findOne({
                employeeId: entry.employeeId
            }).populate('riskClassificationId');

            const ncciCode = mapping ? mapping.primaryNCCI : '9999'; // 9999 = Unassigned/High Risk
            const classCode = await WCClassCode.findOne({ tenantId: req.tenantId, ncciCode, stateCode: p.stateCode.toUpperCase() }).session(session);

            const baseRate = classCode ? classCode.baseManualRate : 15.00; // Default high risk rate if missing

            // Strip OT Premium
            const otCalc = stripOvertimePremium(p.grossWages, p.otHours || 0, p.baseHourlyRate || 0, p.stateCode);
            const ledger = await WCPremiumLedger.create({
                payrollRunId,
                employeeId: entry.employeeId,
                riskClassificationId: risk._id,
                ncciCode: risk.ncciCode,
                grossPayroll: entry.grossPayroll,
                cappedPayroll,
                premiumRate: risk.ratePer100,
                estimatedPremium: premium,
                periodMonth,
                periodYear
            });

            // Calculate Estimated Premium
            const estimatedPremium = calculateEstimatedPremium(otCalc.eligibleWages, baseRate, companyEMR || 1.0);

            const ledger = await WCPayrollLedger.create([{
                tenantId: req.tenantId, employeeId: p.employeeId, payrollRunId,
                ncciCode, grossWages: p.grossWages, overtimePremium: (p.otHours || 0) * (p.baseHourlyRate || 0) * 0.5,
                excludedOTPremium: otCalc.excludedOTPremium, wcEligibleWages: otCalc.eligibleWages,
                estimatedPremium, periodMonth: new Date().getMonth() + 1, periodYear: policyYear
            }], { session });

            ledgers.push(ledger[0]);

            // Run Audit Guardrail
            const flag = auditGuardrail({
                employeeId: p.employeeId, primaryNCCI: ncciCode,
                totalHours: p.grossWages / (p.baseHourlyRate || 1), physicalHours: p.physicalHours || 0
            });
        // Fetch all ledgers for the year
        const ledgers = await WCPremiumLedger.find({
            periodYear: auditYear
        });

            if (flag.hasFlag) {
                flags.push({ employeeId: p.employeeId, flagType: flag.flagType, message: flag.message });
            }
        }

        await session.commitTransaction();
        logger.info(`[WC] Processed ${ledgers.length} payroll lines. ${flags.length} audit flags triggered.`);
        res.status(200).json({ message: 'WC payroll processed', ledgers: ledgers.length, flags });
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};

exports.generateAuditReport = async (req, res, next) => {
    try {
        const { policyYear, companyEMR } = req.body;

        const ledgers = await WCPayrollLedger.find({ tenantId: req.tenantId, periodYear: policyYear });
        const codes = await WCClassCode.find({ tenantId: req.tenantId });
        const codeMap = new Map(codes.map(c => [c.ncciCode, c]));

        let totalGross = 0;
        let totalEligible = 0;
        let totalPremium = 0;
        const breakdownMap = {};

        for (const l of ledgers) {
            totalGross += l.grossWages;
            totalEligible += l.wcEligibleWages;
            totalPremium += l.estimatedPremium;

            if (!breakdownMap[l.ncciCode]) {
                const codeInfo = codeMap.get(l.ncciCode);
                breakdownMap[l.ncciCode] = {
                    ncciCode: l.ncciCode,
                    description: codeInfo ? codeInfo.description : 'Unassigned/High Risk',
                    eligibleWages: 0,
                    manualRate: codeInfo ? codeInfo.baseManualRate : 15.00,
                    calculatedPremium: 0
                };
            }
            breakdownMap[l.ncciCode].eligibleWages += l.wcEligibleWages;
            breakdownMap[l.ncciCode].calculatedPremium += l.estimatedPremium;
        }

        const classCodeBreakdown = Object.values(breakdownMap).map(b => ({
            ...b,
            eligibleWages: Math.round(b.eligibleWages * 100) / 100,
            calculatedPremium: Math.round(b.calculatedPremium * 100) / 100
        }));

        const report = await WCAuditReport.findOneAndUpdate(
            { tenantId: req.tenantId, policyYear },
            {
                totalGrossPayroll: totalGross, totalWCEligiblePayroll: totalEligible,
                totalEstimatedPremium: totalPremium, classCodeBreakdown,
                companyEMR: companyEMR || 1.0, status: 'Finalized'
            },
            { upsert: true, new: true }
        );
        const report = await WCAuditReport.create({
            auditYear,
            experienceModifier: experienceModifier || 1.0,
            totalEstimatedPremiumPaid: Math.round(totalEstimatedPaid * 100) / 100,
            totalActualPremiumCalculated: variance.finalLiability,
            varianceAmount: variance.varianceAmount,
            varianceType: variance.varianceType,
            generatedBy: req.userId
        });

        res.status(201).json({ message: 'Audit report generated', report });
    } catch (error) { next(error); }
};

exports.getDashboard = async (req, res, next) => {
    try {
        const currentYear = new Date().getFullYear();
        const codes = await WCClassCode.find({ tenantId: req.tenantId, isActive: true }).sort({ ncciCode: 1 });
        const reports = await WCAuditReport.find({ tenantId: req.tenantId }).sort({ policyYear: -1 }).limit(5);

        const ytdSummary = await WCPayrollLedger.aggregate([
            { $match: { tenantId: req.tenantId, periodYear: currentYear } },
            {
                $group: {
                    _id: null,
                    totalEligible: { $sum: '$wcEligibleWages' },
                    totalPremium: { $sum: '$estimatedPremium' },
                    totalExcludedOT: { $sum: '$excludedOTPremium' }
                }
            }
        const classifications = await RiskClassification.find({
            isActive: true
        });
        const mappings = await EmployeeRiskMapping.find({})
            .populate('employeeId', 'fullName')
            .populate('riskClassificationId', 'ncciCode description');

        const currentYear = new Date().getFullYear();
        const ytdPremiums = await WCPremiumLedger.aggregate([
            { $match: {
                periodYear: currentYear
            } },
            { $group: { _id: '$ncciCode', totalPayroll: { $sum: '$cappedPayroll' }, totalPremium: { $sum: '$estimatedPremium' } } }
        ]);

        const summary = ytdSummary[0] || { totalEligible: 0, totalPremium: 0, totalExcludedOT: 0 };
        const emrStatus = evaluateEMRStatus(1.0); // Mock EMR for dashboard

        res.status(200).json({ codes, reports, ytdSummary: summary, emrStatus });
    } catch (error) { next(error); }
};
