/**
 * @fileoverview Prevailing Wage & Davis-Bacon Schemas
 * @description Tracks project-specific wage determinations, fringe benefit offsets, 
 * and certified payroll reports (WH-347).
 * Issue: #1732
 */
const mongoose = require('mongoose');

/**
 * PrevailingWageDetermination Schema
 * Maps specific craft classifications to their mandated base and fringe rates for a project.
 */
const prevailingWageDeterminationSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    projectCode: { type: String, required: true, trim: true },
    projectName: { type: String, required: true },

    // Federal/State Contract Details
    contractNumber: { type: String, required: true },
    wageDecisionNumber: { type: String, required: true },
    effectiveDate: { type: Date, required: true },

    // Craft Classifications and Rates
    classifications: [{
        craftName: { type: String, required: true }, // e.g., "Electrician", "Plumber"
        baseHourlyRate: { type: Number, required: true, min: 0 },
        fringeHourlyRate: { type: Number, required: true, min: 0 },
        totalPackageRate: { type: Number, required: true } // Base + Fringe
    }],

    isActive: { type: Boolean, default: true }
}, { timestamps: true });

prevailingWageDeterminationSchema.index({ tenantId: 1, projectCode: 1 }, { unique: true });
const PrevailingWageDetermination = mongoose.model('PrevailingWageDetermination', prevailingWageDeterminationSchema);

/**
 * FringeBenefitOffset Schema
 * Tracks employer-paid benefits that can be credited against the prevailing wage fringe requirement.
 */
const fringeBenefitOffsetSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

    benefitType: { type: String, enum: ['Health Insurance', '401k Match', 'Pension', 'Other'], required: true },
    monthlyEmployerContribution: { type: Number, required: true, min: 0 },

    // Calculation basis for hourly credit
    expectedMonthlyHours: { type: Number, default: 173.33 }, // Standard 2080 hrs / 12 months
    calculatedHourlyCredit: { type: Number, required: true },

    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date, default: null }
}, { timestamps: true });

const FringeBenefitOffset = mongoose.model('FringeBenefitOffset', fringeBenefitOffsetSchema);

/**
 * CertifiedPayrollReport Schema
 * Stores the generated WH-347 data and compliance status for a specific payroll week.
 */
const certifiedPayrollReportSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    projectCode: { type: String, required: true },

    weekEndingDate: { type: Date, required: true },
    payrollRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollUpdate', default: null },

    // Compliance Summary
    totalEmployees: { type: Number, default: 0 },
    totalHoursWorked: { type: Number, default: 0 },
    totalGrossWages: { type: Number, default: 0 },

    underpaymentsDetected: { type: Number, default: 0 },
    underpaymentAmount: { type: Number, default: 0 },

    // Export Data
    wh347FileContent: { type: String, default: '' },
    status: {
        type: String,
        enum: ['Draft', 'Compliant', 'Non-Compliant', 'Submitted'],
        default: 'Draft'
    }
}, { timestamps: true });

const CertifiedPayrollReport = mongoose.model('CertifiedPayrollReport', certifiedPayrollReportSchema);

module.exports = { PrevailingWageDetermination, FringeBenefitOffset, CertifiedPayrollReport };
