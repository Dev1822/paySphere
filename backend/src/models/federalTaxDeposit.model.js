/**
 * @fileoverview Federal Tax Deposit & Form 941 Schemas
 * @description Tracks lookback periods, tax liability accumulations, and quarterly filings.
 * Issue: #1869
 */
const mongoose = require('mongoose');

const taxDepositScheduleSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    calendarYear: { type: Number, required: true }, // The year the schedule applies to

    // Lookback period is the 4 quarters ending June 30 of the previous year
    lookbackStartDate: { type: Date, required: true },
    lookbackEndDate: { type: Date, required: true },
    lookbackTotalLiability: { type: Number, required: true },

    // $50,000 threshold determines Monthly vs Semi-Weekly
    depositorType: { type: String, enum: ['Monthly', 'Semi-Weekly', 'Annual'], required: true }
}, { timestamps: true });

taxDepositScheduleSchema.index({ tenantId: 1, calendarYear: 1 }, { unique: true });
const TaxDepositSchedule = mongoose.model('TaxDepositSchedule', taxDepositScheduleSchema);

const federalTaxLiabilityLedgerSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    payrollRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollUpdate', required: true },

    liabilityDate: { type: Date, required: true }, // Date wages were paid (determines semi-weekly deposit window)
    quarter: { type: Number, required: true, min: 1, max: 4 },

    federalIncomeTax: { type: Number, required: true },
    socialSecurityTax: { type: Number, required: true }, // Employee + Employer
    medicareTax: { type: Number, required: true },       // Employee + Employer

    totalLiability: { type: Number, required: true },

    // Deposit Tracking
    depositDueDate: { type: Date, required: true },
    isDeposited: { type: Boolean, default: false },
    depositedAt: { type: Date, default: null }
}, { timestamps: true });

const FederalTaxLiabilityLedger = mongoose.model('FederalTaxLiabilityLedger', federalTaxLiabilityLedgerSchema);

const form941FilingSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    taxYear: { type: Number, required: true },
    quarter: { type: Number, required: true, min: 1, max: 4 },

    totalWages: { type: Number, default: 0 },
    totalIncomeTaxWithheld: { type: Number, default: 0 },
    totalSSWages: { type: Number, default: 0 },
    totalSSTax: { type: Number, default: 0 },
    totalMedicareWages: { type: Number, default: 0 },
    totalMedicareTax: { type: Number, default: 0 },

    totalLiabilityForQuarter: { type: Number, required: true },
    totalDepositsMade: { type: Number, default: 0 },
    balanceDue: { type: Number, default: 0 }, // Or overpayment

    status: { type: String, enum: ['Draft', 'Filed', 'Accepted'], default: 'Draft' }
}, { timestamps: true });

form941FilingSchema.index({ tenantId: 1, taxYear: 1, quarter: 1 }, { unique: true });
const Form941Filing = mongoose.model('Form941Filing', form941FilingSchema);

module.exports = { TaxDepositSchedule, FederalTaxLiabilityLedger, Form941Filing };
