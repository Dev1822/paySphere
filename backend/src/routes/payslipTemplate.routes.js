const express = require('express');
const router = express.Router();
const payslipTemplateController = require('../controllers/payslipTemplate.controller');
const auth = require('../middlewares/auth.middleware');
const { requireScope } = require('../middlewares/rbac.middleware');

router.use(auth);

router.get(
  '/',
  requireScope('settings:read'),
  payslipTemplateController.getTemplate,
);
router.post(
  '/preview',
  requireScope('settings:read'),
  payslipTemplateController.previewTemplate,
);
router.put(
  '/',
  requireScope('settings:write'),
  payslipTemplateController.updateTemplate,
);

module.exports = router;
