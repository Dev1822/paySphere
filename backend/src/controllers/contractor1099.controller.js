/**
 * @fileoverview Contractor 1099 Controller
 * @description Manages payment ledgers, TIN validation, and FIRE format generation.
 * Issue: #1871
 */
const mongoose = require('mongoose');
const { ContractorPaymentLedger, TINValidationRecord, Form1099Draft } = require('../models/contractor1099.model');
const {
    evaluate1099Thresholds, calculateBackupWithholding,
    generatePayerRecord, generatePayeeNECRecord
} = require('../utils/form1099Engine.utils');
const logger = require('../utils/logger');

exports.recordPayment = async (req, res, next) => {
    try {
        const { contractorId, taxYear, paymentDate, necAmount, miscAmount } = req.body;

        // Check TIN status for Backup Withholding Guardrail
        const tinRecord = await TINValidationRecord.findOne({ contractorId, tenantId: req.tenantId });
        const tinStatus = tinRecord ? tinRecord.irsMatchStatus : 'Pending';

        const withholding = calculateBackupWithholding(necAmount + miscAmount, tinStatus);

        const ledger = await ContractorPaymentLedger.create({
            tenantId: req.tenantId, contractorId, taxYear, paymentDate: new Date(paymentDate),
            box1_NEC_NonemployeeCompensation: necAmount,
            box3_MISC_OtherIncome: miscAmount,
            box4_MISC_FederalTaxWithheld: withholding.withholdingAmount,
            grossAmount: necAmount + miscAmount
        });

        if (withholding.isWithheld) {
            logger.warn(`[1099] Backup Withholding Applied: $${withholding.withholdingAmount} withheld for contractor ${contractorId} due to TIN ${tinStatus}.`);
        }

        res.status(201).json({ message: 'Payment recorded', ledger, withholding });
    } catch (error) { next(error); }
};

exports.validateTIN = async (req, res, next) => {
    try {
        const { contractorId, tinType, tinValue, legalName } = req.body;

        // Mocking IRS TIN Matching API call
        const mockIRSMatch = Math.random() > 0.2; // 80% chance of match for demo

        const status = mockIRSMatch ? 'Match' : 'Mismatch';
        const requiresBackupWithholding = status === 'Mismatch';

        const record = await TINValidationRecord.findOneAndUpdate(
            { contractorId, tenantId: req.tenantId },
            {
                tinType, tinValue, legalName, irsMatchStatus: status,
                requiresBackupWithholding, lastValidatedAt: new Date()
            },
            { upsert: true, new: true }
        );

        res.status(200).json({ message: 'TIN validation complete', record });
    } catch (error) { next(error); }
};

exports.generateFIREFile = async (req, res, next) => {
    try {
        const { taxYear } = req.body;

        // Aggregate YTD payments per contractor
        const aggregations = await ContractorPaymentLedger.aggregate([
            { $match: { tenantId: req.tenantId, taxYear } },
            {
                $group: {
                    _id: '$contractorId',
                    totalNEC: { $sum: '$box1_NEC_NonemployeeCompensation' },
                    totalMISC: { $sum: '$box3_MISC_OtherIncome' },
                    totalWithholding: { $sum: '$box4_MISC_FederalTaxWithheld' }
                }
            }
        ]);

        // Mock Payer Data
        const payerTIN = '12-3456789';
        const payerName = 'PaySphere Global Inc';
        const payerAddress = '100 Corporate Blvd, New York, NY 10001';

        let fileContent = generatePayerRecord(taxYear, payerTIN, payerName, payerAddress) + '\n';
        let necCount = 0;
        let miscCount = 0;

        for (const agg of aggregations) {
            const thresholds = evaluate1099Thresholds(agg.totalNEC, agg.totalMISC);

            if (thresholds.requiresNEC) {
                // Mock fetching contractor details
                const contractor = {
                    id: agg._id, tin: '987-65-4321', legalName: 'Contractor LLC', address: '123 Vendor Way'
                };

                fileContent += generatePayeeNECRecord(contractor, agg.totalNEC, agg.totalWithholding) + '\n';
                necCount++;
            }
        }

        // End of Payer Record (Type C) and End of Transmit (Type F) mock
        fileContent += 'C' + ' '.repeat(799) + '\n';
        fileContent += 'F' + ' '.repeat(799) + '\n';

        const fileName = `IRS_FIRE_1099_${taxYear}_${payerTIN}.txt`;
        const draft = await Form1099Draft.create({
            tenantId: req.tenantId, taxYear, totalNECRecords: necCount, totalMISCRecords: miscCount,
            fileContent, fileName
        });

        res.status(201).json({ message: 'FIRE file generated', draft });
    } catch (error) { next(error); }
};

exports.getDashboard = async (req, res, next) => {
    try {
        const currentYear = new Date().getFullYear();

        const accumulations = await ContractorPaymentLedger.aggregate([
            { $match: { tenantId: req.tenantId, taxYear: currentYear } },
            {
                $group: {
                    _id: '$contractorId',
                    totalNEC: { $sum: '$box1_NEC_NonemployeeCompensation' },
                    totalWithholding: { $sum: '$box4_MISC_FederalTaxWithheld' }
                }
            }
        ]);

        const tinRecords = await TINValidationRecord.find({ tenantId: req.tenantId });
        const drafts = await Form1099Draft.find({ tenantId: req.tenantId }).sort({ createdAt: -1 }).limit(5);

        res.status(200).json({ accumulations, tinRecords, drafts });
    } catch (error) { next(error); }
};
