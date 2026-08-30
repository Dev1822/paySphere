/**
 * Intercompany Payroll Billing Model - Issue #1815
 *
 * Stores cross-entity shared service labor cost allocations, transfer pricing markups,
 * and debit/credit ledger settlement vouchers across subsidiary legal entities.
 */
'use strict';

const mongoose = require('mongoose');

const intercompanyPayrollBillingSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    billingVoucherNumber: { type: String, required: true },
    period: { type: String, required: true }, // e.g. "2026-08"
    sendingEntityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true, index: true },
    sendingEntityName: { type: String, required: true },
    receivingEntityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true, index: true },
    receivingEntityName: { type: String, required: true },
    department: { type: String, required: true }, // e.g. "Global IT", "Central Legal"
    rawDirectLaborCost: { type: Number, required: true, min: 0 },
    rawAllocatedBenefitsCost: { type: Number, default: 0, min: 0 },
    subtotalDirectCost: { type: Number, required: true },
    transferPricingMarkupPercent: { type: Number, required: true, default: 7.5 }, // Standard Arm's Length 5% - 10%
    transferPricingMarkupAmount: { type: Number, required: true },
    totalBilledAmount: { type: Number, required: true },
    currencyCode: { type: String, default: 'USD' },
    status: { type: String, enum: ['draft', 'approved', 'invoiced', 'settled'], default: 'draft' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    settledAt: { type: Date },
  },
  { timestamps: true }
);

intercompanyPayrollBillingSchema.index({ tenantId: 1, billingVoucherNumber: 1 }, { unique: true });

module.exports = mongoose.model('IntercompanyPayrollBilling', intercompanyPayrollBillingSchema);