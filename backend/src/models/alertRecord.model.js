/**
 * @fileoverview Alert Record Model
 *
 * Immutable log of anomaly detections produced by a scan. Each record
 * captures the rule that fired, the affected payroll entry, and the
 * context the scan engine saw at evaluation time. Records are append-only;
 * admins can dismiss or acknowledge them but never edit.
 */

const mongoose = require('mongoose');

const DISPOSITION_VALUES = ['OPEN', 'ACKNOWLEDGED', 'DISMISSED', 'FALSE_POSITIVE'];

const alertRecordSchema = new mongoose.Schema(
  {
    /** The rule that produced this alert */
    ruleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AlertRule',
      required: true,
    },

    /** Denormalised rule snapshot so dismissed rules still show their name */
    ruleName: {
      type: String,
      required: true,
    },

    /** The anomaly type carried forward from the rule */
    alertType: {
      type: String,
      required: true,
    },

    severity: {
      type: String,
      required: true,
      enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
    },

    /** Which employee payroll entry triggered the alert */
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },

    employeeName: {
      type: String,
      default: '',
    },

    /** The payroll record that was flagged */
    payrollId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    /** Computed score / deviation at time of detection */
    score: {
      type: Number,
      default: 0,
    },

    /** Human-readable explanation */
    message: {
      type: String,
      required: true,
      maxlength: [500, 'Alert message cannot exceed 500 characters'],
    },

    /** Structured payload with the exact values that triggered the rule */
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    /** Lifecycle state */
    disposition: {
      type: String,
      enum: DISPOSITION_VALUES,
      default: 'OPEN',
    },

    /** Who acknowledged or dismissed the alert */
    dispositionBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    dispositionAt: {
      type: Date,
      default: null,
    },

    /** Optional note when dismissing or acknowledging */
    dispositionNote: {
      type: String,
      default: '',
      maxlength: [300, 'Disposition note cannot exceed 300 characters'],
    },

    /** Which scan run produced this record */
    scanRunId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    /** Year / month of the payroll being scanned */
    year: {
      type: Number,
      required: true,
    },
    month: {
      type: Number,
      required: true,
    },

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

alertRecordSchema.index({ tenantId: 1, disposition: 1, severity: 1 });
alertRecordSchema.index({ tenantId: 1, ruleId: 1, createdAt: -1 });
alertRecordSchema.index({ tenantId: 1, employeeId: 1 });
alertRecordSchema.index({ tenantId: 1, year: 1, month: 1 });
alertRecordSchema.index({ tenantId: 1, createdAt: -1 });

module.exports = mongoose.model('AlertRecord', alertRecordSchema);
module.exports.DISPOSITION_VALUES = DISPOSITION_VALUES;
