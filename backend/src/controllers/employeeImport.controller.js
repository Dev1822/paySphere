/**
 * Employee Import Controller - Issue #1112
 *
 * POST   /api/employees/import              - upload CSV, run validation
 * GET    /api/employees/import/:jobId       - poll status and preview errors
 * POST   /api/employees/import/:jobId/commit - commit after reviewing preview
 * DELETE /api/employees/import/:jobId       - rollback a completed import
 */
'use strict';

const EmployeeImport = require('../models/employeeImport.model');
const { parseAndValidate, commitImport, rollbackImport } = require('../services/employeeImport.service');
const { tenantFilter } = require('../utils/tenantScope');
const logger = require('../utils/logger');

async function startImport(req, res) {
  try {
    if (!req.file) return res.status(400).json({ message: 'A CSV file is required.' });

    const mapping  = req.body.mapping ? JSON.parse(req.body.mapping) : {};
    const tenantId = req.tenantId;

    const job = await EmployeeImport.create({ tenantId, createdBy: req.userId, status: 'validating' });

    const { validRows, errorRows, totalRows } = await parseAndValidate(req.file.buffer, mapping);

    job.totalRows     = totalRows;
    job.validRows     = validRows.length;
    job.errorRows     = errorRows.length;
    job.errors        = errorRows;
    job.validatedRows = validRows;
    job.status        = 'preview_ready';
    await job.save();

    return res.status(201).json({
      jobId:     job._id,
      status:    job.status,
      totalRows,
      validRows: validRows.length,
      errorRows: errorRows.length,
      errors:    errorRows,
    });
  } catch (err) {
    logger.error('startImport error', { error: err.message });
    return res.status(500).json({ message: 'Failed to start import.' });
  }
}

async function getImportJob(req, res) {
  try {
    const job = await EmployeeImport.findOne({ _id: req.params.jobId, ...tenantFilter(req) });
    if (!job) return res.status(404).json({ message: 'Import job not found.' });
    return res.json({
      jobId:         job._id,
      status:        job.status,
      totalRows:     job.totalRows,
      validRows:     job.validRows,
      errorRows:     job.errorRows,
      errors:        job.errors,
      importedCount: job.importedEmployeeIds.length,
    });
  } catch (err) {
    logger.error('getImportJob error', { error: err.message });
    return res.status(500).json({ message: 'Could not fetch import job.' });
  }
}

async function commitJob(req, res) {
  try {
    const { jobId } = req.params;
    const result = await commitImportAsync(jobId, req.tenantId, req.userId);
    return res.json({ 
      message: 'Import queued for processing.',
      jobId: result.jobId,
      status: result.status 
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    logger.error('commitJob error', { error: err.message });
    return res.status(500).json({ message: 'Commit failed.' });
  }
}
async function rollbackJob(req, res) {
  try {
    const result = await rollbackImport(req.params.jobId, req.tenantId);
    return res.json({ message: 'Import rolled back.', ...result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    logger.error('rollbackJob error', { error: err.message });
    return res.status(500).json({ message: 'Rollback failed.' });
  }
}
async function getImportProgress(req, res) {
  try {
    const job = await EmployeeImport.findOne({ 
      _id: req.params.jobId, 
      ...tenantFilter(req) 
    });
    
    if (!job) return res.status(404).json({ message: 'Import job not found.' });
    
    const totalBatches = Math.ceil(job.validatedRows.length / job.batchSize);
    const processedBatches = job.processedBatches.length;
    const progress = totalBatches > 0 ? Math.round((processedBatches / totalBatches) * 100) : 0;
    
    return res.json({
      jobId: job._id,
      status: job.status,
      progress,
      totalRows: job.totalRows,
      successfulRows: job.successfulRows,
      failedRows: job.errorRows,
      duplicateRows: job.duplicateCount,
      processedBatches,
      totalBatches
    });
  } catch (err) {
    logger.error('getImportProgress error', { error: err.message });
    return res.status(500).json({ message: 'Could not fetch progress.' });
  }
}

module.exports = {
  startImport,
  getImportJob,
  commitJob,
  rollbackJob,
  getImportProgress
};
module.exports = { startImport, getImportJob, commitJob, rollbackJob };