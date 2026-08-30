/**
 * Tests for Payslip Generation Worker
 * Issue #1904
 */
'use strict';

const { generatePayslip, generateJobHash } = require('../payslipGeneration.worker');
const PayslipGeneration = require('../../models/payslipGeneration.model');
const Payroll = require('../../models/payroll.model');
const Employee = require('../../models/employee.model');

describe('Payslip Generation Worker', () => {
  let payroll, employee, jobHash;

  beforeEach(async () => {
    const tenantId = 'test-tenant-123';

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

    jobHash = generateJobHash(payroll._id, employee._id);
  });

  test('should skip already completed generation', async () => {
    // Create completed generation
    await PayslipGeneration.create({
      jobHash,
      payrollId: payroll._id,
      employeeId: employee._id,
      tenantId: payroll.tenantId,
      status: 'completed',
      pdfPath: '/pdfs/test.pdf'
    });

    const job = {
      data: {
        jobHash,
        payrollId: payroll._id,
        employeeId: employee._id,
        tenantId: payroll.tenantId
      }
    };

    const result = await generatePayslip(job);
    
    expect(result.skipped).toBe(true);
    expect(result.pdfPath).toBe('/pdfs/test.pdf');
  });

  test('should be idempotent', async () => {
    const job = {
      data: {
        jobHash,
        payrollId: payroll._id,
        employeeId: employee._id,
        tenantId: payroll.tenantId
      }
    };

    const result1 = await generatePayslip(job);
    const result2 = await generatePayslip(job);

    expect(result1.pdfPath).toBe(result2.pdfPath);
  });

  test('should track retry count on failure', async () => {
    // Simulate missing payroll
    const job = {
      data: {
        jobHash,
        payrollId: 'invalid-id',
        employeeId: employee._id,
        tenantId: 'tenant-id'
      }
    };

    await PayslipGeneration.create({
      jobHash,
      payrollId: 'invalid-id',
      employeeId: employee._id,
      tenantId: 'tenant-id',
      status: 'pending'
    });

    try {
      await generatePayslip(job);
    } catch (err) {
      // Expected to fail
    }

    const generation = await PayslipGeneration.findOne({ jobHash });
    expect(generation.retryCount).toBeGreaterThan(0);
  });
});