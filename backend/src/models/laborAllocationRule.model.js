/**
 * Labor Allocation Rule Model - Issue #1599
 *
 * Defines default or dynamic project cost code allocation percentages for workforce members.
 */
'use strict';

const mongoose = require('mongoose');

const laborAllocationRuleSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date },
    allocationMethod: { type: String, enum: ['fixed_percentage', 'timesheet_hours'], default: 'timesheet_hours' },
    splits: [
      {
        projectCode: { type: String, required: true }, // e.g. "PRJ-ALPHA", "RD-TAX-CREDIT"
        costCenter: { type: String, required: true },
        percentage: { type: Number, min: 0, max: 100 }, // For fixed_percentage method
      },
    ],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LaborAllocationRule', laborAllocationRuleSchema);