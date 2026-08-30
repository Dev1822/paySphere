const express = require('express');
const skillInventoryController = require('../controllers/skillInventory.controller');
const { protect, restrictTo } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(protect);

// Taxonomy routes
router
  .route('/taxonomy')
  .get(skillInventoryController.getTaxonomy)
  .post(
    restrictTo('admin', 'hr', 'manager'),
    skillInventoryController.createTaxonomy,
  );

// Employee skill routes
router.post('/employee/:employeeId', skillInventoryController.addEmployeeSkill);

router.get(
  '/employee/:employeeId/gap-analysis',
  skillInventoryController.getSkillGapAnalysis,
);

// Manager routes
router.patch(
  '/endorse/:skillId',
  restrictTo('admin', 'hr', 'manager'),
  skillInventoryController.endorseSkill,
);

router.get(
  '/team-matrix',
  restrictTo('admin', 'hr', 'manager'),
  skillInventoryController.getTeamMatrix,
);

module.exports = router;
