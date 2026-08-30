/**
 * Fringe Benefit Record Model - Issue #1600
 *
 * Stores employer-provided non-cash perks, taxable gross-up valuations, and FBT liabilities.
 */
'use strict';

const mongoose = require('mongoose');

const fringeBenefitRecordSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    benefitCategory: {
      type: String,
      enum: ['company_car', 'housing', 'club_membership', 'concessional_loan', 'meal_vouchers', 'wellness_stipend'],
      required: true,
    },
    quarter: { type: String, required: true }, // e.g. "2026-Q1"
    rawBenefitValue: { type: Number, required: true, min: 0 },
    employeeContribution: { type: Number, default: 0, min: 0 },
    netTaxableBenefitValue: { type: Number, required: true },
    grossUpFactorType: { type: String, enum: ['type_1_gst_credited', 'type_2_gst_free'], default: 'type_1_gst_credited' },
    grossUpMultiplier: { type: Number, default: 2.0802 }, // Standard statutory Type 1 gross-up multiplier
    grossedUpTaxableValue: { type: Number, required: true },
    fbtRatePercent: { type: Number, default: 47 }, // Standard statutory FBT tax rate %
    employerFbtLiability: { type: Number, required: true },
    status: { type: String, enum: ['active', 'reported', 'settled'], default: 'active' },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FringeBenefitRecord', fringeBenefitRecordSchema);