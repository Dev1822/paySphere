/**
 * @fileoverview House Rent Allowance (HRA) API Routes
 * Issue: #1763
 */

const express = require('express');
const router = express.Router();
const {
  calculateHra,
  submitReceipts,
  getHraSummary,
} = require('../controllers/hraExemption.controller');
const auth = require('../middlewares/auth.middleware');

router.post('/calculate', auth, calculateHra);
router.post('/submit-receipts', auth, submitReceipts);
router.get('/summary/:employeeId', auth, getHraSummary);

module.exports = router;
