/**
 * @fileoverview Total Compensation Statement Model
 *
 * Stores generated total-compensation statements per employee per year.
 * Each statement captures a point-in-time snapshot of the full CTC breakdown:
 *   - Base salary and fixed allowances
 *   - Variable pay (bonuses, incentives, overtime)
 *   - Statutory contributions (PF, ESI, gratuity, PT)
 *   - Benefits and perquisites
 *   - Net take-home estimate
 *
 * Statements are immutable once generated; re-generation creates a new record.
 */

const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');

const STATEMENT_STATUS = ['DRAFT', 'GENERATED', 'SHARED', 'ARCHIVED'];

const compensationStatementSchema = new mongoose.Schema(
  {
    /** The employee this statement belongs to */
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },

    employeeName: {
      type: String,
      required: true,
      maxlength: [100, 'Employee name cannot exceed 100 characters'],
    },

    department: {
      type: String,
      default: '',
    },

    role: {
      type: String,
      default: '',
    },

    jobLevel: {
      type: String,
      default: '',
    },

    /** Fiscal year this statement covers */
    fiscalYear: {
      type: Number,
      required: true,
      min: [2000, 'Fiscal year must be 2000 or later'],
      max: [2100, 'Fiscal year must be 2100 or earlier'],
    },

    currency: {
      type: String,
      default: 'INR',
    },

    // ─── Fixed Compensation ──────────────────────────────────────────
    annualBasic: { type: Number, required: true, min: 0 },
    annualHRA: { type: Number, default: 0, min: 0 },
    annualSpecialAllowance: { type: Number, default: 0, min: 0 },
    annualTransportAllowance: { type: Number, default: 0, min: 0 },
    annualMedicalAllowance: { type: Number, default: 0, min: 0 },
    annualOtherFixed: { type: Number, default: 0, min: 0 },

    /** Total fixed compensation (sum of all fixed components) */
    totalFixed: { type: Number, default: 0, min: 0 },

    // ─── Variable Compensation ───────────────────────────────────────
    annualBonus: { type: Number, default: 0, min: 0 },
    annualPerformancePay: { type: Number, default: 0, min: 0 },
    annualOvertimePay: { type: Number, default: 0, min: 0 },
    annualIncentives: { type: Number, default: 0, min: 0 },
    annualOtherVariable: { type: Number, default: 0, min: 0 },

    /** Total variable compensation */
    totalVariable: { type: Number, default: 0, min: 0 },

    // ─── Total Cost to Company ───────────────────────────────────────
    totalCTC: { type: Number, required: true, min: 0 },

    // ─── Employer Statutory Contributions ────────────────────────────
    employerPF: { type: Number, default: 0, min: 0 },
    employerESI: { type: Number, default: 0, min: 0 },
    employerGratuity: { type: Number, default: 0, min: 0 },
    employerInsurance: { type: Number, default: 0, min: 0 },

    /** Total employer contributions */
    totalEmployerContributions: { type: Number, default: 0, min: 0 },

    // ─── Employee Statutory Deductions (estimated) ───────────────────
    employeePF: { type: Number, default: 0, min: 0 },
    employeeESI: { type: Number, default: 0, min: 0 },
    professionalTax: { type: Number, default: 0, min: 0 },
    incomeTax: { type: Number, default: 0, min: 0 },

    /** Total employee deductions */
    totalEmployeeDeductions: { type: Number, default: 0, min: 0 },

    // ─── Benefits & Perquisites (annual value) ───────────────────────
    annualInsuranceValue: { type: Number, default: 0, min: 0 },
    annualLeaveEncashment: { type: Number, default: 0, min: 0 },
    annualFoodCoupon: { type: Number, default: 0, min: 0 },
    annualNPS: { type: Number, default: 0, min: 0 },
    annualOtherBenefits: { type: Number, default: 0, min: 0 },

    /** Total benefits value */
    totalBenefits: { type: Number, default: 0, min: 0 },

    // ─── Net Take-Home ───────────────────────────────────────────────
    /** Estimated annual take-home after all deductions */
    estimatedAnnualTakeHome: { type: Number, default: 0, min: 0 },

    /** Estimated monthly take-home */
    estimatedMonthlyTakeHome: { type: Number, default: 0, min: 0 },

    // ─── Snapshot Metadata ───────────────────────────────────────────
    status: {
      type: String,
      enum: STATEMENT_STATUS,
      default: 'DRAFT',
    },

    /** When the snapshot was generated */
    generatedAt: {
      type: Date,
      default: null,
    },

    /** When the statement was shared with the employee */
    sharedAt: {
      type: Date,
      default: null,
    },

    /** Monthly breakdown for the year */
    monthlyBreakdown: [
      {
        month: { type: Number, min: 1, max: 12 },
        basic: { type: Number, default: 0 },
        hra: { type: Number, default: 0 },
        otherAllowances: { type: Number, default: 0 },
        grossEarnings: { type: Number, default: 0 },
        deductions: { type: Number, default: 0 },
        netPay: { type: Number, default: 0 },
      },
    ],

    /** Raw payroll data snapshot used for calculation */
    sourcePayrollIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PayrollUpdate',
      },
    ],

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

compensationStatementSchema.index(
  { tenantId: 1, employeeId: 1, fiscalYear: 1 },
  { unique: true },
);

compensationStatementSchema.index({ tenantId: 1, fiscalYear: 1, department: 1 });
compensationStatementSchema.index({ tenantId: 1, status: 1 });

compensationStatementSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('CompensationStatement', compensationStatementSchema);
module.exports.STATEMENT_STATUS = STATEMENT_STATUS;
