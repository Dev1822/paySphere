/**
 * @fileoverview Pulse Survey Analytics Routes
 *
 * Mounted at /api/pulse-surveys/analytics
 *
 * Provides aggregated analytics for pulse survey data:
 *   - /overview           — aggregate metrics across all surveys
 *   - /departments        — department-level breakdown
 *   - /questions/:id      — per-question analytics for a survey
 *   - /heatmap            — response timing patterns
 *   - /sentiment-trend    — satisfaction trend over time
 *   - /comparison         — side-by-side survey comparison
 *   - /scorecard          — engagement scorecard
 */

const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requireScope } = require('../middlewares/rbac.middleware');
const {
  getOverview,
  getDepartmentBreakdown,
  getQuestionAnalytics,
  getResponseHeatmap,
  getSentimentTrend,
  getSurveyComparison,
  getEngagementScorecard,
} = require('../controllers/surveyAnalytics.controller');

const router = express.Router();

// ─── Analytics Endpoints ──────────────────────────────────────────────────

router.get('/overview', auth, requireScope('report:read'), getOverview);
router.get('/departments', auth, requireScope('report:read'), getDepartmentBreakdown);
router.get('/questions/:surveyId', auth, requireScope('report:read'), getQuestionAnalytics);
router.get('/heatmap', auth, requireScope('report:read'), getResponseHeatmap);
router.get('/sentiment-trend', auth, requireScope('report:read'), getSentimentTrend);
router.get('/comparison', auth, requireScope('report:read'), getSurveyComparison);
router.get('/scorecard', auth, requireScope('report:read'), getEngagementScorecard);

module.exports = router;
