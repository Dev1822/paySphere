/**
 * @fileoverview Federal Tax Controller
 * Issue: #1869
 */
const mongoose = require('mongoose');
const { TaxDepositSchedule, FederalTaxLiabilityLedger, Form941Filing } = require('../models/federalTaxDeposit.model');
const { determineDepositorType, calculateDepositDueDate, checkNextDayDepositRule } = require('../utils/form941Engine.utils');
const logger = require('../utils/logger');

exports.calculateLookback = async (req, res, next) => {
    try {
        const { calendarYear, lookbackTotalLiability } = req.body;

        const result = determineDepositorType(lookbackTotalLiability);

        const schedule = await TaxDepositSchedule.findOneAndUpdate(
            { tenantId: req.tenantId, calendarYear },
            {
                tenantId: req.tenantId, calendarYear,
                lookbackStartDate: new Date(`${calendarYear - 2}-07-01`),
                lookbackEndDate: new Date(`${calendarYear - 1}-06-30`),
                lookbackTotalLiability, depositorType: result.depositorType
            },
            { upsert: true, new: true }
        );

        res.status(200).json({ message: 'Deposit schedule calculated', schedule, result });
    } catch (error) { next(error); }
};

exports.recordLiability = async (req, res, next) => {
    try {
        const { payrollRunId, liabilityDate, federalIncomeTax, socialSecurityTax, medicareTax } = req.body;
        const year = new Date(liabilityDate).getFullYear();

        const schedule = await TaxDepositSchedule.findOne({ tenantId: req.tenantId, calendarYear: year });
        if (!schedule) return res.status(400).json({ message: 'Deposit schedule not configured for this year.' });

        const totalLiability = federalIncomeTax + socialSecurityTax + medicareTax;
        const quarter = Math.ceil((new Date(liabilityDate).getMonth() + 1) / 3);
        const dueDate = calculateDepositDueDate(liabilityDate, schedule.depositorType);
        const nextDayCheck = checkNextDayDepositRule(totalLiability);

        const ledger = await FederalTaxLiabilityLedger.create({
            tenantId: req.tenantId, payrollRunId, liabilityDate: new Date(liabilityDate),
            quarter, federalIncomeTax, socialSecurityTax, medicareTax, totalLiability,
            depositDueDate: nextDayCheck.requiresNextDayDeposit ? new Date(liabilityDate.getTime() + 86400000) : dueDate
        });

        if (nextDayCheck.requiresNextDayDeposit) {
            logger.warn(`[Form941] ${nextDayCheck.message}`);
        }

        res.status(201).json({ message: 'Liability recorded', ledger, nextDayCheck });
    } catch (error) { next(error); }
};

exports.generateForm941 = async (req, res, next) => {
    try {
        const { taxYear, quarter } = req.body;

        const ledgers = await FederalTaxLiabilityLedger.find({ tenantId: req.tenantId, quarter, liabilityDate: { $gte: new Date(`${taxYear}-01-01`), $lt: new Date(`${taxYear}-12-31`) } });

        const totals = ledgers.reduce((acc, l) => {
            acc.incomeTax += l.federalIncomeTax;
            acc.ssTax += l.socialSecurityTax;
            acc.medTax += l.medicareTax;
            acc.totalLiability += l.totalLiability;
            if (l.isDeposited) acc.totalDeposits += l.totalLiability;
            return acc;
        }, { incomeTax: 0, ssTax: 0, medTax: 0, totalLiability: 0, totalDeposits: 0 });

        const filing = await Form941Filing.findOneAndUpdate(
            { tenantId: req.tenantId, taxYear, quarter },
            {
                totalIncomeTaxWithheld: totals.incomeTax,
                totalSSTax: totals.ssTax,
                totalMedicareTax: totals.medTax,
                totalLiabilityForQuarter: totals.totalLiability,
                totalDepositsMade: totals.totalDeposits,
                balanceDue: totals.totalLiability - totals.totalDeposits
            },
            { upsert: true, new: true }
        );

        res.status(200).json({ message: 'Form 941 generated', filing });
    } catch (error) { next(error); }
};

exports.getDashboard = async (req, res, next) => {
    try {
        const currentYear = new Date().getFullYear();
        const schedule = await TaxDepositSchedule.findOne({ tenantId: req.tenantId, calendarYear: currentYear });
        const filings = await Form941Filing.find({ tenantId: req.tenantId, taxYear: currentYear }).sort({ quarter: 1 });
        res.status(200).json({ schedule, filings });
    } catch (error) { next(error); }
};
