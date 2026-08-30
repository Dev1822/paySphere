/**
 * Expat COLA & Housing Differential Setting Model - Issue #1814
 *
 * Stores destination-to-home location COLA index ratios, spendable income tier curves,
 * housing allowance norms, and location hardship percentages.
 */
'use strict';

const mongoose = require('mongoose');

const expatColaSettingSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    homeCountry: { type: String, required: true },
    homeCity: { type: String, required: true },
    hostCountry: { type: String, required: true },
    hostCity: { type: String, required: true },
    effectiveYear: { type: Number, required: true }, // e.g. 2026
    priceIndexRatio: { type: Number, required: true, min: 50, max: 300, default: 100 }, // e.g. 125.5 means 25.5% higher
    spendableIncomePercent: { type: Number, required: true, min: 10, max: 70, default: 40 }, // % of base pay considered spendable
    hostHousingNormMonthly: { type: Number, required: true, min: 0 },
    homeHousingNormMonthly: { type: Number, required: true, min: 0 },
    hardshipAllowancePercent: { type: Number, default: 0, min: 0, max: 50 },
    currencyCode: { type: String, default: 'USD' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

expatColaSettingSchema.index(
  { tenantId: 1, homeCity: 1, hostCity: 1, effectiveYear: 1 },
  { unique: true }
);

module.exports = mongoose.model('ExpatColaSetting', expatColaSettingSchema);