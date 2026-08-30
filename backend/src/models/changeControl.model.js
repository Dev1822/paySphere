/**
 * @fileoverview SOX Change Control & Audit Schemas
 * @description Tracks payroll change requests, approval workflows, and immutable audit logs.
 * Issue: #1734
 */
const mongoose = require('mongoose');

/**
 * PayrollChangeRequest Schema
 * Stores the proposed change, the risk score, and the before/after snapshots.
 */
const payrollChangeRequestSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

    changeType: {
        type: String,
        enum: ['Salary', 'Bank Account', 'Title', 'Tax Withholding', 'Bonus'],
        required: true
    },

    fieldName: { type: String, required: true }, // e.g., 'baseSalary', 'accountNumber'
    beforeValue: { type: mongoose.Schema.Types.Mixed, required: true },
    afterValue: { type: mongoose.Schema.Types.Mixed, required: true },

    riskScore: { type: String, enum: ['High', 'Medium', 'Low'], required: true },
    reason: { type: String, required: true },

    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'],
        default: 'Pending',
        index: true
    },

    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

const PayrollChangeRequest = mongoose.model('PayrollChangeRequest', payrollChangeRequestSchema);

/**
 * ApprovalWorkflow Schema
 * Tracks the multi-stage approval chain for a specific request.
 */
const approvalWorkflowSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollChangeRequest', required: true, index: true },

    stage: { type: Number, default: 1 },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    status: {
        type: String,
        enum: ['Pending Review', 'Approved', 'Rejected'],
        default: 'Pending Review'
    },

    comments: { type: String, default: '' },
    actionedAt: { type: Date, default: null },
    actionedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

const ApprovalWorkflow = mongoose.model('ApprovalWorkflow', approvalWorkflowSchema);

/**
 * ControlAuditLog Schema
 * Immutable log of every action taken on a change request for SOX auditors.
 */
const controlAuditLogSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollChangeRequest', required: true, index: true },

    action: {
        type: String,
        enum: ['Created', 'Assigned', 'Approved', 'Rejected', 'Applied to Payroll'],
        required: true
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userRole: { type: String, required: true },

    snapshot: { type: mongoose.Schema.Types.Mixed, default: null }, // Immutable state at the time of action
    ipAddress: { type: String, default: '' }
}, { timestamps: true });

const ControlAuditLog = mongoose.model('ControlAuditLog', controlAuditLogSchema);

module.exports = { PayrollChangeRequest, ApprovalWorkflow, ControlAuditLog };
