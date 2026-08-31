/**
 * @fileoverview Statutory Overpayment Recovery API Routes
 * Issue: #2067
 */

const express = require('express');
const router = express.Router();
const {
  createSchedule,
  deductCycle,
  getRecoveryLedger,
} = require('../controllers/overpaymentRecovery.controller');
const { protect } = require('../middlewares/auth.middleware');

router.post('/create-schedule', protect, createSchedule);
router.post('/deduct-cycle', protect, deductCycle);
router.get('/ledger/:employeeId', protect, getRecoveryLedger);

module.exports = router;
