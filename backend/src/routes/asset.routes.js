const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
  createCategory,
  createAsset,
  getAssets,
  assignAsset,
  returnAsset,
  runMonthlyDepreciation,
  getDepreciationSchedule,
  disposeAsset,
} = require('../controllers/asset.controller');

const router = express.Router();

// Categories
router.post('/categories', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, createCategory);

// Assets CRUD
router.post('/', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, createAsset);
router.get('/', auth, requirePermission('READ_EMPLOYEE'), getAssets);

// Workflows & Schedules
router.get('/:id/schedule', auth, requirePermission('READ_EMPLOYEE'), getDepreciationSchedule);
router.post('/:id/assign', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, assignAsset);
router.post('/:id/return', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, returnAsset);
router.post('/:id/dispose', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, disposeAsset);

// System / Cron
router.post('/depreciate', auth, requirePermission('WRITE_EMPLOYEE'), runMonthlyDepreciation);

module.exports = router;
