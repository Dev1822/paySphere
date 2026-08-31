/**
 * @fileoverview Worker's Compensation Controller
 * @description Manages NCCI classifications, payroll interceptions, and annual audits.
 * Issue: #1570
 */
const {
    RiskClassification, EmployeeRiskMapping, WCPremiumLedger, WCAuditReport
} = require('../models/workersComp.model');
const { applyExecutiveCap, calculatePremium, generateAuditVariance } = require('../utils/wcPremiumEngine.utils');
const logger = require('../utils/logger');

exports.createClassification = async (req, res, next) => {
    try {
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
        const { employeeId, riskClassificationId, isCorporateOfficer } = req.body;

        const mapping = await EmployeeRiskMapping.findOneAndUpdate(
            {
                employeeId
            },
            { riskClassificationId, isCorporateOfficer, effectiveFrom: new Date() },
            { upsert: true, new: true }
        );

        res.status(200).json({ message: 'Employee mapped to risk code', mapping });
    } catch (error) { next(error); }
};

/**
 * POST /api/workers-comp/process-payroll
 * Intercepts a finalized payroll batch to calculate and log WC premiums.
 * Expects: { payrollRunId, periodMonth, periodYear, entries: [{ employeeId, grossPayroll }] }
 */
exports.processPayrollBatch = async (req, res, next) => {
    try {
        const { payrollRunId, periodMonth, periodYear, entries } = req.body;
        const ledgers = [];

        for (const entry of entries) {
            const mapping = await EmployeeRiskMapping.findOne({
                employeeId: entry.employeeId
            }).populate('riskClassificationId');

            if (!mapping || !mapping.riskClassificationId) continue; // Skip unmapped employees

            const risk = mapping.riskClassificationId;
            const cappedPayroll = applyExecutiveCap(entry.grossPayroll, mapping.isCorporateOfficer, risk.officerMaxRemuneration);
            const premium = calculatePremium(cappedPayroll, risk.ratePer100);

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

            ledgers.push(ledger);
        }

        logger.info(`[WC] Processed ${ledgers.length} entries for payroll run ${payrollRunId}`);
        res.status(201).json({ message: 'WC premiums calculated and logged', ledgers });
    } catch (error) { next(error); }
};

exports.runAnnualAudit = async (req, res, next) => {
    try {
        const { auditYear, experienceModifier } = req.body;

        // Fetch all ledgers for the year
        const ledgers = await WCPremiumLedger.find({
            periodYear: auditYear
        });

        const totalEstimatedPaid = ledgers.reduce((sum, l) => sum + l.estimatedPremium, 0);

        // In a real audit, the "actual" payroll might differ slightly from the estimated 
        // due to late adjustments. For this engine, we assume the logged capped payroll is the audited base.
        const totalActualBase = ledgers.reduce((sum, l) => sum + calculatePremium(l.cappedPayroll, l.premiumRate), 0);

        const variance = generateAuditVariance(totalEstimatedPaid, totalActualBase, experienceModifier || 1.0);

        const report = await WCAuditReport.create({
            auditYear,
            experienceModifier: experienceModifier || 1.0,
            totalEstimatedPremiumPaid: Math.round(totalEstimatedPaid * 100) / 100,
            totalActualPremiumCalculated: variance.finalLiability,
            varianceAmount: variance.varianceAmount,
            varianceType: variance.varianceType,
            generatedBy: req.userId
        });

        res.status(201).json({ message: 'Annual WC audit report generated', report });
    } catch (error) { next(error); }
};

exports.getDashboard = async (req, res, next) => {
    try {
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

        res.status(200).json({ classifications, mappings, ytdPremiums });
    } catch (error) { next(error); }
};
