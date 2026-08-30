/**
 * Tests for payroll-run idempotency (issue #1800): duplicate-run
 * prevention, idempotent retries, and resuming after a worker crash.
 */

'use strict';

const mongoose = require('mongoose');

const mockEmployee = {
  find: jest.fn().mockResolvedValue([
    { _id: 'emp123', fullName: 'Alice', isActive: true },
  ]),
};

const mockSave = jest.fn().mockResolvedValue({});
function mockPayrollUpdateConstructor() {
  this.save = mockSave;
}
const mockFindOneQuery = { session: jest.fn().mockResolvedValue(null) };
mockPayrollUpdateConstructor.findOne = jest.fn().mockReturnValue(mockFindOneQuery);

const mockUser = { findById: jest.fn().mockResolvedValue({ _id: 'user123' }) };

jest.mock('../../models/employee.model', () => mockEmployee);
jest.mock('../../models/payroll.model', () => mockPayrollUpdateConstructor);
jest.mock('../../models/user.model', () => mockUser);
jest.mock('../../jobs/queue.service', () => ({ connection: {} }));

const mockAcquireLock = jest.fn().mockResolvedValue(true);
const mockReleaseLock = jest.fn().mockResolvedValue();
jest.mock('../../utils/lockManager', () => ({
  acquireLock: mockAcquireLock,
  releaseLock: mockReleaseLock,
}));

const mockPayrollRun = {
  findOne: jest.fn(),
  create: jest.fn(),
  updateOne: jest.fn().mockResolvedValue({}),
};
jest.mock('../../models/payrollRun.model', () => mockPayrollRun);

const payrollWorker = require('../payroll.worker');

describe('Payroll Run Idempotency', () => {
  let mockJob;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAcquireLock.mockResolvedValue(true);
    mockJob = {
      id: 'job123',
      data: {
        userId: 'user123',
        tenantId: 'tenant-A',
        currentMonth: 8,
        currentYear: 2026,
        activities: [{ employeeId: 'emp123', tags: [] }],
      },
      updateProgress: jest.fn().mockResolvedValue({}),
    };

    const mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);
  });

  afterEach(() => {
    mongoose.startSession.mockRestore();
  });

  it('returns the stored result instead of reprocessing an already-completed run', async () => {
    mockPayrollRun.findOne.mockResolvedValue({
      status: 'completed',
      result: { success: true, processedCount: 3 },
    });

    const processor = payrollWorker.processFn;
    const res = await processor(mockJob);

    expect(res).toEqual({
      skipped: true,
      reason: 'already_completed',
      result: { success: true, processedCount: 3 },
    });
    expect(mockEmployee.find).not.toHaveBeenCalled();
    expect(mockPayrollRun.create).not.toHaveBeenCalled();
  });

  it('does not create a second run when two requests race for the same identity', async () => {
    mockPayrollRun.findOne.mockResolvedValue(null);
    const dupError = new Error('E11000 duplicate key error');
    dupError.code = 11000;
    mockPayrollRun.create.mockRejectedValue(dupError);

    const processor = payrollWorker.processFn;
    const res = await processor(mockJob);

    expect(res).toEqual({ skipped: true, reason: 'duplicate_run' });
    expect(mockEmployee.find).not.toHaveBeenCalled();
  });

  it('resumes an existing "processing" run instead of blocking forever after a worker crash', async () => {
    const existingRun = {
      _id: 'run123',
      status: 'processing',
      save: jest.fn().mockResolvedValue({}),
    };
    mockPayrollRun.findOne.mockResolvedValue(existingRun);

    const processor = payrollWorker.processFn;
    await processor(mockJob);

    expect(existingRun.save).toHaveBeenCalled();
    expect(mockEmployee.find).toHaveBeenCalled();
    expect(mockPayrollRun.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'run123' }),
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'completed' }),
      }),
    );
  });
});