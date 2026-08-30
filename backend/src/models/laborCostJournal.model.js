/**
 * Labor Cost Journal Model - Issue #1599
 *
 * Audit ledger recording activity-based labor cost voucher line items distributed across cost codes.
 */
'use strict';

const mongoose = require('mongoose');

const laborCostJournalSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    payrollRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payroll', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    projectCode: { type: String, required: true, index: true },
    costCenter: { type: String, required: true },
    hoursLogged: { type: Number, default: 0 },
    allocationRatio: { type: Number, required: true }, // 0.0 to 1.0
    allocatedBaseSalary: { type: Number, required: true },
    allocatedOvertime: { type: Number, default: 0 },
    allocatedEmployerTaxes: { type: Number, default: 0 },
    allocatedBenefitsCost: { type: Number, default: 0 },
    totalAllocatedCost: { type: Number, required: true },
    postedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LaborCostJournal', laborCostJournalSchema);