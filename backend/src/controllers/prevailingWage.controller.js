/**
 * @fileoverview Prevailing Wage Controller
 * @description Manages wage determinations, fringe offsets, and certified payroll reporting.
 * Issue: #1732
 */
const { PrevailingWageDetermination, FringeBenefitOffset, CertifiedPayrollReport } = require('../models/prevailingWage.model');
const { calculateHourlyFringeCredit, evaluatePrevailingWageCompliance, generateWH347Report } = require('../utils/certifiedPayrollEngine.utils');
const logger = require('../utils/logger');

exports.createDetermination = async (req, res, next) => {
    try {
        const { projectCode, projectName, contractNumber, wageDecisionNumber, effectiveDate, classifications } = req.body;

        // Pre-calculate total package rates
        const enrichedClassifications = classifications.map(c => ({
            ...c,
            totalPackageRate: c.baseHourlyRate + c.fringeHourlyRate
        }));

        const determination = await PrevailingWageDetermination.create({
            projectCode,
            projectName,
            contractNumber,
            wageDecisionNumber,
            effectiveDate: new Date(effectiveDate),
            classifications: enrichedClassifications
        });

        res.status(201).json({ message: 'Prevailing wage determination created', determination });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: 'Project code already exists.' });
        next(error);
    }
};

exports.addFringeOffset = async (req, res, next) => {
    try {
        const { employeeId, benefitType, monthlyEmployerContribution, expectedMonthlyHours, effectiveFrom } = req.body;

        const hourlyCredit = calculateHourlyFringeCredit(monthlyEmployerContribution, expectedMonthlyHours || 173.33);

        const offset = await FringeBenefitOffset.create({
            employeeId,
            benefitType,
            monthlyEmployerContribution,
            expectedMonthlyHours: expectedMonthlyHours || 173.33,
            calculatedHourlyCredit: hourlyCredit,
            effectiveFrom: new Date(effectiveFrom)
        });

        res.status(201).json({ message: 'Fringe benefit offset added', offset });
    } catch (error) { next(error); }
};

/**
 * POST /api/prevailing-wage/evaluate
 * Evaluates a weekly payroll batch against prevailing wage mandates.
 * Expects: { projectCode, weekEndingDate, employeeRecords: [{ employeeId, craftName, hoursWorked, actualBaseRate, grossPay, deductions }] }
 */
exports.evaluateWeeklyPayroll = async (req, res, next) => {
    try {
        const { projectCode, weekEndingDate, contractorName, payrollSequence, employeeRecords } = req.body;

        const determination = await PrevailingWageDetermination.findOne({
            projectCode,
            isActive: true
        });
        if (!determination) return res.status(404).json({ message: 'No active prevailing wage determination for this project.' });

        let totalHours = 0;
        let totalGross = 0;
        let underpayments = 0;
        let totalUnderpaymentAmount = 0;
        const formattedRecords = [];

        for (const rec of employeeRecords) {
            const craft = determination.classifications.find(c => c.craftName === rec.craftName);
            if (!craft) continue; // Skip unmapped crafts

            // Fetch employee's fringe offsets
            const offsets = await FringeBenefitOffset.find({
                employeeId: rec.employeeId,
                effectiveFrom: { $lte: new Date(weekEndingDate) },
                $or: [{ effectiveTo: null }, { effectiveTo: { $gte: new Date(weekEndingDate) } }]
            });

            const totalFringeCredit = offsets.reduce((sum, o) => sum + o.calculatedHourlyCredit, 0);
            const netPay = rec.grossPay - rec.deductions;

            const compliance = evaluatePrevailingWageCompliance(
                rec.actualBaseRate, totalFringeCredit, craft.baseHourlyRate, craft.fringeHourlyRate
            );

            if (!compliance.isCompliant) {
                underpayments++;
                totalUnderpaymentAmount += (compliance.totalUnderpayment * rec.hoursWorked);
            }

            totalHours += rec.hoursWorked;
            totalGross += rec.grossPay;

            formattedRecords.push({
                employeeName: rec.employeeName || 'Employee',
                craftName: rec.craftName,
                hoursWorked: rec.hoursWorked,
                baseRate: rec.actualBaseRate,
                fringeCredit: totalFringeCredit,
                grossPay: rec.grossPay,
                deductions: rec.deductions,
                netPay: netPay,
                isCompliant: compliance.isCompliant
            });
        }

        // Generate WH-347 Text
        const reportContent = generateWH347Report({
            contractorName, projectName: determination.projectName, contractNumber: determination.contractNumber,
            weekEndingDate, payrollSequence, totalHoursWorked: totalHours, totalGrossWages: totalGross,
            underpaymentsDetected: underpayments
        }, formattedRecords);

        const report = await CertifiedPayrollReport.create({
            projectCode,
            weekEndingDate: new Date(weekEndingDate),
            totalEmployees: employeeRecords.length,
            totalHoursWorked: totalHours,
            totalGrossWages: totalGross,
            underpaymentsDetected: underpayments,
            underpaymentAmount: totalUnderpaymentAmount,
            wh347FileContent: reportContent,
            status: underpayments > 0 ? 'Non-Compliant' : 'Compliant'
        });

        logger.info(`[Davis-Bacon] Evaluated week ending ${weekEndingDate}. Underpayments: ${underpayments}`);
        res.status(201).json({ message: 'Certified payroll evaluated', report });
    } catch (error) { next(error); }
};

exports.getDashboard = async (req, res, next) => {
    try {
        const determinations = await PrevailingWageDetermination.find({
            isActive: true
        });
        const reports = await CertifiedPayrollReport.find({}).sort({ weekEndingDate: -1 }).limit(20);
        res.status(200).json({ determinations, reports });
    } catch (error) { next(error); }
};
