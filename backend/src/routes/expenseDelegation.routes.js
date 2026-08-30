/**
 * @fileoverview Expense Approval Delegation API Routes
 * Issue: #1573
 */

const express = require('express');
const router = express.Router();
const {
  createDelegation,
  getActiveDelegations,
  processEscalations,
} = require('../controllers/expenseDelegation.controller');
const auth = require('../middlewares/auth.middleware');

router.post('/delegate', auth, createDelegation);
router.get('/active', auth, getActiveDelegations);
router.post('/process-escalations', auth, processEscalations);

module.exports = router;
