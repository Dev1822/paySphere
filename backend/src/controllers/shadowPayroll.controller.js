/**
 * @fileoverview Shadow Payroll Controller
 * @description Manages international assignments, shadow payroll runs, and tax equalization.
 * Issue: #1471
 */
const { InternationalAssignment, ShadowPayrollRun, TaxEqualization } = require('../models/shadowPayroll.model');
const Employee = require('../models/employee.model');
const {
    calculateCOLA,
    calculateHypotheticalTax,
    calculateShadowTax,
    reconcileTaxEqualization
} = require('../utils/taxEqualizationEngine.utils');
const logger = require('../utils/logger');

exports.createAssignment = async (req, res, next) => {
    try {
        const {
            employeeId, homeCountry, homeCurrency, hostCountry, hostCurrency,
            startDate, endDate, hypotheticalTaxRate, baseSalaryHome, colaIndex
        } = req.body;

        const colaAllowance = calculateCOLA(baseSalaryHome, colaIndex || 1.0);

        const assignment = await InternationalAssignment.create({
            employeeId,
            homeCountry,
            homeCurrency,
            hostCountry,
            hostCurrency,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            hypotheticalTaxRate,
            baseSalaryHome,
            colaIndex,
            colaAllowance
        });

        res.status(201).json({ message: 'International assignment created', assignment });
    } catch (error) { next(error); }
};

exports.processShadowPayroll = async (req, res, next) => {
    try {
        const { assignmentId, month, year, hostGrossPay, hostTaxRate, hostSocialSecurityRate, exchangeRate } = req.body;

        const assignment = await InternationalAssignment.findOne({
            _id: assignmentId
        });
        if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

        // 1. Calculate Host Country Shadow Payroll
        const shadowCalc = calculateShadowTax(hostGrossPay, hostTaxRate, hostSocialSecurityRate);

        const shadowRun = await ShadowPayrollRun.findOneAndUpdate(
            { assignmentId, month, year },
            {
                hostGrossPay,
                hostTaxDeducted: shadowCalc.hostTax,
                hostSocialSecurity: shadowCalc.hostSocialSecurity,
                hostNetPay: shadowCalc.hostNet,
                exchangeRate,
                status: 'Finalized'
            },
            { upsert: true, new: true }
        );

        // 2. Calculate Home Country Hypothetical Tax
        // Home Gross = Base Salary (monthly) + COLA (monthly)
        const monthlyBase = assignment.baseSalaryHome / 12;
        const monthlyCola = assignment.colaAllowance / 12;
        const homeGrossPay = monthlyBase + monthlyCola;

        const hypotheticalTax = calculateHypotheticalTax(homeGrossPay, assignment.hypotheticalTaxRate);

        // 3. Convert Host Tax to Home Currency for Reconciliation
        const actualHostTaxInHomeCurrency = shadowCalc.hostTax * exchangeRate;

        // 4. Reconcile Tax Equalization
        const reconciliation = reconcileTaxEqualization(hypotheticalTax, actualHostTaxInHomeCurrency);

        const taxEq = await TaxEqualization.findOneAndUpdate(
            { assignmentId, month, year },
            {
                hypotheticalTaxAmount: hypotheticalTax,
                actualHostTaxPaid: actualHostTaxInHomeCurrency,
                companyTaxCost: reconciliation.companyTaxCost
            },
            { upsert: true, new: true }
        );

        logger.info(`[ShadowPayroll] Processed month ${month}/${year} for assignment ${assignmentId}`);
        res.status(200).json({ message: 'Shadow payroll and tax equalization processed', shadowRun, taxEq });
    } catch (error) { next(error); }
};

exports.getAssignments = async (req, res, next) => {
    try {
        const assignments = await InternationalAssignment.find({})
            .populate('employeeId', 'fullName department')
            .sort({ startDate: -1 });
        res.status(200).json({ assignments });
    } catch (error) { next(error); }
};

exports.getAuditData = async (req, res, next) => {
    try {
        const { assignmentId, year } = req.query;
        const query = {};
        if (assignmentId) query.assignmentId = assignmentId;
        if (year) query.year = Number(year);

        const shadowRuns = await ShadowPayrollRun.find(query).sort({ year: 1, month: 1 });
        const taxEqs = await TaxEqualization.find(query).sort({ year: 1, month: 1 });

        res.status(200).json({ shadowRuns, taxEqs });
    } catch (error) { next(error); }
};
