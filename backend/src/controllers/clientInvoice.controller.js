/**
 * @fileoverview Client Invoicing & Forex Controller
 * @description Manages foreign currency invoices, payment recording, forex ledger reconciliation,
 * and AR aging bucket analysis.
 */
const mongoose = require('mongoose');
const { Client, ClientInvoice, ForexLedger } = require('../models/clientInvoice.model');
const {
  calculateRealizedGainLoss,
  getExchangeRate,
  calculateAgingBuckets,
  calculateOverdueInterest,
} = require('../utils/forexReconciliation');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');

/**
 * POST /api/clients/invoices
 * Generate a new multi-currency invoice, locking in the exchange rate for the day.
 */
exports.createInvoice = async (req, res, next) => {
  try {
    const { clientId, invoiceNumber, invoiceDate, foreignAmount } = req.body;

    const client = await Client.findOne({
      _id: clientId
    });
    if (!client) return res.status(404).json({ message: 'Client not found' });

    // Fetch current exchange rate (e.g., USD to INR)
    const exchangeRate = await getExchangeRate(client.defaultCurrency, 'INR');
    const inrEquivalent = Math.round((Number(foreignAmount) * exchangeRate) * 100) / 100;

    const invoice = await ClientInvoice.create({
      clientId,
      invoiceNumber,
      invoiceDate: new Date(invoiceDate),
      foreignAmount: Number(foreignAmount),
      foreignCurrency: client.defaultCurrency,
      exchangeRateAtInvoice: exchangeRate,
      inrEquivalent
    });

    res.status(201).json({ message: 'Invoice generated', invoice });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'Invoice number already exists.' });
    next(error);
  }
};

/**
 * POST /api/clients/invoices/:id/payment
 * Record a bank payment realization and calculate the exact Forex Gain/Loss.
 */
exports.recordPayment = async (req, res, next) => {
  try {
    const { inrReceived, bankCharges, transactionDate } = req.body;
    const invoice = await ClientInvoice.findOne({
      _id: req.params.id
    });

    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (invoice.status === 'Paid') return res.status(400).json({ message: 'Invoice is already fully paid.' });

    // Calculate Realized Gain/Loss
    const reconciliation = calculateRealizedGainLoss(
      Number(inrReceived),
      invoice.inrEquivalent,
      Number(bankCharges) || 0,
    );

    // Determine effective exchange rate at payment
    const effectiveRate = reconciliation.netInr / invoice.foreignAmount;

    // Update Invoice
    invoice.amountReceivedINR += reconciliation.netInr;
    invoice.forexGainLoss += reconciliation.realizedGainLoss;
    invoice.status = invoice.amountReceivedINR >= invoice.inrEquivalent ? 'Paid' : 'Partially Paid';
    await invoice.save();

    // Log to Forex Ledger
    const ledgerEntry = await ForexLedger.create({
      invoiceId: invoice._id,
      transactionDate: new Date(transactionDate),
      inrReceived: Number(inrReceived),
      bankCharges: Number(bankCharges) || 0,
      realizedGainLoss: reconciliation.realizedGainLoss,
      exchangeRateAtPayment: effectiveRate
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'FOREX_PAYMENT_RECORDED',
      resourceType: 'ForexLedger',
      resourceIds: [ledgerEntry._id],
      details: { invoiceNumber: invoice.invoiceNumber, gainLoss: reconciliation.realizedGainLoss },
      req,
    });

    res.status(200).json({
      message: 'Payment recorded and forex reconciled',
      invoice,
      ledgerEntry,
      gainLossBreakdown: reconciliation,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/clients/invoices/dashboard
 * Fetch summary of outstanding foreign receivables and total realized gains/losses.
 */
exports.getDashboard = async (req, res, next) => {
  try {
    const invoices = await ClientInvoice.find({
      status: { $ne: 'Paid' }
    })
      .populate('clientId', 'name defaultCurrency')
      .sort({ invoiceDate: -1 });

    const totalOutstandingForeign = invoices.reduce((sum, inv) => sum + (inv.foreignAmount - (inv.amountReceivedINR / inv.exchangeRateAtInvoice)), 0);
    const totalRealizedGainLoss = await ForexLedger.aggregate([
      { $match: { tenantId: mongoose.Types.ObjectId(req.tenantId) } },
      { $group: { _id: null, total: { $sum: '$realizedGainLoss' } } },
    ]);

    res.status(200).json({
      openInvoices: invoices,
      totalOutstandingForeign: Math.round(totalOutstandingForeign * 100) / 100,
      totalRealizedGainLoss: totalRealizedGainLoss[0]?.total || 0,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/clients/invoices/aging-report
 * Fetch Accounts Receivable (AR) aging analysis across 0-30, 31-60, 61-90, and 90+ day buckets.
 */
exports.getAgingReport = async (req, res, next) => {
  try {
    const openInvoices = await ClientInvoice.find({
      status: { $ne: 'Paid' }
    })
      .populate('clientId', 'name defaultCurrency')
      .sort({ invoiceDate: 1 })
      .lean();

    const aging = calculateAgingBuckets(openInvoices, req.query?.asOfDate || new Date());

    // Calculate overdue penalty interest across overdue buckets (> 30 days)
    const overdueInterest = openInvoices.reduce((acc, inv) => {
      const invDate = new Date(inv.invoiceDate || inv.createdAt).getTime();
      const ageDays = Math.max(0, Math.floor((Date.now() - invDate) / (1000 * 60 * 60 * 24)));
      const openAmount = Number(inv.inrEquivalent || 0) - Number(inv.amountReceivedINR || 0);
      if (ageDays > 30 && openAmount > 0) {
        return acc + calculateOverdueInterest(openAmount, ageDays - 30);
      }
      return acc;
    }, 0);

    res.status(200).json({
      success: true,
      reportDate: new Date(),
      totalOutstandingINR: aging.totalOutstanding,
      estimatedOverdueInterestINR: Math.round(overdueInterest * 100) / 100,
      agingBuckets: aging.buckets,
    });
  } catch (error) {
    next(error);
  }
};
