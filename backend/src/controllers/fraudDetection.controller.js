/**
 * Fraud Intelligence & SOC Controller — Enterprise Payroll Security
 *
 * REST Endpoints:
 * GET  /api/fraud-intelligence/metrics           - Real-time SOC anomaly summary metrics
 * GET  /api/fraud-intelligence/incidents         - Query detected fraud incidents with filters
 * POST /api/fraud-intelligence/incidents/:id/mitigate - Apply kill-switch / freeze / whitelist
 * POST /api/fraud-intelligence/benford-analysis  - Evaluate Benford distribution on disbursement data
 * POST /api/fraud-intelligence/scan-batch        - On-demand batch audit scan
 */
"use strict";

const FraudIncident = require("../models/fraudDetection.model");
const {
  calculateBenfordDistribution,
  calculateSalaryZScore,
  detectDuplicateAccounts,
  getFraudMetricsSummary,
  mitigateFraudIncident,
} = require("../services/fraudDetection.service");
const { tenantFilter } = require("../utils/tenantScope");
const logger = require("../utils/logger");

/**
 * Fetch high-level SOC risk metrics & KPI summary.
 */
async function getMetrics(req, res) {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    const summary = await getFraudMetricsSummary(tenantId);
    return res.json(summary);
  } catch (err) {
    logger.error("getMetrics error", { error: err.message });
    return res.status(500).json({ message: "Failed to load fraud intelligence metrics." });
  }
}

/**
 * Fetch list of incidents matching query filters.
 */
async function listIncidents(req, res) {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    const { severity, anomalyType, status, search, minRisk } = req.query;

    const query = { ...tenantFilter({ tenantId }) };

    if (severity && severity !== "ALL") query.severity = severity;
    if (anomalyType && anomalyType !== "ALL") query.anomalyType = anomalyType;
    if (status && status !== "ALL") query.status = status;
    if (minRisk) query.riskScore = { $gte: Number(minRisk) };

    if (search) {
      query.$or = [
        { incidentCode: { $regex: search, $options: "i" } },
        { employeeName: { $regex: search, $options: "i" } },
        { department: { $regex: search, $options: "i" } },
        { "forensicContext.bankAccountNumberMasked": { $regex: search, $options: "i" } },
      ];
    }

    const incidents = await FraudIncident.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.json({ incidents, totalCount: incidents.length });
  } catch (err) {
    logger.error("listIncidents error", { error: err.message });
    return res.status(500).json({ message: "Failed to retrieve fraud incidents." });
  }
}

/**
 * Apply mitigation action (AUTO_FROZEN, DISBURSEMENT_HOLD, ESCALATED_TO_AUDITOR, WHITELISTED).
 */
async function mitigateIncident(req, res) {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    const { id } = req.params;
    const { actionType, notes } = req.body;

    if (!actionType) {
      return res.status(400).json({ message: "actionType is required." });
    }

    const updated = await mitigateFraudIncident({
      incidentId: id,
      tenantId,
      actionType,
      actorId: req.userId || req.user?._id,
      actorName: req.user?.name || req.user?.fullName || "Security Admin",
      notes,
    });

    return res.json({
      message: "Mitigation action executed successfully.",
      incident: updated,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    logger.error("mitigateIncident error", { error: err.message });
    return res.status(500).json({ message: "Failed to apply mitigation." });
  }
}

/**
 * Run Benford distribution analysis on a submitted array of transaction amounts.
 */
async function runBenfordAnalysis(req, res) {
  try {
    const { disbursements } = req.body;
    if (!Array.isArray(disbursements) || disbursements.length === 0) {
      return res.status(400).json({ message: "disbursements must be a non-empty array of numbers." });
    }

    const result = calculateBenfordDistribution(disbursements);
    return res.json(result);
  } catch (err) {
    logger.error("runBenfordAnalysis error", { error: err.message });
    return res.status(500).json({ message: "Benford analysis failed." });
  }
}

module.exports = {
  getMetrics,
  listIncidents,
  mitigateIncident,
  runBenfordAnalysis,
};
