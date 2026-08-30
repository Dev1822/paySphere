const express = require('express');
const router = express.Router();
const headcountPlanningController = require('../controllers/headcountPlanning.controller');
const { requireAuth, requireRoles } = require('../middlewares/auth.middleware');

router.use(requireAuth);

router.post(
  '/requisitions',
  requireRoles(['Admin', 'HR_Manager', 'Department_Head']),
  headcountPlanningController.createRequisition,
);

router.patch(
  '/requisitions/:id/approve',
  requireRoles(['Admin', 'HR_Manager', 'Finance_Manager']),
  headcountPlanningController.approveRequisition,
);

router.get(
  '/analytics',
  requireRoles(['Admin', 'HR_Manager', 'Finance_Manager', 'Department_Head']),
  headcountPlanningController.getAnalytics,
);

module.exports = router;
