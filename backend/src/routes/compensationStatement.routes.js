/**
 * @fileoverview Total Compensation Statement Routes
 *
 * Mounted at /api/compensation-statements
 *
 *   - POST /generate           — generate statement for one employee
 *   - POST /generate-bulk      — generate for all active employees
 *   - GET /                    — list statements (filtered by fiscalYear)
 *   - GET /summary             — aggregate CTC summary for a fiscal year
 *   - GET /:employeeId         — get one employee's statement
 *   - PATCH /:id/share         — mark statement as shared
 */

const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requireScope } = require('../middlewares/rbac.middleware');
const {
  generate,
  generateBulk,
  list,
  getByEmployee,
  getSummary,
  markShared,
} = require('../controllers/compensationStatement.controller');

const router = express.Router();

// Static paths before /:employeeId to avoid param capture
router.get('/summary', auth, requireScope('report:read'), getSummary);
router.post('/generate', auth, requireScope('report:write'), generate);
router.post('/generate-bulk', auth, requireScope('report:write'), generateBulk);
router.get('/', auth, requireScope('report:read'), list);

// Parameterised routes
router.get('/:employeeId', auth, requireScope('report:read'), getByEmployee);
router.patch('/:id/share', auth, requireScope('report:write'), markShared);

module.exports = router;
