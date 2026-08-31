/**
 * @fileoverview Workers' Compensation Schemas
 * @description Tracks NCCI class codes, employee mappings, payroll ledgers, 
 * and annual premium audit reports for insurance carrier compliance.
 * Issue: #2061
 */
const mongoose = require('mongoose');

/**
 * WCClassCode Schema
 * Stores the company's specific NCCI codes and their base manual rates.
 */
const wcClassCodeSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    ncciCode: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    baseManualRate: { type: Number, required: true, min: 0 }, // Rate per $100 of payroll

    stateCode: { type: String, required: true, uppercase: true },
    allowsOTExclusion: { type: Boolean, default: true },

    isActive: { type: Boolean, default: true }
}, { timestamps: true });

wcClassCodeSchema.index({ tenantId: 1, ncciCode: 1, stateCode: 1 }, { unique: true });
const WCClassCode = mongoose.model('WCClassCode', wcClassCodeSchema);

/**
 * WCEmployeeMapping Schema
 * Maps employees to their primary and secondary WC class codes based on job duties.
 */
const wcEmployeeMappingSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

    primaryNCCI: { type: String, required: true },
    secondaryNCCI: { type: String, default: null },
    splitPercentage: { type: Number, default: 100 }, // % of time spent in primary code

    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date, default: null }
}, { timestamps: true });

wcEmployeeMappingSchema.index({ tenantId: 1, employeeId: 1, effectiveFrom: 1 });
const WCEmployeeMapping = mongoose.model('WCEmployeeMapping', wcEmployeeMappingSchema);

/**
 * WCPayrollLedger Schema
 * Tracks WC-eligible wages per pay period, stripping out excluded OT premiums.
 */
const wcPayrollLedgerSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    payrollRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollUpdate', required: true },

    ncciCode: { type: String, required: true },
    grossWages: { type: Number, required: true },
    overtimePremium: { type: Number, default: 0 },
    excludedOTPremium: { type: Number, default: 0 },
    wcEligibleWages: { type: Number, required: true },

    estimatedPremium: { type: Number, required: true }, // (Eligible Wages / 100) * Rate * EMR
    periodMonth: { type: Number, required: true },
    periodYear: { type: Number, required: true }
}, { timestamps: true });

const WCPayrollLedger = mongoose.model('WCPayrollLedger', wcPayrollLedgerSchema);

/**
 * WCAuditReport Schema
 * Stores the annual carrier audit summary and discrepancy flags.
 */
const wcAuditReportSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    policyYear: { type: Number, required: true },

    totalGrossPayroll: { type: Number, default: 0 },
    totalWCEligiblePayroll: { type: Number, default: 0 },
    totalEstimatedPremium: { type: Number, default: 0 },

    classCodeBreakdown: [{
        ncciCode: String,
        description: String,
        eligibleWages: Number,
        manualRate: Number,
        calculatedPremium: Number
    }],

    auditFlags: [{
        employeeId: mongoose.Schema.Types.ObjectId,
        flagType: String, // e.g., 'Missing Mapping', 'High Risk Misclassification'
        message: String
    }],

    companyEMR: { type: Number, default: 1.0 },
    status: { type: String, enum: ['Draft', 'Finalized', 'Submitted to Carrier'], default: 'Draft' }
}, { timestamps: true });

wcAuditReportSchema.index({ tenantId: 1, policyYear: 1 }, { unique: true });
const WCAuditReport = mongoose.model('WCAuditReport', wcAuditReportSchema);

module.exports = { WCClassCode, WCEmployeeMapping, WCPayrollLedger, WCAuditReport };
