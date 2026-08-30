/**
 * @fileoverview Worker's Compensation & Premium Audit Schemas
 * @description Tracks NCCI risk classifications, premium ledgers, and annual audit reconciliations.
 * Issue: #1570
 */
const mongoose = require('mongoose');

/**
 * RiskClassification Schema
 * Defines NCCI codes, premium rates, and statutory executive caps.
 */
const riskClassificationSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    ncciCode: { type: String, required: true, uppercase: true }, // e.g., "8810" (Clerical), "5183" (Plumbing)
    description: { type: String, required: true },

    // Premium Rate per $100 of payroll
    ratePer100: { type: Number, required: true, min: 0 },

    // State-specific statutory maximum remuneration limit for corporate officers
    officerMaxRemuneration: { type: Number, default: Infinity },
    isExecutiveCode: { type: Boolean, default: false },

    isActive: { type: Boolean, default: true }
}, { timestamps: true });

riskClassificationSchema.index({ tenantId: 1, ncciCode: 1 }, { unique: true });
const RiskClassification = mongoose.model('RiskClassification', riskClassificationSchema);

/**
 * EmployeeRiskMapping Schema
 * Links an employee to a specific NCCI code for payroll interception.
 */
const employeeRiskMappingSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, unique: true },
    riskClassificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'RiskClassification', required: true },
    isCorporateOfficer: { type: Boolean, default: false },

    effectiveFrom: { type: Date, default: Date.now },
    effectiveTo: { type: Date, default: null }
}, { timestamps: true });

const EmployeeRiskMapping = mongoose.model('EmployeeRiskMapping', employeeRiskMappingSchema);

/**
 * WCPremiumLedger Schema
 * Tracks the estimated WC premium deducted per payroll run.
 */
const wcPremiumLedgerSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    payrollRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollUpdate', required: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    riskClassificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'RiskClassification', required: true },

    ncciCode: { type: String, required: true },
    grossPayroll: { type: Number, required: true },
    cappedPayroll: { type: Number, required: true }, // Payroll after applying officer cap

    premiumRate: { type: Number, required: true },
    estimatedPremium: { type: Number, required: true }, // (CappedPayroll / 100) * Rate

    periodMonth: { type: Number, required: true },
    periodYear: { type: Number, required: true }
}, { timestamps: true });

wcPremiumLedgerSchema.index({ tenantId: 1, periodYear: 1, ncciCode: 1 });
const WCPremiumLedger = mongoose.model('WCPremiumLedger', wcPremiumLedgerSchema);

/**
 * WCAuditReport Schema
 * Stores the annual reconciliation variance report for the insurance auditor.
 */
const wcAuditReportSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    auditYear: { type: Number, required: true },
    experienceModifier: { type: Number, default: 1.0 }, // E-Mod (e.g., 0.85 for good safety record)

    totalEstimatedPremiumPaid: { type: Number, required: true },
    totalActualPremiumCalculated: { type: Number, required: true },

    varianceAmount: { type: Number, required: true }, // Actual - Estimated
    varianceType: { type: String, enum: ['Owed to Insurer', 'Refund Due', 'Balanced'], required: true },

    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    generatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const WCAuditReport = mongoose.model('WCAuditReport', wcAuditReportSchema);

module.exports = { RiskClassification, EmployeeRiskMapping, WCPremiumLedger, WCAuditReport };
