/**
 * Payslip Generation Worker - Issue #1904
 *
 * Generates payslip PDF from finalized payroll.
 * Idempotent: multiple runs produce same output.
 * Recoverable: detects and skips already-completed jobs.
 */
'use strict';

const path = require('path');
const fs = require('fs').promises;
const PDFDocument = require('pdfkit');
const crypto = require('crypto');
const Payroll = require('../models/payroll.model');
const Employee = require('../models/employee.model');
const PayslipGeneration = require('../models/payslipGeneration.model');
const logger = require('../utils/logger');

const PDF_OUTPUT_DIR = process.env.PDF_OUTPUT_DIR || './pdfs';

/**
 * Generate deterministic job hash for payroll + employee
 */
function generateJobHash(payrollId, employeeId) {
  return crypto
    .createHash('sha256')
    .update(`${payrollId}:${employeeId}`)
    .digest('hex')
    .substring(0, 16);
}

/**
 * Create simple payslip PDF document
 */
async function createPayslipPDF(payroll, employee, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const stream = require('fs').createWriteStream(outputPath);

    doc.pipe(stream);

    // Header
    doc.fontSize(16).font('Helvetica-Bold').text('PAYSLIP', { align: 'center' });
    doc.moveDown();

    // Employee info
    doc.fontSize(10).font('Helvetica');
    doc.text(`Employee: ${employee.fullName}`);
    doc.text(`Email: ${employee.email}`);
    doc.text(`Department: ${employee.department}`);
    doc.moveDown();

    // Payroll info
    doc.text(`Month: ${payroll.payrollMonth}`);
    doc.text(`Amount: $${payroll.totalAmount || 0}`);
    doc.text(`Status: ${payroll.status}`);
    doc.moveDown();

    // Footer
    doc.fontSize(8).text(`Generated: ${new Date().toISOString()}`);

    doc.end();

    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
}

/**
 * Main worker function - generates payslip PDF
 * Idempotent: skips if already completed
 */
async function generatePayslip(job) {
  const { jobHash, payrollId, employeeId, tenantId } = job.data;

  logger.info('Starting payslip generation', { jobHash, payrollId, employeeId });

  // Check if already completed
  let generation = await PayslipGeneration.findOne({ jobHash });
  
  if (generation && generation.status === 'completed') {
    logger.info('Payslip already generated, skipping', { jobHash });
    return {
      skipped: true,
      pdfPath: generation.pdfPath,
      jobHash
    };
  }

  // Create or update generation record
  if (!generation) {
    generation = await PayslipGeneration.create({
      jobHash,
      payrollId,
      employeeId,
      tenantId,
      status: 'processing'
    });
  } else {
    generation.status = 'processing';
    generation.lastProcessedAt = new Date();
    generation.retryCount += 1;
    await generation.save();
  }

  try {
    // Fetch data
    const payroll = await Payroll.findById(payrollId);
    const employee = await Employee.findById(employeeId);

    if (!payroll || !employee) {
      throw new Error('Payroll or employee not found');
    }

    // Ensure output directory exists
    await fs.mkdir(PDF_OUTPUT_DIR, { recursive: true });

    // Generate PDF with deterministic filename
    const filename = `payslip_${jobHash}.pdf`;
    const pdfPath = path.join(PDF_OUTPUT_DIR, filename);
    const pdfUrl = `/payslips/${filename}`;

    await createPayslipPDF(payroll, employee, pdfPath);

    // Get file size
    const stats = await fs.stat(pdfPath);

    // Update generation record
    generation.status = 'completed';
    generation.pdfPath = pdfPath;
    generation.pdfUrl = pdfUrl;
    generation.fileSize = stats.size;
    generation.completedAt = new Date();
    generation.errorMessage = null;
    await generation.save();

    logger.info('Payslip generated successfully', { 
      jobHash, 
      fileSize: stats.size,
      pdfPath 
    });

    return {
      generated: true,
      pdfPath,
      pdfUrl,
      fileSize: stats.size,
      jobHash
    };
  } catch (err) {
    // Mark as failed (but retryable)
    generation.status = 'failed';
    generation.errorMessage = err.message;
    await generation.save();

    logger.error('Payslip generation failed', {
      jobHash,
      error: err.message,
      retryCount: generation.retryCount
    });

    throw err;
  }
}

module.exports = { generatePayslip, generateJobHash };