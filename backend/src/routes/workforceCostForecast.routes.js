/**
 * @fileoverview Workforce Cost Forecasting Routes
 *
 * Mounted at /api/workforce-cost-forecast
 *
 *   - POST /            — full cost projection with assumptions
 *   - POST /compare     — scenario comparison
 *   - GET /summary      — current cost summary
 */

const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requireScope } = require('../middlewares/rbac.middleware');
const {
  getForecast,
  compareScenarios,
  getCostSummary,
} = require('../controllers/workforceCostForecast.controller');

const router = express.Router();

router.post('/', auth, requireScope('report:read'), getForecast);
router.post('/compare', auth, requireScope('report:read'), compareScenarios);
router.get('/summary', auth, requireScope('report:read'), getCostSummary);

module.exports = router;
