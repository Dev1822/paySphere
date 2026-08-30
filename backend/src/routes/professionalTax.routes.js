/**
 * @fileoverview Multi-State Professional Tax API Routes
 * Issue: #1958
 */

const express = require('express');
const router = express.Router();
const {
  calculatePt,
  configureStateSlab,
  getAnnualReturn,
} = require('../controllers/professionalTax.controller');
const { protect } = require('../middlewares/auth.middleware');

router.post('/calculate', protect, calculatePt);
router.post('/configure-slab', protect, configureStateSlab);
router.get('/annual-return/:state', protect, getAnnualReturn);

module.exports = router;
