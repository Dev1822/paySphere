/**
 * @fileoverview Charitable Giving Schemas
 * @description Tracks giving campaigns, employee pledges, charity organizations, 
 * and corporate match ledgers for payroll deduction integration.
 * Issue: #2011
 */
const mongoose = require('mongoose');

/**
 * CharityOrganization Schema
 * Stores validated 501(c)(3) organizations that employees can donate to.
 */
const charityOrganizationSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    ein: { type: String, required: true, unique: true }, // Employer Identification Number
    legalName: { type: String, required: true },
    displayName: { type: String, required: true },
    category: { type: String, required: true },
    isValidated: { type: Boolean, default: true },
    address: { type: String, default: '' }
}, { timestamps: true });

const CharityOrganization = mongoose.model('CharityOrganization', charityOrganizationSchema);

/**
 * GivingCampaign Schema
 * Represents an annual or specific charitable giving window with corporate matching rules.
 */
const givingCampaignSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true }, // e.g., "2026 Annual United Way Campaign"
    description: { type: String, default: '' },

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    matchingRule: { type: String, required: true }, // e.g., 'Dollar for Dollar (1:1)'
    matchCapPerEmployee: { type: Number, default: 1000 }, // Max corporate match per employee per year
    totalCorporateBudget: { type: Number, default: 100000 }, // Total company budget for matching

    totalRaised: { type: Number, default: 0 },
    totalMatched: { type: Number, default: 0 },
    participantCount: { type: Number, default: 0 },

    status: { type: String, enum: ['Draft', 'Active', 'Closed', 'Archived'], default: 'Draft' }
}, { timestamps: true });

const GivingCampaign = mongoose.model('GivingCampaign', givingCampaignSchema);

/**
 * EmployeePledge Schema
 * Tracks an employee's recurring or one-time payroll deduction pledge.
 */
const employeePledgeSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'GivingCampaign', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    charityId: { type: mongoose.Schema.Types.ObjectId, ref: 'CharityOrganization', required: true },

    pledgeAmount: { type: Number, required: true, min: 1 }, // Amount per frequency or total for one-time
    frequency: { type: String, required: true }, // e.g., 'Per Paycheck', 'Monthly'
    totalPledgedAnnual: { type: Number, required: true }, // Total expected annual deduction

    ytdDeducted: { type: Number, default: 0 },
    ytdMatched: { type: Number, default: 0 },

    status: { type: String, enum: ['Active', 'Completed', 'Cancelled', 'Capped (Limit Reached)'], default: 'Active' },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null }
}, { timestamps: true });

employeePledgeSchema.index({ tenantId: 1, campaignId: 1, employeeId: 1, charityId: 1 }, { unique: true });
const EmployeePledge = mongoose.model('EmployeePledge', employeePledgeSchema);

/**
 * CorporateMatchLedger Schema
 * Immutable log of corporate matching liabilities generated per payroll run.
 */
const corporateMatchLedgerSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'GivingCampaign', required: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    pledgeId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmployeePledge', required: true },
    payrollRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollUpdate', default: null },

    employeeDonation: { type: Number, required: true },
    corporateMatch: { type: Number, required: true },
    hitMatchCap: { type: Boolean, default: false },

    periodMonth: { type: Number, required: true },
    periodYear: { type: Number, required: true }
}, { timestamps: true });

const CorporateMatchLedger = mongoose.model('CorporateMatchLedger', corporateMatchLedgerSchema);

module.exports = { CharityOrganization, GivingCampaign, EmployeePledge, CorporateMatchLedger };
