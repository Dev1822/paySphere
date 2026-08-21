/**
 * Fraud Incident & Anomaly Model — Enterprise Payroll SOC & Anomaly Hub
 *
 * Implements persistent tracking of real-time payroll anomalies, identity clustering,
 * Benford law deviations, out-of-band salary adjustments, and duplicate disbursement vectors.
 */
"use strict";

const mongoose = require("mongoose");

const ANOMALY_TYPES = [
  "GHOST_EMPLOYEE",
  "DUPLICATE_DIRECT_DEPOSIT",
  "BENFORD_LAW_VIOLATION",
  "SALARY_SPIKE_OUTLIER",
  "OFF_CYCLE_OVERTIME_INFLATION",
  "GEOGRAPHIC_IMPOSSIBLE_TRAVEL",
  "TAX_ID_COLLISION",
  "UNAUTHORIZED_OFF_HOURS_MUTATION",
];

const SEVERITY_LEVELS = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFORMATIONAL"];
const INCIDENT_STATUSES = ["ACTIVE", "INVESTIGATING", "MITIGATED", "FALSE_POSITIVE", "RESOLVED"];

const fraudIncidentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    incidentCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    anomalyType: {
      type: String,
      enum: ANOMALY_TYPES,
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: SEVERITY_LEVELS,
      default: "MEDIUM",
      index: true,
    },
    status: {
      type: String,
      enum: INCIDENT_STATUSES,
      default: "ACTIVE",
      index: true,
    },
    riskScore: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      index: true,
    },
    employeeName: {
      type: String,
      trim: true,
    },
    department: {
      type: String,
      trim: true,
    },
    payrollRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PayrollUpdate",
    },
    amountInvolved: {
      type: Number,
      default: 0,
    },
    detectedDeviation: {
      zScore: { type: Number, default: 0 },
      expectedValue: { type: Number, default: 0 },
      actualValue: { type: Number, default: 0 },
      benfordScore: { type: Number, default: 0 },
      matchingAccountsCount: { type: Number, default: 0 },
    },
    forensicContext: {
      sourceIp: { type: String, trim: true },
      userAgent: { type: String, trim: true },
      bankAccountNumberMasked: { type: String, trim: true },
      routingNumber: { type: String, trim: true },
      taxIdMasked: { type: String, trim: true },
      geoLocation: { type: String, trim: true },
      deviceFingerprint: { type: String, trim: true },
      actionTaken: { type: String, trim: true },
    },
    mitigationAction: {
      actionType: {
        type: String,
        enum: ["NONE", "AUTO_FROZEN", "DISBURSEMENT_HOLD", "ESCALATED_TO_AUDITOR", "WHITELISTED"],
        default: "NONE",
      },
      actionTakenBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      actionTimestamp: { type: Date },
      reasonNotes: { type: String, trim: true },
    },
    auditTrail: [
      {
        timestamp: { type: Date, default: Date.now },
        actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        actorName: { type: String, trim: true },
        action: { type: String, required: true },
        notes: { type: String, trim: true },
      },
    ],
  },
  {
    timestamps: true,
  }
);

fraudIncidentSchema.index({ tenantId: 1, severity: 1, status: 1 });
fraudIncidentSchema.index({ tenantId: 1, createdAt: -1 });

module.exports = mongoose.model("FraudIncident", fraudIncidentSchema);
