const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
    assignCard, importTransactions, uploadReceipt,
    runReconciliationBatch, injectClawbacksToPayroll, getMyTransactions
} = require('../controllers/corporateCard.controller');

const router = express.Router();

router.post('/assign', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, assignCard);
router.post('/import', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, importTransactions);

router.post('/receipt', auth, writeRateLimiter, uploadReceipt);
router.get('/my-transactions', auth, getMyTransactions);

router.post('/batch', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, runReconciliationBatch);
router.post('/batch/:batchId/inject', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, injectClawbacksToPayroll);

module.exports = router;
