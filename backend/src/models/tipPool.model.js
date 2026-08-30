/**
 * @fileoverview Tip Pooling & Gratuity Schemas
 * @description Tracks tip pool configurations, daily gratuity ledgers, and distribution batches.
 * Issue: #1567
 */
const mongoose = require('mongoose');

/**
 * TipPoolConfiguration Schema
 * Defines the hierarchy, ratios, and eligibility rules for a specific tip pool.
 */
const tipPoolConfigurationSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    poolName: { type: String, required: true }, // e.g., "Front of House", "BOH Support"

    // Allocation Weights (e.g., Server: 100%, Bartender: 80%, Busser: 50%)
    jobWeights: [{
        jobClassification: { type: String, required: true },
        weightPercentage: { type: Number, required: true, min: 0, max: 100 }
    }],

    // FLSA Guardrails
    allowManagers: { type: Boolean, default: false }, // Strict FLSA: Managers cannot participate
    allowOwners: { type: Boolean, default: false },

    isActive: { type: Boolean, default: true }
}, { timestamps: true });

const TipPoolConfiguration = mongoose.model('TipPoolConfiguration', tipPoolConfigurationSchema);

/**
 * DailyGratuityLedger Schema
 * Tracks the total gross tips collected on a specific business day.
 */
const dailyGratuityLedgerSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    date: { type: Date, required: true },

    grossCashTips: { type: Number, default: 0, min: 0 },
    grossCreditTips: { type: Number, default: 0, min: 0 },
    totalGrossTips: { type: Number, required: true },

    // Tip-out allocations (e.g., 5% to BOH)
    bohtipOutPercentage: { type: Number, default: 0 },
    bohTipOutAmount: { type: Number, default: 0 },

    netFOHTips: { type: Number, required: true }, // Tips available for FOH pool

    status: {
        type: String,
        enum: ['Draft', 'Finalized', 'Distributed'],
        default: 'Draft'
    },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

dailyGratuityLedgerSchema.index({ tenantId: 1, date: 1 }, { unique: true });
const DailyGratuityLedger = mongoose.model('DailyGratuityLedger', dailyGratuityLedgerSchema);

/**
 * TipDistributionBatch Schema
 * The final calculated payouts for a specific pay period.
 */
const tipDistributionBatchSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },

    totalDistributed: { type: Number, default: 0 },
    makeWholeAdjustments: { type: Number, default: 0 }, // Total employer top-ups for minimum wage

    distributions: [{
        employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        hoursWorked: { type: Number, required: true },
        jobClassification: { type: String, required: true },
        rawTipShare: { type: Number, required: true },
        makeWholeTopUp: { type: Number, default: 0 },
        finalPayout: { type: Number, required: true }
    }],

    status: {
        type: String,
        enum: ['Calculated', 'Approved', 'Injected to Payroll'],
        default: 'Calculated'
    }
}, { timestamps: true });

const TipDistributionBatch = mongoose.model('TipDistributionBatch', tipDistributionBatchSchema);

module.exports = { TipPoolConfiguration, DailyGratuityLedger, TipDistributionBatch };
