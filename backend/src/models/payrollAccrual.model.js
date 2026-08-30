/**
 * @fileoverview Month-End Accrual & PTO Liability Schemas
 * Issue: #1938
 */
const mongoose = require('mongoose');

const accrualPolicySchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, unique: true },
    valuationMethod: { type: String, enum: ['CurrentRate', 'FIFO', 'LIFO'], default: 'CurrentRate' },
    includeBurden: { type: Boolean, default: true }, // Include employer taxes in PTO valuation
    burdenPercentage: { type: Number, default: 0.15 }, // 15% employer burden rate
    cutoffDays: { type: Number, default: 3 } // Days to accrue past period end
}, { timestamps: true });
const AccrualPolicy = mongoose.model('AccrualPolicy', accrualPolicySchema);

const ptoLiabilityLedgerSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    periodMonth: { type: Number, required: true },
    periodYear: { type: Number, required: true },
    ptoHoursBalance: { type: Number, required: true },
    hourlyRate: { type: Number, required: true },
    burdenRate: { type: Number, default: 0 },
    totalLiabilityValue: { type: Number, required: true }
}, { timestamps: true });
ptoLiabilityLedgerSchema.index({ tenantId: 1, employeeId: 1, periodYear: 1, periodMonth: 1 }, { unique: true });
const PTOLiabilityLedger = mongoose.model('PTOLiabilityLedger', ptoLiabilityLedgerSchema);

const monthEndAccrualBatchSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    periodMonth: { type: Number, required: true },
    periodYear: { type: Number, required: true },
    totalCutoffWages: { type: Number, default: 0 },
    totalPTOLiability: { type: Number, default: 0 },
    varianceAdjustment: { type: Number, default: 0 }, // True-up from previous month
    status: { type: String, enum: ['Draft', 'Approved', 'Posted to GL'], default: 'Draft' }
}, { timestamps: true });
monthEndAccrualBatchSchema.index({ tenantId: 1, periodYear: 1, periodMonth: 1 }, { unique: true });
const MonthEndAccrualBatch = mongoose.model('MonthEndAccrualBatch', monthEndAccrualBatchSchema);

module.exports = { AccrualPolicy, PTOLiabilityLedger, MonthEndAccrualBatch };
