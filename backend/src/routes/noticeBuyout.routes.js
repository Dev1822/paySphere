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
const auth = require('../middlewares/auth.middleware');

router.post('/calculate-recovery', auth, calculateRecovery);
router.post('/submit-waiver', auth, submitWaiver);
router.get('/summary/:employeeId', auth, getNoticeSummary);

module.exports = router;
