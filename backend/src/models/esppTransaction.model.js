/**
 * ESPP Transaction Model - Issue #1596
 *
 * Records share purchase execution with lookback price, applied statutory discount, and taxable perquisites.
 */
'use strict';

const mongoose = require('mongoose');

const esppTransactionSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    enrollmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'EsppEnrollment', required: true },
    offeringPeriodName: { type: String, required: true },
    grantPrice: { type: Number, required: true },
    purchaseDatePrice: { type: Number, required: true },
    lookbackPrice: { type: Number, required: true },
    discountPercent: { type: Number, default: 15 },
    finalPurchasePrice: { type: Number, required: true },
    totalContributed: { type: Number, required: true },
    sharesPurchased: { type: Number, required: true },
    residualRefund: { type: Number, default: 0 },
    taxablePerquisiteValue: { type: Number, default: 0 },
    purchaseDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EsppTransaction', esppTransactionSchema);