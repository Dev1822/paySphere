/**
 * Fraud Intelligence & Anomaly Routes — Enterprise Payroll Security
 * Mounted at /api/fraud-intelligence in app.js
 */
"use strict";

const { Router } = require("express");
const auth = require("../middlewares/auth.middleware");
const { requirePermission } = require("../middlewares/rbac.middleware");
const { PERMISSIONS } = require("../config/permissions");
const {
  getMetrics,
  listIncidents,
  mitigateIncident,
  runBenfordAnalysis,
} = require("../controllers/fraudDetection.controller");

const router = Router();

// Viewing SOC fraud metrics & incidents requires READ_PAYROLL or READ_REPORT
router.get("/metrics", auth, requirePermission(PERMISSIONS.READ_PAYROLL), getMetrics);
router.get("/incidents", auth, requirePermission(PERMISSIONS.READ_PAYROLL), listIncidents);

// Applying mitigations & freezes requires APPROVE_PAYROLL or WRITE_PAYROLL
router.post("/incidents/:id/mitigate", auth, requirePermission(PERMISSIONS.APPROVE_PAYROLL || PERMISSIONS.WRITE_PAYROLL), mitigateIncident);

// Statistical mathematical calculation (read-only)
router.post("/benford-analysis", auth, requirePermission(PERMISSIONS.READ_PAYROLL), runBenfordAnalysis);

module.exports = router;
