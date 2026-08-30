/**
 * @fileoverview Statutory Compliance Controller
 * @description Manages ECR file generation, validation, and compliance vault history.
 * Issue: #1169
 */
const { StatutoryChallan } = require('../models/statutoryChallan.model');
const PayrollUpdate = require('../models/payroll.model');
const Employee = require('../models/employee.model');
const { generateEPFOEcrText } = require('../utils/ecrGenerator.utils');
const logger = require('../utils/logger');
const { createObjectKey, getDownloadUrl, putObject, isStorageUri } = require('../services/objectStorage.service');

exports.generateECR = async (req, res, next) => {
    try {
        const { type, month, year } = req.body;

        // Check if already generated
        const existing = await StatutoryChallan.findOne({ tenantId: req.tenantId, type, month, year });
        if (existing) return res.status(409).json({ message: 'ECR for this month already generated.', challan: existing });

        // Fetch finalized payrolls for the month
        const payrolls = await PayrollUpdate.find({
            tenantId: req.tenantId, month, year, status: { $in: ['approved', 'paid'] }
        }).lean();

        if (payrolls.length === 0) {
            return res.status(400).json({ message: 'No finalized payroll data found for this month.' });
        }

        // Join with Employee data for UAN/PF details
        const empIds = payrolls.map(p => p.employeeId);
        const employees = await Employee.find({ _id: { $in: empIds } }).lean();
        const empMap = new Map(employees.map(e => [e._id.toString(), e]));

        const joinedData = payrolls.map(p => ({
            employee: empMap.get(p.employeeId.toString()),
            payroll: p
        })).filter(d => d.employee);

        let result;
        if (type === 'EPFO') {
            result = generateEPFOEcrText(joinedData, month, year);
        } else {
            return res.status(400).json({ message: 'Only EPFO ECR generation is supported in this release.' });
        }

        const ecrKey = createObjectKey({
            tenantId: req.tenantId,
            area: 'statutory/ecr',
            extension: 'txt',
        });
        const storedEcr = await putObject({
            key: ecrKey,
            body: Buffer.from(result.ecrText, 'utf8'),
            contentType: 'text/plain; charset=utf-8',
            metadata: { type, month: String(month), year: String(year) },
        });

        const challan = await StatutoryChallan.create({
            tenantId: req.tenantId,
            type,
            month,
            year,
            status: result.errors.length > 0 ? 'Failed Validation' : 'Generated',
            ecrFileUrl: storedEcr.uri,
            totalEmployees: result.summary.totalEmployees,
            totalGrossWages: result.summary.totalGrossWages,
            totalEmployerContribution: result.summary.totalEmployerContribution,
            totalEmployeeContribution: result.summary.totalEmployeeContribution,
            totalChallanAmount: result.summary.totalChallanAmount,
            validationErrors: result.errors,
            generatedBy: req.userId
        });

        res.status(201).json({ message: 'ECR generated successfully', challan });
    } catch (error) { next(error); }
};

exports.uploadPaymentReceipt = async (req, res, next) => {
    try {
        const { challanId, receiptUrl } = req.body;
        const challan = await StatutoryChallan.findOne({ _id: challanId, tenantId: req.tenantId });
        if (!challan) return res.status(404).json({ message: 'Challan not found' });

        let parsed = null;
        if (req.file) {
            const { parseChallanPdf } = require('../utils/challanParser.utils');
            parsed = await parseChallanPdf(req.file.buffer);
        } else if (req.body.receiptText) {
            const { parseChallanPdf } = require('../utils/challanParser.utils');
            parsed = await parseChallanPdf(Buffer.from(req.body.receiptText, 'utf8'));
        }

        if (req.file) {
            const extension = req.file.mimetype === 'application/pdf' ? 'pdf' : 'bin';
            const receiptKey = createObjectKey({
                tenantId: req.tenantId,
                area: 'statutory/payment-receipts',
                extension,
            });
            const storedReceipt = await putObject({
                key: receiptKey,
                body: req.file.buffer,
                contentType: req.file.mimetype,
                metadata: { originalname: String(req.file.originalname || '').slice(0, 255) },
            });
            challan.paymentReceiptUrl = storedReceipt.uri;
        } else {
            challan.paymentReceiptUrl = receiptUrl || '';
        }
        challan.paidAt = new Date();

        if (parsed) {
            challan.extractedChallanAmount = parsed.amount;
            challan.extractedTaxId = parsed.taxId;
            challan.reconciliationNotes = parsed.notes;
            challan.reconciledAt = new Date();

            if (Math.abs(parsed.amount - challan.totalChallanAmount) < 0.01) {
                challan.status = 'reconciled';
            } else {
                challan.status = 'discrepancy';
            }
        } else {
            challan.status = 'Paid';
        }

        await challan.save();

        res.status(200).json({
            message: parsed 
                ? `Payment receipt processed. Reconciliation status: ${challan.status}`
                : 'Payment receipt uploaded and challan marked as Paid.',
            challan
        });
    } catch (error) { next(error); }
};

exports.getVaultHistory = async (req, res, next) => {
    try {
        const history = await StatutoryChallan.find({ tenantId: req.tenantId })
            .sort({ year: -1, month: -1, type: 1 })
            .lean();
        const hydratedHistory = await Promise.all(history.map(async (item) => ({
            ...item,
            ecrFileUrl: isStorageUri(item.ecrFileUrl) ? await getDownloadUrl(item.ecrFileUrl) : item.ecrFileUrl,
            paymentReceiptUrl: isStorageUri(item.paymentReceiptUrl) ? await getDownloadUrl(item.paymentReceiptUrl) : item.paymentReceiptUrl,
        })));
        res.status(200).json({ history: hydratedHistory });
    } catch (error) { next(error); }
};
