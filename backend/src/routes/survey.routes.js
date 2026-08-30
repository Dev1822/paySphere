/**
 * @fileoverview Survey & Pulse Check Routes
 * @description API routes for employee surveys, pulse checks, and engagement analytics.
 */
const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
  createSurvey, getSurveys, getSurvey, publishSurvey, closeSurvey,
  submitSurveyResponse, getSurveyAnalytics,
  createPulseCheck, getPulseChecks, respondToPulse, getPulseAnalytics,
  getDashboard,
} = require('../controllers/survey.controller');

const router = express.Router();
router.use(auth);

// Dashboard
router.get('/dashboard', requirePermission('READ_EMPLOYEE'), getDashboard);

// Surveys
router.post('/', requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, createSurvey);
router.get('/', requirePermission('READ_EMPLOYEE'), getSurveys);
router.get('/:surveyId', requirePermission('READ_EMPLOYEE'), getSurvey);
router.post('/:surveyId/publish', requirePermission('WRITE_EMPLOYEE'), publishSurvey);
router.post('/:surveyId/close', requirePermission('WRITE_EMPLOYEE'), closeSurvey);
router.post('/:surveyId/respond', requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, submitSurveyResponse);
router.get('/:surveyId/analytics', requirePermission('READ_EMPLOYEE'), getSurveyAnalytics);

// Pulse Checks
router.post('/pulse', requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, createPulseCheck);
router.get('/pulse/all', requirePermission('READ_EMPLOYEE'), getPulseChecks);
router.post('/pulse/:pulseCheckId/respond', requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, respondToPulse);
router.get('/pulse/:pulseCheckId/analytics', requirePermission('READ_EMPLOYEE'), getPulseAnalytics);

module.exports = router;
