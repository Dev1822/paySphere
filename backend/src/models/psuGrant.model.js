/**
 * PSU Grant Model - Issue #1598
 *
 * Stores executive Performance Share Units with relative TSR benchmarks and dynamic payout multipliers.
 */
'use strict';

const mongoose = require('mongoose');

const psuGrantSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    grantNumber: { type: String, required: true },
    grantDate: { type: Date, required: true },
    performancePeriod: {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
    },
    targetShares: { type: Number, required: true, min: 1 },
    baselineCompanyStockPrice: { type: Number, required: true, min: 0.01 },
    peerTickers: [
      {
        ticker: { type: String, required: true },
        baselinePrice: { type: Number, required: true },
        finalPrice: { type: Number },
        tsrPercent: { type: Number },
      },
    ],
    finalCompanyStockPrice: { type: Number },
    companyTsrPercent: { type: Number },
    calculatedPercentileRank: { type: Number }, // 0 to 100
    vestingMultiplier: { type: Number, default: 1.0 }, // 0.0 to 2.0 (0% to 200%)
    finalSharesVested: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'evaluated', 'settled', 'forfeited'], default: 'active' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

psuGrantSchema.index({ tenantId: 1, grantNumber: 1 }, { unique: true });

module.exports = mongoose.model('PsuGrant', psuGrantSchema);