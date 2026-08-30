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
const auth = require('../middlewares/auth.middleware');

router.post('/import-feed', auth, importFeed);
router.post('/auto-match', auth, runAutoMatch);
router.get('/variance-report', auth, getVarianceReport);

module.exports = router;
