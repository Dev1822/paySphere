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
const auth = require('../middlewares/auth.middleware');

router.post('/claim', auth, claimLta);
router.get('/block-status/:employeeId', auth, getBlockStatus);
router.get('/tax-report/:employeeId', auth, getLtaTaxReport);

module.exports = router;
