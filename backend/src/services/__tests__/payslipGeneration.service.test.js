/**
 * Tests for Payslip Generation Service
 * Issue #1904
 */
'use strict';

const {
  queuePayslipGeneration,
  getGenerationStatus,
  generateJobHash
} = require('../payslipGeneration.service');
const PayslipGeneration = require('../../models/payslipGeneration.model');
const Payroll = require('../../models/payroll.model');
const Employee = require('../../models/employee.model');

describe('Payslip Generation Service', () => {
  let payroll, employee, tenantId;

  beforeEach(async () => {
    tenantId = 'test-tenant-123';

    payroll = await Payroll.create({
      tenantId,
      payrollMonth: '2026-08',
      status: 'finalized',
      totalAmount: 50000
    });

    employee = await Employee.create({
      tenantId,
      fullName: 'Test Employee',
      email: 'test@example.com',
      department: 'IT',
      monthlySalary: 5000
    });
  });

  test('should queue payslip generation', async () => {
    const result = await queuePayslipGeneration(payroll._id, employee._id, tenantId);
    
    expect(result.status).toBe('pending');
    expect(result.cached).toBe(false);
    expect(result.queueJobId).toBeDefined();
  });

  test('should not duplicate queue for same payroll/employee', async () => {
    // First call
    const result1 = await queuePayslipGeneration(payroll._id, employee._id, tenantId);
    
    // Second call should indicate already queued
    const result2 = await queuePayslipGeneration(payroll._id, employee._id, tenantId);
    
    expect(result2.alreadyQueued).toBe(true);
    expect(result1.jobHash).toBe(result2.jobHash);
  });

  test('should generate deterministic job hash', async () => {
    const hash1 = generateJobHash(payroll._id, employee._id);
    const hash2 = generateJobHash(payroll._id, employee._id);
    
    expect(hash1).toBe(hash2);
  });

  test('should return cached payslip if already completed', async () => {
    // Create completed generation
    await PayslipGeneration.create({
      jobHash: 'test-hash-123',
      payrollId: payroll._id,
      employeeId: employee._id,
      tenantId,
      status: 'completed',
      pdfPath: '/pdfs/test.pdf',
      pdfUrl: '/payslips/test.pdf'
    });

    const status = await getGenerationStatus('test-hash-123');
    
    expect(status.status).toBe('completed');
    expect(status.pdfUrl).toBe('/payslips/test.pdf');
  });

  test('should track generation status', async () => {
    const result = await queuePayslipGeneration(payroll._id, employee._id, tenantId);
    const status = await getGenerationStatus(result.jobHash);
    
    expect(status.status).toBe('pending');
    expect(status.jobHash).toBe(result.jobHash);
  });
});