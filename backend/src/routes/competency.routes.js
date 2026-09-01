const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requireScope } = require('../middlewares/rbac.middleware');
const {
  getMyCompetency,
  getCompetencyByEmployee,
  addSkill,
  updateSkill,
  removeSkill,
  getDepartmentSkillMatrix,
  getSkillGapAnalysis,
} = require('../controllers/competency.controller');

const router = express.Router();

// Self-service: get own competency profile
router.get(
  '/me',
  auth,
  requireScope('employee:read'),
  getMyCompetency,
);

// Get competency profile by employee ID
router.get(
  '/employee/:employeeId',
  auth,
  requireScope('employee:read'),
  getCompetencyByEmployee,
);

// Add a skill to a competency profile
router.post(
  '/employee/:employeeId/skills',
  auth,
  requireScope('employee:write'),
  addSkill,
);

// Update a specific skill entry
router.patch(
  '/employee/:employeeId/skills/:skillId',
  auth,
  requireScope('employee:write'),
  updateSkill,
);

// Remove a specific skill entry
router.delete(
  '/employee/:employeeId/skills/:skillId',
  auth,
  requireScope('employee:write'),
  removeSkill,
);

// Department skill matrix (aggregated view)
router.get(
  '/matrix',
  auth,
  requireScope('report:read'),
  getDepartmentSkillMatrix,
);

// Skill gap analysis for a specific employee
router.get(
  '/gap-analysis/:employeeId',
  auth,
  requireScope('report:read'),
  getSkillGapAnalysis,
);

module.exports = router;
