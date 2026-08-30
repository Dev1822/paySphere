/**
 * @fileoverview Leave Travel Concession (LTA) API Routes
 * Issue: #1766
 */

const express = require('express');
const router = express.Router();
const {
  claimLta,
  getBlockStatus,
  getLtaTaxReport,
} = require('../controllers/ltaExemption.controller');
const { protect } = require('../middlewares/auth.middleware');

router.post('/claim', protect, claimLta);
router.get('/block-status/:employeeId', protect, getBlockStatus);
router.get('/tax-report/:employeeId', protect, getLtaTaxReport);

module.exports = router;
