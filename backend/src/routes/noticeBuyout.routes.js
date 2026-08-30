/**
 * @fileoverview Employee Notice Period Buyout API Routes
 * Issue: #1959
 */

const express = require('express');
const router = express.Router();
const {
  calculateRecovery,
  submitWaiver,
  getNoticeSummary,
} = require('../controllers/noticeBuyout.controller');
const { protect } = require('../middlewares/auth.middleware');

router.post('/calculate-recovery', protect, calculateRecovery);
router.post('/submit-waiver', protect, submitWaiver);
router.get('/summary/:employeeId', protect, getNoticeSummary);

module.exports = router;
