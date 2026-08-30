/**
 * @fileoverview Earned Wage Access (EWA) Schemas
 * @description Tracks daily wage accruals, early withdrawal requests, 
 * transaction fees, and final payroll reconciliation offsets.
 * Issue: #1569
 */
const mongoose = require('mongoose');

/**
 * EWAConfig Schema
 * Defines company-wide rules for EWA availability, caps, and fees.
 */
const ewaConfigSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, unique: true },
    isEnabled: { type: Boolean, default: true },
    maxAccrualPercentage: { type: Number, default: 0.50, min: 0, max: 1 }, // e.g., 50% of accrued wages
    estimatedTaxHoldbackRate: { type: Number, default: 0.25, min: 0, max: 1 }, // 25% held back for taxes
    transactionFee: { type: Number, default: 2.99 }, // Flat fee per withdrawal
    maxWithdrawalsPerPeriod: { type: Number, default: 3 },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

const EWAConfig = mongoose.model('EWAConfig', ewaConfigSchema);

/**
 * EWAAccrual Schema
 * Tracks the daily gross earnings and estimated tax holdbacks for an employee.
 */
const ewaAccrualSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

    payPeriodStart: { type: Date, required: true },
    payPeriodEnd: { type: Date, required: true },
    accrualDate: { type: Date, required: true },

    grossDailyEarnings: { type: Number, required: true, min: 0 },
    estimatedTaxHoldback: { type: Number, required: true, min: 0 },
    netDailyAccrual: { type: Number, required: true, min: 0 },

    // Cumulative totals for the current pay period
    cumulativeGross: { type: Number, default: 0 },
    cumulativeNetAccrued: { type: Number, default: 0 }
}, { timestamps: true });

ewaAccrualSchema.index({ tenantId: 1, employeeId: 1, accrualDate: 1 }, { unique: true });
const EWAAccrual = mongoose.model('EWAAccrual', ewaAccrualSchema);

/**
 * WithdrawalRequest Schema
 * Tracks individual early wage drawdowns.
 */
const withdrawalRequestSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

    requestedAmount: { type: Number, required: true, min: 0 },
    transactionFee: { type: Number, required: true, min: 0 },
    totalDeduction: { type: Number, required: true }, // Amount + Fee

    transferMethod: { type: String, enum: ['Direct Deposit', 'Debit Card', 'ACH'], default: 'ACH' },

    status: {
        type: String,
        enum: ['Pending', 'Funded', 'Failed', 'Reconciled'],
        default: 'Pending',
        index: true
    },

    fundedAt: { type: Date, default: null },
    reconciledAt: { type: Date, default: null },
    payrollRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollUpdate', default: null }
}, { timestamps: true });

const WithdrawalRequest = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);

/**
 * PaydayReconciliation Schema
 * Tracks the final offset injected into the official payroll run to recover EWA advances.
 */
const paydayReconciliationSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    payrollRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollUpdate', required: true },

    totalAdvancesRecovered: { type: Number, required: true },
    totalFeesRecovered: { type: Number, required: true },
    totalOffsetAmount: { type: Number, required: true }, // Negative deduction applied to payroll

    withdrawalsCleared: [{ type: mongoose.Schema.Types.ObjectId, ref: 'WithdrawalRequest' }]
}, { timestamps: true });

const PaydayReconciliation = mongoose.model('PaydayReconciliation', paydayReconciliationSchema);

module.exports = { EWAConfig, EWAAccrual, WithdrawalRequest, PaydayReconciliation };
