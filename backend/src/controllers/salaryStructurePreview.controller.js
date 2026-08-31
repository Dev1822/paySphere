/**
 * Salary Structure Preview Controller - Issue #1111
 *
 * POST /api/salary-structures/preview      - evaluate components live without saving
 * POST /api/salary-structures/:id/validate - validate a saved structure
 */
'use strict';

const SalaryStructure    = require('../models/salaryStructure.model');
const { evaluateAll, validateComponents } = require('../services/formulaEngine.service');
const logger             = require('../utils/logger');

async function previewStructure(req, res) {
  try {
    const { components, context: sampleContext = {} } = req.body;

    if (!Array.isArray(components) || components.length === 0) {
      return res.status(400).json({ message: 'components must be a non-empty array.' });
    }

    const validation = validateComponents(components);
    if (!validation.valid) {
      return res.status(422).json({ message: 'Formula validation failed.', errors: validation.errors });
    }

    return res.json(evaluateAll(components, sampleContext));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    logger.error('previewStructure error', { error: err.message });
    return res.status(500).json({ message: 'Preview failed.' });
  }
}

async function validateStructure(req, res) {
  try {
    const structure = await SalaryStructure.findOne({ _id: req.params.id, ...{} });
    if (!structure) return res.status(404).json({ message: 'Salary structure not found.' });

    return res.json(validateComponents(structure.components || []));
  } catch (err) {
    logger.error('validateStructure error', { error: err.message });
    return res.status(500).json({ message: 'Validation failed.' });
  }
}

module.exports = { previewStructure, validateStructure };