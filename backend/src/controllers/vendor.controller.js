/**
 * @fileoverview Vendor & Invoice Controller
 * @description Manages vendor CRUD, invoice uploads with auto-TDS (194C / 194J),
 * running ledger, and quarterly Form 16A TDS certificate reporting.
 */
const mongoose = require('mongoose');
const { Vendor, VendorInvoice, VendorPayment } = require('../models/vendor.model');
const {
  calculateTDS,
  calculateTDS194C,
  isValidPAN,
  aggregateForm16AQuarterly,
} = require('../utils/contractorTdsCalculator');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');

/**
 * POST /api/vendors
 * Register a new vendor/contractor.
 */
exports.createVendor = async (req, res, next) => {
  try {
    const { name, pan, gstin, vendorType, address, contactEmail } = req.body;

    if (pan && !isValidPAN(pan)) {
      return res.status(400).json({ message: 'Invalid PAN format. Must be AAAAA1234A.' });
    }

    const vendor = await Vendor.create({
      tenantId: req.tenantId,
      name,
      pan,
      gstin,
      vendorType,
      address,
      contactEmail,
    });

    res.status(201).json({ message: 'Vendor registered', vendor });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/vendors/:id/invoices
 * Upload/Record a new invoice. Automatically calculates 194C/194J TDS.
 */
exports.createInvoice = async (req, res, next) => {
  try {
    const { invoiceNumber, invoiceDate, grossAmount, section = '194C' } = req.body;
    const vendor = await Vendor.findOne({ _id: req.params.id, tenantId: req.tenantId });

    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    // Determine Financial Year (April to March)
    const date = new Date(invoiceDate || Date.now());
    const month = date.getMonth(); // 0-11
    const year = date.getFullYear();
    const financialYear = month >= 3 ? year : year - 1; // April is month 3

    // Calculate TDS
    const tdsCalc = await calculateTDS(vendor, Number(grossAmount), financialYear, req.tenantId, section);

    const invoice = await VendorInvoice.create({
      tenantId: req.tenantId,
      vendorId: vendor._id,
      invoiceNumber,
      invoiceDate: date,
      financialYear,
      grossAmount: Number(grossAmount),
      tdsRate: tdsCalc.tdsRate,
      tdsAmount: tdsCalc.tdsAmount,
      netPayable: tdsCalc.netPayable,
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'VENDOR_INVOICE_CREATED',
      resourceType: 'VendorInvoice',
      resourceIds: [invoice._id],
      details: { vendor: vendor.name, grossAmount, tdsDeducted: tdsCalc.tdsAmount, section },
      req,
    });

    res.status(201).json({
      message: 'Invoice recorded and TDS calculated',
      invoice,
      tdsBreakdown: tdsCalc,
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'Invoice number already exists for this tenant.' });
    next(error);
  }
};

/**
 * GET /api/vendors/:id/ledger
 * Fetch running ledger, pending invoices, and YTD TDS for a vendor.
 */
exports.getVendorLedger = async (req, res, next) => {
  try {
    const vendorId = req.params.id;
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const financialYear = currentMonth >= 3 ? currentYear : currentYear - 1;

    const invoices = await VendorInvoice.find({ tenantId: req.tenantId, vendorId })
      .sort({ invoiceDate: -1 })
      .lean();

    const payments = await VendorPayment.find({
      tenantId: req.tenantId,
      invoiceId: { $in: invoices.map((i) => i._id) },
    })
      .sort({ paymentDate: -1 })
      .lean();

    // Calculate YTD TDS for current FY
    const ytdTds = invoices
      .filter((inv) => inv.financialYear === financialYear)
      .reduce((sum, inv) => sum + (inv.tdsAmount || 0), 0);

    res.status(200).json({ invoices, payments, ytdTds, financialYear });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/vendors/:id/form-16a
 * Generate quarterly Form 16A TDS certificate breakdown for the requested financial year.
 */
exports.getForm16ASummary = async (req, res, next) => {
  try {
    const vendorId = req.params.id;
    const vendor = await Vendor.findOne({ _id: vendorId, tenantId: req.tenantId });
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const defaultFY = currentMonth >= 3 ? currentYear : currentYear - 1;
    const financialYear = req.query.financialYear ? Number(req.query.financialYear) : defaultFY;

    const invoices = await VendorInvoice.find({
      tenantId: req.tenantId,
      vendorId: vendor._id,
      financialYear,
    })
      .sort({ invoiceDate: 1 })
      .lean();

    const form16a = aggregateForm16AQuarterly(invoices, financialYear);

    res.status(200).json({
      success: true,
      vendor: {
        id: vendor._id,
        name: vendor.name,
        pan: vendor.pan || 'PANNOTAVBL',
        gstin: vendor.gstin,
      },
      certificateSummary: form16a,
    });
  } catch (error) {
    next(error);
  }
};
