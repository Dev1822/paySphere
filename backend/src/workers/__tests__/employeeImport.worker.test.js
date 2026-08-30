/**
 * Tests for Employee Import Worker
 * Issue #1903
 */
'use strict';

const { processBatch } = require('../employeeImport.worker');
const Employee = require('../../models/employee.model');
const EmployeeImport = require('../../models/employeeImport.model');

describe('Employee Import Worker', () => {
  let importJob;

  beforeEach(async () => {
    importJob = await EmployeeImport.create({
      tenantId: 'test-tenant',
      createdBy: 'test-user',
      status: 'importing',
      validatedRows: [
        { fullName: 'John Doe', email: 'john@example.com', department: 'IT', monthlySalary: '5000' },
        { fullName: 'Jane Smith', email: 'jane@example.com', department: 'HR', monthlySalary: '4500' }
      ],
      batchSize: 100,
      processedBatches: [],
      lastProcessedBatch: -1
    });
  });

  test('should process batch without duplicates', async () => {
    const job = {
      data: {
        importJobId: importJob._id,
        batchIndex: 0,
        tenantId: 'test-tenant',
        createdBy: 'test-user'
      }
    };

    const result = await processBatch(job);
    expect(result.processed).toBe(2);
    expect(result.duplicates).toBe(0);
  });

  test('should detect duplicates within batch', async () => {
    const duplicateJob = await EmployeeImport.create({
      tenantId: 'test-tenant',
      createdBy: 'test-user',
      status: 'importing',
      validatedRows: [
        { fullName: 'John Doe', email: 'john@example.com', department: 'IT', monthlySalary: '5000' },
        { fullName: 'John Duplicate', email: 'john@example.com', department: 'IT', monthlySalary: '5000' }
      ],
      batchSize: 100,
      processedBatches: [],
      lastProcessedBatch: -1
    });

    const job = {
      data: {
        importJobId: duplicateJob._id,
        batchIndex: 0,
        tenantId: 'test-tenant',
        createdBy: 'test-user'
      }
    };

    const result = await processBatch(job);
    expect(result.duplicates).toBeGreaterThan(0);
  });

  test('should skip already processed batches', async () => {
    importJob.processedBatches = [0];
    await importJob.save();

    const job = {
      data: {
        importJobId: importJob._id,
        batchIndex: 0,
        tenantId: 'test-tenant',
        createdBy: 'test-user'
      }
    };

    const result = await processBatch(job);
    expect(result.skipped).toBe(true);
  });
});