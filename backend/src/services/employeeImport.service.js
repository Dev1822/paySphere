/**
 * Employee Import Service - Issue #1112
 *
 * Streaming CSV validation and atomic batch import.
 */
'use strict';

const { parse }      = require('csv-parse');
const { Readable }   = require('stream');
const mongoose       = require('mongoose');
const Employee       = require('../models/employee.model');
const EmployeeImport = require('../models/employeeImport.model');
const logger         = require('../utils/logger');

const REQUIRED_FIELDS = ['fullName', 'department', 'monthlySalary'];

function validateRow(row, rowIndex) {
  const errors = [];
  for (const field of REQUIRED_FIELDS) {
    if (!row[field] || String(row[field]).trim() === '') {
      errors.push({ row: rowIndex, message: field + ' is required.' });
    }
  }
  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
    errors.push({ row: rowIndex, message: 'email is not a valid address.' });
  }
  const salary = parseFloat(row.monthlySalary);
  if (row.monthlySalary && (isNaN(salary) || salary < 0)) {
    errors.push({ row: rowIndex, message: 'monthlySalary must be a positive number.' });
  }
  return { valid: errors.length === 0, errors };
}

function applyMapping(rawRow, mapping) {
  if (!mapping || Object.keys(mapping).length === 0) return rawRow;
  const mapped = {};
  for (const [csvCol, schemaField] of Object.entries(mapping)) {
    if (rawRow[csvCol] !== undefined) mapped[schemaField] = rawRow[csvCol];
  }
  return mapped;
}

/**
 * Parse and validate a CSV buffer using streaming.
 * Returns validated rows and any per-row errors without touching the DB.
 */
async function parseAndValidate(csvBuffer, mapping) {
  return new Promise((resolve, reject) => {
    const validRows = [];
    const errorRows = [];
    let rowIndex = 0;

    Readable.from(csvBuffer)
      .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }))
      .on('data', (rawRow) => {
        rowIndex++;
        const row    = applyMapping(rawRow, mapping);
        const result = validateRow(row, rowIndex);
        if (result.valid) validRows.push(row);
        else errorRows.push(...result.errors);
      })
      .on('end',   () => resolve({ validRows, errorRows, totalRows: rowIndex }))
      .on('error', reject);
  });
}

/**
 * Commit a previewed import inside a Mongoose transaction.
 * If any chunk fails the transaction aborts and no employees are persisted.
 */
async function commitImport(importJobId, tenantId, createdBy) {
  const job = await EmployeeImport.findOne({ _id: importJobId, tenantId });
  if (!job) throw Object.assign(new Error('Import job not found.'), { status: 404 });
  if (job.status !== 'preview_ready') {
    throw Object.assign(new Error('Job is not ready to commit. Status: ' + job.status), { status: 400 });
  }

  const session    = await mongoose.startSession();
  const createdIds = [];
  session.startTransaction();

  try {
    const CHUNK = 100;
    for (let i = 0; i < job.validatedRows.length; i += CHUNK) {
      const chunk = job.validatedRows.slice(i, i + CHUNK).map(row => ({
        ...row,
        tenantId,
        createdBy,
        importBatchId: importJobId,
        monthlySalary: parseFloat(row.monthlySalary),
      }));
      const docs = await Employee.insertMany(chunk, { session });
      createdIds.push(...docs.map(d => d._id));
    }

    await session.commitTransaction();
    job.status = 'done';
    job.importedEmployeeIds = createdIds;
    job.validatedRows = [];
    await job.save();

    logger.info('Employee import committed', { importJobId, count: createdIds.length });
    return { imported: createdIds.length };
  } catch (err) {
    await session.abortTransaction();
    job.status = 'failed';
    await job.save();
    logger.error('Import commit failed, transaction rolled back', { importJobId, error: err.message });
    throw err;
  } finally {
    session.endSession();
  }
}

/**
 * Roll back a done import by deleting all employees tagged with the batch ID.
 */
async function rollbackImport(importJobId, tenantId) {
  const job = await EmployeeImport.findOne({ _id: importJobId, tenantId });
  if (!job) throw Object.assign(new Error('Import job not found.'), { status: 404 });

  await Employee.deleteMany({ importBatchId: importJobId, tenantId });
  job.status = 'rolled_back';
  job.importedEmployeeIds = [];
  await job.save();

  logger.info('Employee import rolled back', { importJobId });
  return { rolledBack: true };
}

/**
 * Queue async batch import via BullMQ
 */
async function commitImportAsync(importJobId, tenantId, createdBy) {
  const queue = require('../jobs/queue.service').getQueue('employee-import');
  const job = await EmployeeImport.findOne({ _id: importJobId, tenantId });
  
  if (!job) throw Object.assign(new Error('Import job not found.'), { status: 404 });
  if (job.status !== 'preview_ready') {
    throw Object.assign(new Error('Job is not ready to commit. Status: ' + job.status), { status: 400 });
  }

  job.status = 'importing';
  const totalBatches = Math.ceil(job.validatedRows.length / job.batchSize);
  
  // Queue all batches
  for (let i = 0; i < totalBatches; i++) {
    await queue.add('process-batch', {
      importJobId,
      batchIndex: i,
      tenantId,
      createdBy
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true
    });
  }

  await job.save();
  logger.info('Import queued', { importJobId, totalBatches });
  
  return { jobId: importJobId, status: 'importing' };
}

module.exports = { 
  parseAndValidate, 
  commitImport, 
  rollbackImport,
  commitImportAsync 
};