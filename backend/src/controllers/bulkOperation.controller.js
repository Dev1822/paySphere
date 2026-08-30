const bulkOperationService = require('../services/bulkOperation.service');
const BulkOperation = require('../models/bulkOperation.model');
const { tenantFilter } = require('../utils/tenantScope');

exports.previewBulkOperation = async (req, res, next) => {
  try {
    const { operationType, employeeIds, spec } = req.body;

    if (!operationType || !Array.isArray(employeeIds) || !spec) {
      return res.status(400).json({ message: 'Invalid payload' });
    }

    const preview = await bulkOperationService.previewOperation(
      req.tenantId,
      operationType,
      employeeIds,
      spec,
    );

    res.status(200).json(preview);
  } catch (err) {
    next(err);
  }
};

exports.executeBulkOperation = async (req, res, next) => {
  try {
    const { operationType, employeeIds, spec } = req.body;

    if (!operationType || !Array.isArray(employeeIds) || !spec) {
      return res.status(400).json({ message: 'Invalid payload' });
    }

    const operation = await bulkOperationService.executeOperation(
      req.tenantId,
      req.userId,
      operationType,
      employeeIds,
      spec,
    );

    res.status(201).json(operation);
  } catch (err) {
    next(err);
  }
};

exports.rollbackBulkOperation = async (req, res, next) => {
  try {
    const { id } = req.params;

    const operation = await bulkOperationService.rollbackOperation(
      req.tenantId,
      req.userId,
      id,
    );

    res.status(200).json(operation);
  } catch (err) {
    if (err.message.includes('not found')) {
      return res.status(404).json({ message: err.message });
    }
    if (err.message.includes('Can only rollback')) {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  }
};

exports.getBulkOperations = async (req, res, next) => {
  try {
    const operations = await BulkOperation.find(tenantFilter(req, {}))
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json(operations);
  } catch (err) {
    next(err);
  }
};
