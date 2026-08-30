const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requireScope } = require('../middlewares/rbac.middleware');
const {
  createSurvey,
  getSurveys,
  getSurveyById,
  publishSurvey,
  closeSurvey,
  deleteSurvey,
  getAvailableSurveys,
  submitResponse,
  getSurveyResults,
} = require('../controllers/pulseSurvey.controller');

const router = express.Router();

// ─── Admin: Survey Lifecycle ─────────────────────────────────────────────────

router.post('/', auth, requireScope('employee:write'), createSurvey);
router.get('/', auth, requireScope('employee:read'), getSurveys);
router.get('/:id', auth, requireScope('employee:read'), getSurveyById);
router.patch('/:id/publish', auth, requireScope('employee:write'), publishSurvey);
router.patch('/:id/close', auth, requireScope('employee:write'), closeSurvey);
router.delete('/:id', auth, requireScope('employee:write'), deleteSurvey);

// ─── Employee: Respond ───────────────────────────────────────────────────────

router.get('/available/surveys', auth, requireScope('employee:read'), getAvailableSurveys);
router.post('/:surveyId/respond', auth, requireScope('employee:read'), submitResponse);

// ─── Admin: Results ──────────────────────────────────────────────────────────

router.get('/:id/results', auth, requireScope('report:read'), getSurveyResults);

module.exports = router;
