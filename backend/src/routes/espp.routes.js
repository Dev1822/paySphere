/**
 * @fileoverview Employee Stock Purchase Plan (ESPP) API Routes
 * Issue: #1667
 */

const express = require('express');
const router = express.Router();
const {
  enrollEspp,
  executePurchase,
  getEsppSummary,
} = require('../controllers/espp.controller');
const { protect } = require('../middlewares/auth.middleware');

router.post('/enroll', protect, enrollEspp);
router.post('/execute-purchase', protect, executePurchase);
router.get('/summary/:employeeId', protect, getEsppSummary);

module.exports = router;