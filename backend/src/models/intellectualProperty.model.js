/**
 * @fileoverview Intellectual Property & Bonus Schemas
 * @description Tracks invention disclosures, patent milestones, and bonus payouts.
 * Issue: #1622
 */
const mongoose = require('mongoose');

/**
 * InventionDisclosure Schema
 * Tracks the initial submission of an invention by employees.
 */
const inventionDisclosureSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, required: true },

    // Co-inventors and their contribution splits (must sum to 100)
    inventors: [{
        employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
        splitPercentage: { type: Number, required: true, min: 0, max: 100 }
    }],

    status: {
        type: String,
        enum: ['Submitted', 'Under Review', 'Approved for Filing', 'Rejected'],
        default: 'Submitted',
        index: true
    },

    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

const InventionDisclosure = mongoose.model('InventionDisclosure', inventionDisclosureSchema);

/**
 * PatentMilestone Schema
 * Tracks the legal lifecycle of an approved invention.
 */
const patentMilestoneSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    disclosureId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventionDisclosure', required: true },

    stage: {
        type: String,
        enum: ['Provisional Filed', 'Non-Provisional Filed', 'Patent Granted', 'Foreign Filed'],
        required: true
    },
    achievedDate: { type: Date, required: true },
    patentNumber: { type: String, default: '' },

    bonusAmountTotal: { type: Number, required: true }, // Total bonus pool for this milestone
    isPaidOut: { type: Boolean, default: false }
}, { timestamps: true });

const PatentMilestone = mongoose.model('PatentMilestone', patentMilestoneSchema);

/**
 * IPBonusPayout Schema
 * Tracks individual payouts injected into payroll.
 */
const ipBonusPayoutSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    milestoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'PatentMilestone', required: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

    amount: { type: Number, required: true },
    status: {
        type: String,
        enum: ['Pending Payroll', 'Injected', 'Paid'],
        default: 'Pending Payroll'
    },
    payrollRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollUpdate', default: null }
}, { timestamps: true });

const IPBonusPayout = mongoose.model('IPBonusPayout', ipBonusPayoutSchema);

module.exports = { InventionDisclosure, PatentMilestone, IPBonusPayout };
