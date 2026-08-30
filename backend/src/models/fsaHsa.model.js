/**
 * @fileoverview FSA & HSA Pre-Tax Schemas
 * @description Tracks employee elections, YTD contribution accumulators, 
 * and plan-year transition rules (carryover vs grace period).
 * Issue: #1758
 */
const mongoose = require('mongoose');

/**
 * PlanYearConfiguration Schema
 * Defines the employer's specific FSA/HSA plan rules for a given year.
 */
const planYearConfigurationSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    planYear: { type: Number, required: true }, // e.g., 2026

    // FSA Rules
    fsaAnnualLimit: { type: Number, default: 3200 }, // IRS 2026 limit
    fsaTransitionRule: { type: String, enum: ['Forfeit', 'GracePeriod', 'Carryover'], default: 'Forfeit' },
    fsaCarryoverLimit: { type: Number, default: 640 }, // Max carryover if rule is Carryover
    fsaGracePeriodDays: { type: Number, default: 75 }, // Days into new year to incur claims

    // HSA Rules
    hsaAnnualLimitSelf: { type: Number, default: 4150 },
    hsaAnnualLimitFamily: { type: Number, default: 8300 },
    hsaCatchUpLimit: { type: Number, default: 1000 }, // For employees 55+

    isActive: { type: Boolean, default: true }
}, { timestamps: true });

planYearConfigurationSchema.index({ tenantId: 1, planYear: 1 }, { unique: true });
const PlanYearConfiguration = mongoose.model('PlanYearConfiguration', planYearConfigurationSchema);

/**
 * FSAHSAElection Schema
 * Tracks an employee's elected contribution for a specific plan year.
 */
const fsaHsaElectionSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    planYear: { type: Number, required: true },

    accountType: { type: String, enum: ['FSA', 'HSA'], required: true },
    electedAnnualAmount: { type: Number, required: true, min: 0 },
    coverageType: { type: String, enum: ['Self', 'Family'], default: 'Self' }, // HSA specific

    // Catch-up flag (HSA only, age 55+)
    isCatchUp: { type: Boolean, default: false },
    catchUpAmount: { type: Number, default: 0 },

    status: { type: String, enum: ['Active', 'Exhausted', 'Cancelled'], default: 'Active' }
}, { timestamps: true });

fsaHsaElectionSchema.index({ tenantId: 1, employeeId: 1, planYear: 1, accountType: 1 }, { unique: true });
const FSAHSAElection = mongoose.model('FSAHSAElection', fsaHsaElectionSchema);

/**
 * ContributionLedger Schema
 * Immutable log of every per-paycheck deduction and employer seed/contribution.
 */
const contributionLedgerSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    electionId: { type: mongoose.Schema.Types.ObjectId, ref: 'FSAHSAElection', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },

    payrollRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollUpdate', default: null },
    periodMonth: { type: Number, required: true },
    periodYear: { type: Number, required: true },

    employeeDeduction: { type: Number, required: true },
    employerContribution: { type: Number, default: 0 },
    totalContribution: { type: Number, required: true },

    ytdAccumulator: { type: Number, required: true } // Running total for the plan year
}, { timestamps: true });

const ContributionLedger = mongoose.model('ContributionLedger', contributionLedgerSchema);

module.exports = { PlanYearConfiguration, FSAHSAElection, ContributionLedger };
