/**
 * Payslip Generation Service - Issue #1904
 *
 * Handles queueing of deterministic payslip generation jobs.
 * Detects existing jobs to prevent duplicates.
 */
'use strict';

const crypto = require('crypto');
const payslipQueue = require('../jobs/payslipQueue');
const PayslipGeneration = require('../models/payslipGeneration.model');
const logger = require('../utils/logger');

/**
 * Generate deterministic hash for payroll + employee
 */
function generateJobHash(payrollId, employeeId) {
  return crypto
    .createHash('sha256')
    .update(`${payrollId}:${employeeId}`)
    .digest('hex')
    .substring(0, 16);
}

/**
 * Queue payslip generation or return existing job if already completed
 */
async function queuePayslipGeneration(payrollId, employeeId, tenantId) {
  const jobHash = generateJobHash(payrollId, employeeId);

  logger.info('Checking for existing payslip generation', { jobHash });

  // Check if already completed
  const existing = await PayslipGeneration.findOne({ jobHash });
  
  if (existing && existing.status === 'completed') {
    logger.info('Payslip already exists, returning cached', { jobHash });
    return {
      jobHash,
      status: 'completed',
      pdfPath: existing.pdfPath,
      pdfUrl: existing.pdfUrl,
      cached: true
    };
  }

  // Check if already queued and pending/processing
  if (existing && ['pending', 'processing'].includes(existing.status)) {
    logger.info('Payslip generation already queued', { jobHash });
    return {
      jobHash,
      status: existing.status,
      cached: false,
      alreadyQueued: true
    };
  }

  // Create new generation record
  const generation = await PayslipGeneration.create({
    jobHash,
    payrollId,
    employeeId,
    tenantId,
    status: 'pending'
  });

  // Queue the job
  const job = await payslipQueue.add('generate', {
    jobHash,
    payrollId,
    employeeId,
    tenantId
  }, {
    jobId: jobHash // Use deterministic job ID
  });

  generation.queueJobId = job.id;
  await generation.save();

  logger.info('Payslip generation queued', { jobHash, queueJobId: job.id });

  return {
    jobHash,
    status: 'pending',
    queueJobId: job.id,
    cached: false
  };
}

/**
 * Get generation status by job hash
 */
async function getGenerationStatus(jobHash) {
  const generation = await PayslipGeneration.findOne({ jobHash });
  
  if (!generation) {
    return { status: 'not_found', jobHash };
  }

  return {
    jobHash,
    status: generation.status,
    pdfPath: generation.pdfPath,
    pdfUrl: generation.pdfUrl,
    fileSize: generation.fileSize,
    errorMessage: generation.errorMessage,
    completedAt: generation.completedAt,
    retryCount: generation.retryCount
  };
}

/**
 * Get all payslips for a payroll
 */
async function getPayrollPayslips(payrollId, tenantId) {
  const generations = await PayslipGeneration.find({
    payrollId,
    tenantId,
    status: 'completed'
  });

  return generations.map(g => ({
    jobHash: g.jobHash,
    employeeId: g.employeeId,
    pdfPath: g.pdfPath,
    pdfUrl: g.pdfUrl,
    fileSize: g.fileSize,
    completedAt: g.completedAt
  }));
}

module.exports = {
  queuePayslipGeneration,
  getGenerationStatus,
  getPayrollPayslips,
  generateJobHash
};