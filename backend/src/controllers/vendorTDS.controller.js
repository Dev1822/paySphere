/**
 * @fileoverview Vendor TDS Controller
 * @description Manages vendor tax profiles, logs payments with auto-TDS calculation,
 * and generates Form 26Q drafts.
 * Issue: #1291
 */
const { VendorTDSProfile, TDSLedger, Form26QDraft } = require('../models/vendorTDS.model');
const { calculateTDS, getFinancialPeriod, generateForm26QText } = require('../utils/tdsEngine.utils');
const logger = require('../utils/logger');

exports.addVendor = async (req, res, next) => {
    try {
        const { vendorName, pan, sectionType, standardRate, hasLDC, ldcRate, ldcCertificateNo, ldcValidUntil } = req.body;

        const vendor = await VendorTDSProfile.create({
            vendorName,
            pan,
            sectionType,
            standardRate,
            hasLDC,
            ldcRate,
            ldcCertificateNo,
            ldcValidUntil
        });

        res.status(201).json({ message: 'Vendor TDS profile created', vendor });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: 'Vendor PAN already exists.' });
        next(error);
    }
};

exports.logPayment = async (req, res, next) => {
    try {
        const { vendorId, invoiceNo, invoiceDate, grossAmount } = req.body;

        const vendor = await VendorTDSProfile.findOne({
            _id: vendorId
        });
        if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

        // Calculate FY and Quarter
        const { fy, quarter } = getFinancialPeriod(new Date(invoiceDate));

        // Fetch accumulation for the FY
        const startOfFY = new Date(`${fy.split('-')[0]}-04-01`);
        const accumulation = await TDSLedger.aggregate([
            {
                $match: {
                    vendorId: vendor._id,
                    invoiceDate: { $gte: startOfFY },
                    financialYear: fy
                }
            },
            { $group: { _id: null, total: { $sum: '$grossAmount' } } }
        ]);

        const fyAccumulation = accumulation.length > 0 ? accumulation[0].total : 0;

        // Calculate TDS
        const tdsResult = calculateTDS(vendor, grossAmount, fyAccumulation);
        const netPayable = grossAmount - tdsResult.tdsAmount;

        const ledger = await TDSLedger.create({
            vendorId: vendor._id,
            invoiceNo,
            invoiceDate: new Date(invoiceDate),
            grossAmount,
            tdsRateApplied: tdsResult.rate,
            tdsAmount: tdsResult.tdsAmount,
            netPayable,
            section: tdsResult.section,
            financialYear: fy,
            quarter
        });

        logger.info(`[TDS] Logged payment for ${vendor.vendorName}. TDS: ${tdsResult.tdsAmount} (${tdsResult.reason})`);

        res.status(201).json({
            message: 'Payment logged and TDS calculated',
            ledger,
            tdsBreakdown: tdsResult
        });
    } catch (error) { next(error); }
};

exports.generateForm26Q = async (req, res, next) => {
    try {
        const { financialYear, quarter } = req.body;

        const entries = await TDSLedger.find({
            financialYear,
            quarter
        })
            .populate('vendorId', 'pan vendorName')
            .sort({ invoiceDate: 1 });

        if (entries.length === 0) {
            return res.status(400).json({ message: 'No TDS transactions found for this quarter.' });
        }

        // Mock Deductor TAN
        const deductorTan = 'DELA12345A';
        const fileContent = generateForm26QText(entries, deductorTan);
        const fileName = `Form26Q_${financialYear}_${quarter}_${req.tenantId}.txt`;

        const draft = await Form26QDraft.create({
            financialYear,
            quarter,
            fileContent,
            fileName,

            stats: {
                totalVendors: new Set(entries.map(e => e.vendorId._id.toString())).size,
                totalTransactions: entries.length,
                totalTDS: entries.reduce((sum, e) => sum + e.tdsAmount, 0)
            },

            generatedBy: req.userId
        });

        res.status(201).json({ message: 'Form 26Q generated successfully', draft });
    } catch (error) { next(error); }
};

exports.getVendors = async (req, res, next) => {
    try {
        const vendors = await VendorTDSProfile.find({}).sort({ vendorName: 1 });
        res.status(200).json({ vendors });
    } catch (error) { next(error); }
};

exports.getLedger = async (req, res, next) => {
    try {
        const { fy, quarter } = req.query;
        const query = {};
        if (fy) query.financialYear = fy;
        if (quarter) query.quarter = quarter;

        const ledger = await TDSLedger.find(query)
            .populate('vendorId', 'vendorName pan')
            .sort({ invoiceDate: -1 })
            .limit(200);

        res.status(200).json({ ledger });
    } catch (error) { next(error); }
};
