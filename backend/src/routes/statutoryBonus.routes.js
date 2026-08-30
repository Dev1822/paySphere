/**
 * @fileoverview Statutory Bonus API Routes
 * Issue: #1764
 */

const express = require('express');
const router = express.Router();
const {
  calculateEmployeeBonus,
  processAnnualBatch,
  getBonusReport,
} = require('../controllers/statutoryBonus.controller');
const { protect } = require('../middlewares/auth.middleware');

router.post('/calculate-employee', protect, calculateEmployeeBonus);
router.post('/process-annual-batch', protect, processAnnualBatch);
router.get('/report', protect, getBonusReport);

module.exports = router;
