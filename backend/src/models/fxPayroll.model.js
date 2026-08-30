/**
 * @fileoverview FX Payroll & Variance Schemas
 * @description Tracks multi-currency payroll batches, exchange rate locks, and FX gain/loss ledgers.
 * Issue: #1568
 */
const mongoose = require('mongoose');

/**
 * FXPayrollBatch Schema
 * Represents a batch of contractor invoices approved for payment in foreign currencies.
 */
const fxPayrollBatchSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    batchName: { type: String, required: true }, // e.g., "Global Contractors - Oct 2026"
    baseCurrency: { type: String, required: true, default: 'USD' },

    // Financials in Base Currency
    totalBaseLiability: { type: Number, default: 0 },

    status: {
        type: String,
        enum: ['Draft', 'Rate Locked', 'Wires Sent', 'Settled'],
        default: 'Draft',
        index: true
    },

    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    settledAt: { type: Date, default: null }
}, { timestamps: true });

const FXPayrollBatch = mongoose.model('FXPayrollBatch', fxPayrollBatchSchema);

/**
 * ExchangeRateLock Schema
 * Tracks the locked exchange rate for a specific batch to calculate variance later.
 */
const exchangeRateLockSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'FXPayrollBatch', required: true, index: true },

    foreignCurrency: { type: String, required: true }, // e.g., 'EUR', 'GBP'
    totalForeignAmount: { type: Number, required: true },

    lockedRate: { type: Number, required: true }, // e.g., 1.15 USD per EUR
    lockedBaseAmount: { type: Number, required: true }, // TotalForeign * LockedRate

    lockExpiresAt: { type: Date, required: true }, // Usually 24-48 hours
    isExpired: { type: Boolean, default: false }
}, { timestamps: true });

const ExchangeRateLock = mongoose.model('ExchangeRateLock', exchangeRateLockSchema);

/**
 * FXVarianceLedger Schema
 * Records the FX Gain or Loss when the actual wire transfer clears at a different rate.
 */
const fxVarianceLedgerSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'FXPayrollBatch', required: true, index: true },

    foreignCurrency: { type: String, required: true },
    foreignAmount: { type: Number, required: true },

    lockedRate: { type: Number, required: true },
    actualSettlementRate: { type: Number, required: true },

    lockedBaseAmount: { type: Number, required: true },
    actualBaseAmount: { type: Number, required: true },

    varianceAmount: { type: Number, required: true }, // Actual - Locked
    varianceType: { type: String, enum: ['Gain', 'Loss'], required: true }
}, { timestamps: true });

const FXVarianceLedger = mongoose.model('FXVarianceLedger', fxVarianceLedgerSchema);

module.exports = { FXPayrollBatch, ExchangeRateLock, FXVarianceLedger };
