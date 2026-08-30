/**
 * @fileoverview ACA Reporting Schemas
 * @description Tracks Affordable Care Act (ACA) measurement periods, monthly eligibility ledgers, 
 * and 1094-C/1095-C draft forms for IRS compliance.
 * Issue: #1624
 */
const mongoose = require('mongoose');

/**
 * ACAMeasurementPeriod Schema
 * Defines the look-back and stability periods for variable-hour employees.
 */
const acaMeasurementPeriodSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true }, // e.g., "2025 Standard Look-Back"

    lookBackStart: { type: Date, required: true },
    lookBackEnd: { type: Date, required: true },

    stabilityStart: { type: Date, required: true },
    stabilityEnd: { type: Date, required: true },

    fullTimeThresholdHours: { type: Number, default: 30 }, // 30 hours/week or 130 hours/month
    isALE: { type: Boolean, default: true } // Applicable Large Employer (50+ FTEs)
}, { timestamps: true });

const ACAMeasurementPeriod = mongoose.model('ACAMeasurementPeriod', acaMeasurementPeriodSchema);

/**
 * MonthlyEligibilityLedger Schema
 * Tracks monthly hours, coverage offers, and IRS Line 14/16 codes for 1095-C.
 */
const monthlyEligibilityLedgerSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },

    hoursWorked: { type: Number, default: 0 },
    isFullTime: { type: Boolean, default: false },

    // Coverage Details
    isOfferedCoverage: { type: Boolean, default: false },
    isAffordable: { type: Boolean, default: false },
    employeeContribution: { type: Number, default: 0 }, // Monthly cost for self-only coverage

    // IRS Codes for Form 1095-C
    line14Code: { type: String, default: '1H' }, // 1H = No offer of coverage
    line16Code: { type: String, default: '2A' }, // 2A = Not employed

    safeHarborUsed: { type: String, enum: ['W2', 'RateOfPay', 'FPL', 'None'], default: 'None' }
}, { timestamps: true });

monthlyEligibilityLedgerSchema.index({ tenantId: 1, employeeId: 1, year: 1, month: 1 }, { unique: true });
const MonthlyEligibilityLedger = mongoose.model('MonthlyEligibilityLedger', monthlyEligibilityLedgerSchema);

/**
 * Form1095CDraft Schema
 * Stores the generated XML/CSV payload for annual IRS submission.
 */
const form1095CDraftSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    taxYear: { type: Number, required: true },

    totalFormsGenerated: { type: Number, default: 0 },
    totalFullTimeEmployees: { type: Number, default: 0 },

    fileFormat: { type: String, enum: ['XML', 'CSV'], default: 'XML' },
    fileContent: { type: String, default: '' }, // Mocked XML/CSV string
    fileName: { type: String, default: '' },

    status: { type: String, enum: ['Draft', 'Finalized', 'Submitted'], default: 'Draft' },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

const Form1095CDraft = mongoose.model('Form1095CDraft', form1095CDraftSchema);

module.exports = { ACAMeasurementPeriod, MonthlyEligibilityLedger, Form1095CDraft };
