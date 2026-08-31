/**
 * @fileoverview Talent Retention Analytics Routes
 *
 * Mounted at /api/retention-analytics
 *
 *   - /flight-risk              — employee flight risk scores
 *   - /attrition-trends         — monthly attrition data
 *   - /compensation-benchmark   — salary distribution analytics
 *   - /dashboard                — retention dashboard summary
 */

const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requireScope } = require('../middlewares/rbac.middleware');
const {
  getFlightRiskScores,
  getAttritionTrends,
  getCompensationBenchmark,
  getRetentionDashboard,
} = require('../controllers/retentionAnalytics.controller');

const router = express.Router();

router.get('/flight-risk', auth, requireScope('report:read'), getFlightRiskScores);
router.get('/attrition-trends', auth, requireScope('report:read'), getAttritionTrends);
router.get('/compensation-benchmark', auth, requireScope('report:read'), getCompensationBenchmark);
router.get('/dashboard', auth, requireScope('report:read'), getRetentionDashboard);

module.exports = router;
