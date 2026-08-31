/**
 * @fileoverview Commuter Controller
 * @description Manages employee elections, vendor feeds, and payroll deductions.
 * Issue: #1623
 */
const { CommuterElection, VendorTransitFeed, PreTaxDeductionLedger } = require('../models/commuterBenefits.model');
const Employee = require('../models/employee.model');
const { calculatePreTaxDeduction, reconcileVendorFeed, IRS_LIMITS } = require('../utils/commuterDeductionEngine.utils');
const logger = require('../utils/logger');

exports.updateElection = async (req, res, next) => {
    try {
        const { benefitType, electionAmount, effectiveMonth, effectiveYear } = req.body;
        const employee = await Employee.findOne({
            userId: req.userId
        });
        if (!employee) return res.status(404).json({ message: 'Employee profile not found' });

        const election = await CommuterElection.findOneAndUpdate(
            {
                employeeId: employee._id,
                benefitType,
                effectiveMonth,
                effectiveYear
            },
            { electionAmount, status: 'Active' },
            { upsert: true, new: true }
        );

        res.status(200).json({ message: 'Election updated', election });
    } catch (error) { next(error); }
};

exports.uploadVendorFeed = async (req, res, next) => {
    try {
        const { vendorName, month, year, totalInvoiced, lineItems } = req.body;

        const feed = await VendorTransitFeed.create({
            vendorName,
            month,
            year,
            totalInvoiced,
            lineItems
        });

        // Run reconciliation immediately
        const internalElections = await CommuterElection.find({
            effectiveMonth: month,
            effectiveYear: year,
            status: 'Active'
        });

        const discrepancies = reconcileVendorFeed(internalElections, lineItems);

        res.status(201).json({ message: 'Vendor feed uploaded and reconciled', feed, discrepancies });
    } catch (error) { next(error); }
};

exports.processPayrollDeductions = async (req, res, next) => {
    try {
        const { payrollRunId, month, year } = req.body;

        const elections = await CommuterElection.find({
            effectiveMonth: month,
            effectiveYear: year,
            status: 'Active'
        });

        const ledgers = [];
        const payrollInjections = [];

        for (const election of elections) {
            const calc = calculatePreTaxDeduction(election.electionAmount, election.benefitType);

            const ledger = await PreTaxDeductionLedger.create({
                employeeId: election.employeeId,
                payrollRunId,
                benefitType: election.benefitType,
                electedAmount: election.electionAmount,
                actualDeduction: calc.actualDeduction,
                month,
                year
            });

            ledgers.push(ledger);

            payrollInjections.push({
                employeeId: election.employeeId,
                componentName: `Pre-Tax ${election.benefitType}`,
                amount: calc.actualDeduction,
                type: 'PreTaxDeduction',
                isTaxable: false
            });
        }

        logger.info(`[Commuter] Processed ${ledgers.length} pre-tax deductions for ${month}/${year}`);
        res.status(200).json({ message: 'Deductions processed', payrollInjections });
    } catch (error) { next(error); }
};

exports.getMyElections = async (req, res, next) => {
    try {
        const employee = await Employee.findOne({
            userId: req.userId
        });
        if (!employee) return res.status(404).json({ message: 'Employee profile not found' });

        const elections = await CommuterElection.find({
            employeeId: employee._id
        })
            .sort({ effectiveYear: -1, effectiveMonth: -1 });

        res.status(200).json({ elections, limits: IRS_LIMITS });
    } catch (error) { next(error); }
};
