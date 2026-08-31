/**
 * Intercompany Billing Controller - Issue #1815
 */
'use strict';

const IntercompanyPayrollBilling = require('../models/intercompanyPayrollBilling.model');
const { calculateTransferPricingBilling } = require('../services/intercompanyBilling.service');
const logger = require('../utils/logger');

async function previewBilling(req, res) {
  try {
    const { rawDirectLaborCost, rawAllocatedBenefitsCost, transferPricingMarkupPercent } = req.body;
    if (rawDirectLaborCost === undefined) {
      return res.status(400).json({ message: 'rawDirectLaborCost is required.' });
    }

    const metrics = calculateTransferPricingBilling({
      rawDirectLaborCost: Number(rawDirectLaborCost),
      rawAllocatedBenefitsCost: Number(rawAllocatedBenefitsCost) || 0,
      transferPricingMarkupPercent: transferPricingMarkupPercent !== undefined ? Number(transferPricingMarkupPercent) : 7.5,
    });

    return res.json({ metrics });
  } catch (err) {
    logger.error('previewBilling error', { error: err.message });
    return res.status(400).json({ message: err.message });
  }
}

async function createVoucher(req, res) {
  try {
    const {
      billingVoucherNumber,
      period,
      sendingEntityId,
      sendingEntityName,
      receivingEntityId,
      receivingEntityName,
      department,
      rawDirectLaborCost,
      rawAllocatedBenefitsCost,
      transferPricingMarkupPercent,
      currencyCode,
    } = req.body;

    if (
      !billingVoucherNumber ||
      !period ||
      !sendingEntityId ||
      !receivingEntityId ||
      !department ||
      rawDirectLaborCost === undefined
    ) {
      return res.status(400).json({
        message: 'billingVoucherNumber, period, sendingEntityId, receivingEntityId, department, and rawDirectLaborCost are required.',
      });
    }

    const metrics = calculateTransferPricingBilling({
      rawDirectLaborCost: Number(rawDirectLaborCost),
      rawAllocatedBenefitsCost: Number(rawAllocatedBenefitsCost) || 0,
      transferPricingMarkupPercent: transferPricingMarkupPercent !== undefined ? Number(transferPricingMarkupPercent) : 7.5,
    });

    const voucher = await IntercompanyPayrollBilling.create({
      billingVoucherNumber,
      period,
      sendingEntityId,
      sendingEntityName: sendingEntityName || 'Central Entity',
      receivingEntityId,
      receivingEntityName: receivingEntityName || 'Subsidiary Entity',
      department,
      rawDirectLaborCost: metrics.rawDirectLaborCost,
      rawAllocatedBenefitsCost: metrics.rawAllocatedBenefitsCost,
      subtotalDirectCost: metrics.subtotalDirectCost,
      transferPricingMarkupPercent: metrics.transferPricingMarkupPercent,
      transferPricingMarkupAmount: metrics.transferPricingMarkupAmount,
      totalBilledAmount: metrics.totalBilledAmount,
      currencyCode: currencyCode || 'USD',
      status: 'draft'
    });

    return res.status(201).json({ message: 'Intercompany billing voucher generated successfully.', voucher });
  } catch (err) {
    logger.error('createVoucher error', { error: err.message });
    return res.status(500).json({ message: 'Failed to create intercompany billing voucher.' });
  }
}

async function getVouchers(req, res) {
  try {
    const filter = { ...{} };
    if (req.query.period) filter.period = req.query.period;
    if (req.query.sendingEntityId) filter.sendingEntityId = req.query.sendingEntityId;
    if (req.query.receivingEntityId) filter.receivingEntityId = req.query.receivingEntityId;
    if (req.query.status) filter.status = req.query.status;

    const vouchers = await IntercompanyPayrollBilling.find(filter)
      .sort('-createdAt')
      .lean();

    return res.json({ count: vouchers.length, vouchers });
  } catch (err) {
    logger.error('getVouchers error', { error: err.message });
    return res.status(500).json({ message: 'Failed to fetch intercompany billing vouchers.' });
  }
}

async function approveVoucher(req, res) {
  try {
    const { id } = req.params;
    const voucher = await IntercompanyPayrollBilling.findOne({ _id: id, ...{} });
    if (!voucher) {
      return res.status(404).json({ message: 'Voucher not found.' });
    }

    voucher.status = 'approved';
    voucher.approvedBy = req.userId;
    await voucher.save();

    return res.json({ message: 'Voucher approved for intercompany settlement.', voucher });
  } catch (err) {
    logger.error('approveVoucher error', { error: err.message });
    return res.status(500).json({ message: 'Failed to approve voucher.' });
  }
}

module.exports = {
  previewBilling,
  createVoucher,
  getVouchers,
  approveVoucher,
};