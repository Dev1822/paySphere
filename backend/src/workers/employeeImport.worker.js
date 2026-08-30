/**
 * Employee Import Worker - Issue #1903
 *
 * BullMQ worker processor for batch import of employees.
 * Processes in controlled BATCH_SIZE chunks with resumable recovery.
 * Detects duplicates within batch and across existing employees.
 */
'use strict';

const mongoose = require('mongoose');
const Employee = require('../models/employee.model');
const EmployeeImport = require('../models/employeeImport.model');
const logger = require('../utils/logger');

const BATCH_SIZE = 100;

/**
 * Check for duplicates within batch and in database
 */
async function findDuplicates(batchRows, tenantId) {
  const duplicates = [];
  const emailsInBatch = new Set();
  const emailsInDb = new Set(
    (await Employee.find({ tenantId }, { email: 1 }))
      .map((e) => e.email)
      .filter((e) => e),
  );

  for (const row of batchRows) {
    if (row.email) {
      if (emailsInBatch.has(row.email) || emailsInDb.has(row.email)) {
        duplicates.push({
          email: row.email,
          fullName: row.fullName,
          message: `Duplicate email: ${row.email}`,
        });
      } else {
        emailsInBatch.add(row.email);
      }
    }
  }

  return duplicates;
}

/**
 * Main worker function - processes a single batch
 */
async function processBatch(job) {
  const { importJobId, batchIndex, tenantId, createdBy } = job.data;

  logger.info(`Processing batch ${batchIndex}`, { importJobId });

  const importJob = await EmployeeImport.findById(importJobId);
  if (!importJob) {
    throw new Error(`Import job ${importJobId} not found`);
  }

  // Skip if already processed
  if (importJob.processedBatches.includes(batchIndex)) {
    logger.info(`Batch ${batchIndex} already processed, skipping`, {
      importJobId,
    });
    return { skipped: true, batchIndex };
  }

  const startIdx = batchIndex * importJob.batchSize;
  const endIdx = startIdx + importJob.batchSize;
  let batchRows = importJob.validatedRows.slice(startIdx, endIdx);

  if (batchRows.length === 0) {
    return { processed: 0, batchIndex };
  }

  // Detect duplicates
  const batchDuplicates = await findDuplicates(batchRows, tenantId);
  if (batchDuplicates.length > 0) {
    importJob.duplicateRows.push(...batchDuplicates);
    importJob.duplicateCount += batchDuplicates.length;
    // Filter out duplicates for insertion
    batchRows = batchRows.filter(
      (row) => !batchDuplicates.some((dup) => dup.email === row.email),
    );
  }

  // Insert remaining rows in transaction
  const session = await mongoose.startSession();
  session.startTransaction();
  let createdCount = 0;

  try {
    const employeesToInsert = batchRows.map((row) => ({
      ...row,
      tenantId,
      createdBy,
      importBatchId: importJobId,
      monthlySalary: parseFloat(row.monthlySalary),
    }));

    const docs = await Employee.insertMany(employeesToInsert, { session });
    createdCount = docs.length;
    importJob.importedEmployeeIds.push(...docs.map((d) => d._id));

    await session.commitTransaction();

    importJob.processedBatches.push(batchIndex);
    importJob.lastProcessedBatch = batchIndex;
    importJob.successfulRows += createdCount;
    await importJob.save();

    logger.info(`Batch ${batchIndex} completed`, {
      importJobId,
      inserted: createdCount,
      duplicates: batchDuplicates.length,
    });

    return {
      processed: createdCount,
      duplicates: batchDuplicates.length,
      batchIndex,
    };
  } catch (err) {
    await session.abortTransaction();
    logger.error(`Batch ${batchIndex} failed`, {
      importJobId,
      error: err.message,
    });
    throw err;
  } finally {
    session.endSession();
  }
}

/**
 * Retry strategy: exponential backoff for transient failures
 */
async function retryHandler(job, err, attemptsMade) {
  logger.warn(`Job retry attempt ${attemptsMade}`, {
    jobId: job.id,
    error: err.message,
  });

  if (attemptsMade < 3) {
    const delay = Math.pow(2, attemptsMade) * 1000; // 1s, 2s, 4s
    throw new Error(`Retry after ${delay}ms: ${err.message}`);
  }

  throw err;
}

module.exports = {
  processBatch,
  retryHandler,
  BATCH_SIZE,
};
