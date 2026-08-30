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
const auth = require('../middlewares/auth.middleware');

router.post('/calculate-employee', auth, calculateEmployeeBonus);
router.post('/process-annual-batch', auth, processAnnualBatch);
router.get('/report', auth, getBonusReport);

module.exports = router;
