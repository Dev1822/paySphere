/**
 * @fileoverview Statutory Retrenchment & Severance API Routes
 * Issue: #2064
 */

const express = require('express');
const router = express.Router();
const {
  calculateRetrenchment,
  submitClosureBatch,
  getSeveranceSummary,
} = require('../controllers/severance.controller');
const { protect } = require('../middlewares/auth.middleware');

router.post('/calculate-retrenchment', protect, calculateRetrenchment);
router.post('/submit-closure-batch', protect, submitClosureBatch);
router.get('/summary/:employeeId', protect, getSeveranceSummary);

module.exports = router;