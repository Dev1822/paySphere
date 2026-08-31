/**
 * @fileoverview Alert Rule Routes
 *
 * Mounted at /api/alert-rules
 *
 *   - POST /                        — create a rule
 *   - GET /                         — list rules
 *   - GET /stats                    — aggregate alert statistics
 *   - GET /records                  — list alert records with filters
 *   - POST /scan                    — trigger anomaly scan
 *   - POST /seed                    — create default rules for tenant
 *   - GET /:id                      — get one rule
 *   - PUT /:id                      — update a rule
 *   - DELETE /:id                   — soft-delete a rule
 *   - PATCH /:id/toggle             — enable/disable toggle
 *   - PATCH /records/:id/disposition — acknowledge/dismiss a record
 */

const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requireScope } = require('../middlewares/rbac.middleware');
const {
  createRule,
  listRules,
  getRule,
  updateRule,
  deleteRule,
  toggleRule,
  runScan,
  listRecords,
  getStats,
  updateDisposition,
  seedDefaultRules,
} = require('../controllers/alertRule.controller');

const router = express.Router();

// Static-path routes first so they are not caught by /:id
router.get('/stats', auth, requireScope('report:read'), getStats);
router.get('/records', auth, requireScope('report:read'), listRecords);
router.post('/scan', auth, requireScope('report:write'), runScan);
router.post('/seed', auth, requireScope('report:write'), seedDefaultRules);
router.patch('/records/:id/disposition', auth, requireScope('report:write'), updateDisposition);

// CRUD
router.post('/', auth, requireScope('report:write'), createRule);
router.get('/', auth, requireScope('report:read'), listRules);
router.get('/:id', auth, requireScope('report:read'), getRule);
router.put('/:id', auth, requireScope('report:write'), updateRule);
router.delete('/:id', auth, requireScope('report:write'), deleteRule);
router.patch('/:id/toggle', auth, requireScope('report:write'), toggleRule);

module.exports = router;
