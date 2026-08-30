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
const auth = require('../middlewares/auth.middleware');

router.post('/enroll', auth, enrollEspp);
router.post('/execute-purchase', auth, executePurchase);
router.get('/summary/:employeeId', auth, getEsppSummary);

module.exports = router;