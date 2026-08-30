/**
 * @fileoverview WOTC Tax Credit Schemas
 * Issue: #1935
 */
const mongoose = require('mongoose');

const wotcTargetGroupSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    groupCode: { type: String, required: true, uppercase: true },
    description: { type: String, required: true },
    maxQualifiedWages: { type: Number, required: true },
    creditPercentage: { type: Number, default: 0.25 },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });
wotcTargetGroupSchema.index({ tenantId: 1, groupCode: 1 }, { unique: true });
const WOTCTargetGroup = mongoose.model('WOTCTargetGroup', wotcTargetGroupSchema);

const wotcCertificationTrackerSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    targetGroupId: { type: mongoose.Schema.Types.ObjectId, ref: 'WOTCTargetGroup', required: true },
    hireDate: { type: Date, required: true },
    form8850Submitted: { type: Boolean, default: false },
    submissionDate: { type: Date, default: null },
    isSLABreached: { type: Boolean, default: false }
}, { timestamps: true });
const WOTCCertificationTracker = mongoose.model('WOTCCertificationTracker', wotcCertificationTrackerSchema);

const qualifiedWageLedgerSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    certificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'WOTCCertificationTracker', required: true },
    payrollRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollUpdate', required: true },
    grossWages: { type: Number, required: true },
    allocatedWages: { type: Number, required: true },
    ytdAllocatedWages: { type: Number, required: true },
    capReached: { type: Boolean, default: false }
}, { timestamps: true });
const QualifiedWageLedger = mongoose.model('QualifiedWageLedger', qualifiedWageLedgerSchema);

module.exports = { WOTCTargetGroup, WOTCCertificationTracker, QualifiedWageLedger };
