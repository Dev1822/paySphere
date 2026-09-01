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
const auth = require('../middlewares/auth.middleware');

router.post('/calculate', auth, calculatePt);
router.post('/configure-slab', auth, configureStateSlab);
router.get('/annual-return/:state', auth, getAnnualReturn);

module.exports = router;
