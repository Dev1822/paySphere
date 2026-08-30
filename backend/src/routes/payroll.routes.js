const express = require('express');
const {
  submitPayrollForReview,
  getPayrollSummary,
} = require('../controllers/payroll.controller');

const {
  listCalculationRules,
  createCalculationRule,
  activateCalculationRule,
} = require('../controllers/payrollCalculationRule.controller');const auth = require('../middlewares/auth.middleware');
const { requireScope } = require('../middlewares/rbac.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');
const idempotencyMiddleware = require('../middlewares/idempotency.middleware');
const { payrollFinalizeSchema } = require('../validations/schemas');
const router = express.Router();

router.post(
  '/finalize',
  auth,
  requireScope('payroll:write'),
  validateRequest(payrollFinalizeSchema),
  idempotencyMiddleware,
  submitPayrollForReview,
);
router.get('/summary', auth, requireScope('payroll:read'), getPayrollSummary);
router.post('/payroll/:payrollId/generate-payslips', authMiddleware, rbacMiddleware, payrollController.generatePayslips);
router.get(
  '/calculation-rules',
  auth,
  requireScope('payroll:read'),
  listCalculationRules,
);

router.post(
  '/calculation-rules',
  auth,
  requireScope('payroll:write'),
  createCalculationRule,
);

router.post(
  '/calculation-rules/:version/activate',
  auth,
  requireScope('payroll:write'),
  activateCalculationRule,
);
router.get('/payslip/:jobHash/status', authMiddleware, payrollController.getPayslipStatus);
module.exports = router;
