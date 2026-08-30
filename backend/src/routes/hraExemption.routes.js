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
const { protect } = require('../middlewares/auth.middleware');

router.post('/calculate', protect, calculateHra);
router.post('/submit-receipts', protect, submitReceipts);
router.get('/summary/:employeeId', protect, getHraSummary);

module.exports = router;
