/**
 * @fileoverview Workplace Safety & OSHA Schemas
 * @description Tracks workplace incidents, OSHA severity classifications, and DART ledgers.
 * Issue: #1625
 */
const mongoose = require('mongoose');

/**
 * WorkplaceIncident Schema
 * Records details of workplace injuries and illnesses.
 */
const workplaceIncidentSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

    incidentDate: { type: Date, required: true },
    description: { type: String, required: true },
    location: { type: String, default: '' },

    // OSHA Classification
    isWorkRelated: { type: Boolean, default: true },
    severity: {
        type: String,
        enum: ['Fatality', 'Amputation/Loss of Eye', 'In-Patient Hospitalization', 'Medical Treatment', 'First Aid Only', 'Near Miss'],
        required: true
    },

    // Recordability & DART (Days Away, Restricted, or Transferred)
    isRecordable: { type: Boolean, default: false },
    isDART: { type: Boolean, default: false },
    daysAway: { type: Number, default: 0 },
    daysRestricted: { type: Number, default: 0 },
    daysTransferred: { type: Number, default: 0 },

    // Reporting Compliance
    requiresImmediateReporting: { type: Boolean, default: false },
    reportedToOSHA: { type: Boolean, default: false },
    reportedAt: { type: Date, default: null },

    status: {
        type: String,
        enum: ['Open', 'Under Investigation', 'Closed', 'Returned to Work'],
        default: 'Open',
        index: true
    }
}, { timestamps: true });

const WorkplaceIncident = mongoose.model('WorkplaceIncident', workplaceIncidentSchema);

/**
 * DARTLedger Schema
 * Aggregates DART metrics for annual OSHA 300A reporting.
 */
const dartLedgerSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    year: { type: Number, required: true },

    totalRecordableCases: { type: Number, default: 0 },
    totalDARTCases: { type: Number, default: 0 },
    totalDaysAway: { type: Number, default: 0 },
    totalDaysRestricted: { type: Number, default: 0 },

    totalHoursWorked: { type: Number, default: 0 }, // Total hours worked by all employees in the year
    dartRate: { type: Number, default: 0 } // (DART Cases / Total Hours) * 200,000
}, { timestamps: true });

dartLedgerSchema.index({ tenantId: 1, year: 1 }, { unique: true });
const DARTLedger = mongoose.model('DARTLedger', dartLedgerSchema);

module.exports = { WorkplaceIncident, DARTLedger };
