/**
 * @fileoverview Accounting & ERP Export Controller
 * @description Manages GL mappings, generates double-entry journals from finalized payroll,
 * provides Trial Balance ledger reconciliation, and exports to Tally XML or generic CSV.
 */
const mongoose = require('mongoose');
const { GLAccountMapping, JournalVoucher } = require('../models/journalEntry.model');
const PayrollUpdate = require('../models/payroll.model');
const { generateJournalLegs, computeTrialBalance } = require('../utils/journalGenerator');
const { generateTallyXml, generateGenericCsv } = require('../utils/tallyXmlExporter');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');

/**
 * GET /api/accounting/mappings
 * Fetch GL mappings for the tenant.
 */
exports.getMappings = async (req, res, next) => {
  try {
    const mappings = await GLAccountMapping.find({});
    res.status(200).json({ mappings });
  } catch (error) { next(error); }
};

/**
 * POST /api/accounting/mappings
 * Bulk update GL mappings.
 */
exports.updateMappings = async (req, res, next) => {
  try {
    const { mappings } = req.body;

    await GLAccountMapping.deleteMany({});

    const toInsert = mappings.map((m) => ({
      componentKey: m.componentKey,
      glAccountName: m.glAccountName,
      glAccountCode: m.glAccountCode || '',
      nature: m.nature
    }));

    await GLAccountMapping.insertMany(toInsert);
    res.status(200).json({ message: 'GL mappings updated successfully' });
  } catch (error) { next(error); }
};

/**
 * POST /api/accounting/generate-journal
 * Generates a double-entry journal voucher for a specific payroll month.
 */
exports.generateJournal = async (req, res, next) => {
  try {
    const { month, year } = req.body;

    const existing = await JournalVoucher.findOne({
      month,
      year
    });
    if (existing) {
      return res.status(409).json({ message: 'Journal voucher already generated for this month. Delete it first to regenerate.' });
    }

    const payrolls = await PayrollUpdate.find({
      month,
      year,
      status: { $in: ['approved', 'paid'] }
    }).lean();

    if (payrolls.length === 0) {
      return res.status(400).json({ message: 'No approved/paid payroll records found for this month.' });
    }

    const mappings = await GLAccountMapping.find({});
    if (mappings.length === 0) {
      return res.status(400).json({ message: 'GL mappings not configured. Please map payroll components to GL accounts first.' });
    }

    const voucherNumber = `JV/PAY/${year}/${String(month).padStart(2, '0')}`;
    const voucherDate = new Date(year, month - 1, new Date(year, month, 0).getDate());

    const { legs, totalDebit, totalCredit, isBalanced } = generateJournalLegs(payrolls, mappings, voucherNumber, voucherDate);

    if (!isBalanced) {
      logger.warn('Generated unbalanced journal voucher', {
        month,
        year,
        totalDebit,
        totalCredit
      });
    }

    const voucher = await JournalVoucher.create({
      month,
      year,
      voucherNumber,
      voucherDate,
      legs,
      totalDebit,
      totalCredit,
      isBalanced,
      generatedBy: req.userId
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'JOURNAL_VOUCHER_GENERATED',
      resourceType: 'JournalVoucher',
      resourceIds: [voucher._id],
      details: { voucherNumber, month, year, totalDebit, totalCredit, isBalanced },
      req,
    });

    res.status(201).json({ message: 'Journal voucher generated', voucher });
  } catch (error) { next(error); }
};

/**
 * GET /api/accounting/trial-balance
 * Generates a consolidated Trial Balance report across all Journal Vouchers.
 */
exports.getTrialBalance = async (req, res, next) => {
  try {
    const { year, fromMonth, toMonth } = req.query;

    const filter = {};
    if (year) filter.year = Number(year);
    if (fromMonth || toMonth) {
      filter.month = {};
      if (fromMonth) filter.month.$gte = Number(fromMonth);
      if (toMonth) filter.month.$lte = Number(toMonth);
    }

    const vouchers = await JournalVoucher.find(filter).lean();
    const mappings = await GLAccountMapping.find({}).lean();

    const trialBalance = computeTrialBalance(vouchers, mappings);

    res.status(200).json({
      success: true,
      filter: { year, fromMonth, toMonth },
      trialBalance,
    });
  } catch (error) { next(error); }
};

/**
 * GET /api/accounting/export/:id/tally
 * Downloads the Tally TDL9 XML file for a specific journal voucher.
 */
exports.exportTallyXml = async (req, res, next) => {
  try {
    const voucher = await JournalVoucher.findOne({
      _id: req.params.id
    });
    if (!voucher) return res.status(404).json({ message: 'Journal voucher not found' });

    const xml = generateTallyXml(voucher);

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename=${voucher.voucherNumber.replace(/\//g, '-')}-Tally.xml`);
    res.status(200).send(xml);

    voucher.exportedToERP = true;
    await voucher.save();
  } catch (error) { next(error); }
};

/**
 * GET /api/accounting/export/:id/csv
 * Downloads generic ERP CSV for a specific journal voucher.
 */
exports.exportCsv = async (req, res, next) => {
  try {
    const voucher = await JournalVoucher.findOne({
      _id: req.params.id
    });
    if (!voucher) return res.status(404).json({ message: 'Journal voucher not found' });

    const csv = generateGenericCsv(voucher);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${voucher.voucherNumber.replace(/\//g, '-')}-ERP.csv`);
    res.status(200).send(csv);
  } catch (error) { next(error); }
};
