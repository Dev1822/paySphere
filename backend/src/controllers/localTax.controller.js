/**
 * @fileoverview Local Tax Controller
 * @description Manages jurisdictions, commuter rules, tax certificates, and payroll processing.
 * Issue: #2062
 */
const mongoose = require('mongoose');
const { LocalTaxJurisdiction, CommuterTaxRule, EmployeeTaxCertificate, LocalTaxLedger } = require('../models/localTax.model');
const { calculateLocalWithholding, applyCommuterCredit, jurisdictionConflictGuardrail } = require('../utils/localTaxEngine.utils');
const logger = require('../utils/logger');

exports.saveJurisdiction = async (req, res, next) => {
    try {
        const { jurisdictionCode, jurisdictionName, stateCode, taxType, residentRate, nonResidentRate, reciprocityFramework, annualWageBase } = req.body;

        const jurisdiction = await LocalTaxJurisdiction.findOneAndUpdate(
            { tenantId: req.tenantId, jurisdictionCode },
            { jurisdictionName, stateCode, taxType, residentRate, nonResidentRate, reciprocityFramework, annualWageBase: annualWageBase || 0 },
            { upsert: true, new: true }
        );

        res.status(200).json({ message: 'Jurisdiction saved', jurisdiction });
    } catch (error) { next(error); }
};

exports.saveCommuterRule = async (req, res, next) => {
    try {
        const { homeJurisdictionCode, workJurisdictionCode, creditType, maxCreditPercentage } = req.body;

        const rule = await CommuterTaxRule.findOneAndUpdate(
            { tenantId: req.tenantId, homeJurisdictionCode, workJurisdictionCode },
            { creditType, maxCreditPercentage: maxCreditPercentage || 1.0 },
            { upsert: true, new: true }
        );

        res.status(200).json({ message: 'Commuter rule saved', rule });
    } catch (error) { next(error); }
};

exports.submitCertificate = async (req, res, next) => {
    try {
        const { employeeId, homeJurisdictionCode, workJurisdictionCode, schoolDistrictCode } = req.body;

        const cert = await EmployeeTaxCertificate.findOneAndUpdate(
            { tenantId: req.tenantId, employeeId },
            { homeJurisdictionCode, workJurisdictionCode, schoolDistrictCode, certificateDate: new Date(), exemptionStatus: 'Taxable' },
            { upsert: true, new: true }
        );

        res.status(200).json({ message: 'Tax certificate submitted', cert });
    } catch (error) { next(error); }
};

exports.processLocalTaxPayroll = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { payrollRunId, taxYear, employeePayouts } = req.body;
        // employeePayouts: [{ employeeId, grossPay }]

        const withholdings = [];
        const conflicts = [];

        for (const p of employeePayouts) {
            const cert = await EmployeeTaxCertificate.findOne({ tenantId: req.tenantId, employeeId: p.employeeId }).session(session);
            const homeJurisdiction = cert ? await LocalTaxJurisdiction.findOne({ jurisdictionCode: cert.homeJurisdictionCode }).session(session) : null;
            const workJurisdiction = cert ? await LocalTaxJurisdiction.findOne({ jurisdictionCode: cert.workJurisdictionCode }).session(session) : null;

            // Run Conflict Guardrail
            const conflictCheck = jurisdictionConflictGuardrail(cert, homeJurisdiction, workJurisdiction);
            if (conflictCheck.hasConflict) {
                conflicts.push({ employeeId: p.employeeId, ...conflictCheck });
            }

            if (!workJurisdiction && !homeJurisdiction) continue;

            // 1. Calculate Work City Tax (Non-Resident Rate usually applies if commuting)
            let workCityTax = 0;
            let workTaxableWage = 0;
            if (workJurisdiction) {
                let workLedger = await LocalTaxLedger.findOne({ tenantId: req.tenantId, employeeId: p.employeeId, jurisdictionCode: workJurisdiction.jurisdictionCode, taxYear }).session(session);
                if (!workLedger) {
                    workLedger = new LocalTaxLedger({ tenantId: req.tenantId, employeeId: p.employeeId, jurisdictionCode: workJurisdiction.jurisdictionCode, taxYear });
                }

                const isResident = cert.homeJurisdictionCode === workJurisdiction.jurisdictionCode;
                const calc = calculateLocalWithholding(p.grossPay, workLedger.ytdTaxableWages, workJurisdiction, isResident);

                workLedger.ytdGrossWages += p.grossPay;
                workLedger.ytdTaxableWages = calc.newYtd;
                workLedger.ytdTaxWithheld += calc.taxWithheld;
                workLedger.hitWageCap = calc.hitCap;
                await workLedger.save({ session });

                workCityTax = calc.taxWithheld;
                workTaxableWage = calc.taxableWage;
            }

            // 2. Calculate Home City Tax with Commuter Credit
            if (homeJurisdiction && homeJurisdiction.jurisdictionCode !== workJurisdiction?.jurisdictionCode) {
                let homeLedger = await LocalTaxLedger.findOne({ tenantId: req.tenantId, employeeId: p.employeeId, jurisdictionCode: homeJurisdiction.jurisdictionCode, taxYear }).session(session);
                if (!homeLedger) {
                    homeLedger = new LocalTaxLedger({ tenantId: req.tenantId, employeeId: p.employeeId, jurisdictionCode: homeJurisdiction.jurisdictionCode, taxYear });
                }

                const rule = await CommuterTaxRule.findOne({ tenantId: req.tenantId, homeJurisdictionCode: homeJurisdiction.jurisdictionCode, workJurisdictionCode: workJurisdiction?.jurisdictionCode }).session(session);
                const creditCalc = applyCommuterCredit(workCityTax, homeJurisdiction.residentRate, workTaxableWage, rule);

                homeLedger.ytdGrossWages += p.grossPay;
                homeLedger.ytdTaxableWages += workTaxableWage;
                homeLedger.ytdTaxWithheld += creditCalc.netHomeCityTax;
                homeLedger.ytdCommuterCredit += creditCalc.commuterCreditApplied;
                await homeLedger.save({ session });

                if (creditCalc.netHomeCityTax > 0) {
                    withholdings.push({ employeeId: p.employeeId, jurisdiction: homeJurisdiction.jurisdictionName, amount: creditCalc.netHomeCityTax });
                }
            }

            if (workCityTax > 0) {
                withholdings.push({ employeeId: p.employeeId, jurisdiction: workJurisdiction.jurisdictionName, amount: workCityTax });
            }
        }

        await session.commitTransaction();
        logger.info(`[LocalTax] Processed ${withholdings.length} local tax withholdings. ${conflicts.length} conflicts flagged.`);
        res.status(200).json({ message: 'Local taxes processed', withholdings, conflicts });
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};

exports.getDashboard = async (req, res, next) => {
    try {
        const jurisdictions = await LocalTaxJurisdiction.find({ tenantId: req.tenantId, isActive: true }).sort({ stateCode: 1, jurisdictionName: 1 });
        const rules = await CommuterTaxRule.find({ tenantId: req.tenantId });

        const currentYear = new Date().getFullYear();
        const ytdSummary = await LocalTaxLedger.aggregate([
            { $match: { tenantId: req.tenantId, taxYear: currentYear } },
            {
                $group: {
                    _id: '$jurisdictionCode',
                    totalTaxable: { $sum: '$ytdTaxableWages' },
                    totalWithheld: { $sum: '$ytdTaxWithheld' },
                    totalCredits: { $sum: '$ytdCommuterCredit' }
                }
            }
        ]);

        res.status(200).json({ jurisdictions, rules, ytdSummary });
    } catch (error) { next(error); }
};
