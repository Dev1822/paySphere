/**
 * @fileoverview Corporate Card Reconciliation API Routes
 * Issue: #1666
 */

const express = require('express');
const router = express.Router();
const {
  importFeed,
  runAutoMatch,
  getVarianceReport,
} = require('../controllers/cardReconciliation.controller');
const { protect } = require('../middlewares/auth.middleware');

router.post('/import-feed', protect, importFeed);
router.post('/auto-match', protect, runAutoMatch);
router.get('/variance-report', protect, getVarianceReport);

module.exports = router;
