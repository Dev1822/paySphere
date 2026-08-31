/**
 * @fileoverview Leave Pool API Routes
 * Issue: #1575
 */

const express = require('express');
const router = express.Router();
const {
  donateLeave,
  applyRelief,
  grantRelief,
  getPoolMetrics,
} = require('../controllers/leavePool.controller');
const auth = require('../middlewares/auth.middleware');

router.post('/donate', auth, donateLeave);
router.post('/apply-relief', auth, applyRelief);
router.post('/grant-relief', auth, grantRelief);
router.get('/pool-metrics', auth, getPoolMetrics);

module.exports = router;
