const express = require('express');
const {
  getDefinitions,
  createDefinition,
  updateDefinition,
  deleteDefinition,
} = require('../controllers/customField.controller');
const auth = require('../middlewares/auth.middleware');
const { requireScope } = require('../middlewares/rbac.middleware');
const router = express.Router();

router.get('/', auth, requireScope('employee:read'), getDefinitions);
router.post('/', auth, requireScope('employee:write'), createDefinition);
router.put('/:id', auth, requireScope('employee:write'), updateDefinition);
router.delete('/:id', auth, requireScope('employee:write'), deleteDefinition);

module.exports = router;
