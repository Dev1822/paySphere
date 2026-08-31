const express = require('express');
const { triggerForecast, getForecastResults } = require('../controllers/forecast.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

router.post(
  '/',
  auth,
  requirePermission(PERMISSIONS.WRITE_PAYROLL),
  writeRateLimiter,
  triggerForecast
);

router.get(
  '/results/:forecastId',
  auth,
  requirePermission(PERMISSIONS.READ_PAYROLL),
  getForecastResults
);

module.exports = router;
