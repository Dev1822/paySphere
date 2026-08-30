/**
 * Unit tests for payroll worker distributed locking mechanism.
 */

'use strict';

const mongoose = require('mongoose');

// Mock external models/services before requiring worker
const mockEmployee = {
  find: jest.fn().mockResolvedValue([]),
};

// Mock constructor and save method for PayrollUpdate model
const mockSave = jest.fn().mockResolvedValue({});
function mockPayrollUpdateConstructor(data) {
  this.save = mockSave;
}
const mockFindOneQuery = {
  session: jest.fn().mockResolvedValue(null),
};
mockPayrollUpdateConstructor.findOne = jest.fn().mockReturnValue(mockFindOneQuery);

const mockUser = {
  findById: jest.fn().mockResolvedValue({}),
};

jest.mock('../../models/employee.model', () => mockEmployee);
jest.mock('../../models/payroll.model', () => mockPayrollUpdateConstructor);
jest.mock('../../models/user.model', () => mockUser);
jest.mock('../../jobs/queue.service', () => ({
  connection: {},
}));

const mockAcquireLock = jest.fn();
const mockReleaseLock = jest.fn();
jest.mock('../../utils/lockManager', () => ({
  acquireLock: mockAcquireLock,
  releaseLock: mockReleaseLock,
}));

const mockPayrollRun = {
  findOne: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockResolvedValue({ _id: 'run123', status: 'processing' }),
  updateOne: jest.fn().mockResolvedValue({}),
};
jest.mock('../../models/payrollRun.model', () => mockPayrollRun);

const payrollWorker = require('../payroll.worker');
describe('Payroll Worker Lock Handling', () => {
  let mockJob;

  beforeEach(() => {
    jest.clearAllMocks();
    mockJob = {
      id: 'job123',
      data: {
        userId: 'user123',
        currentMonth: 8,
        currentYear: 2026,
        activities: [],
      },
      updateProgress: jest.fn().mockResolvedValue({}),
    };
  });

  it('should skip job if lock cannot be acquired', async () => {
    mockAcquireLock.mockResolvedValue(false);

    const processor = payrollWorker.processFn;
    const res = await processor(mockJob);

    expect(mockAcquireLock).toHaveBeenCalledWith('payroll_user123_2026_08', 600000);
    expect(res).toEqual({ skipped: true, reason: 'lock_held' });
    expect(mockEmployee.find).not.toHaveBeenCalled();
    expect(mockReleaseLock).not.toHaveBeenCalled();
  });

  it('should release the lock after job completes successfully', async () => {
    mockAcquireLock.mockResolvedValue(true);
    mockEmployee.find.mockResolvedValue([
      { _id: 'emp123', fullName: 'Alice', isActive: true },
    ]);
    mockUser.findById.mockResolvedValue({ _id: 'user123' });

    const mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);

    mockJob.data.activities = [{ employeeId: 'emp123', tags: [] }];

    const processor = payrollWorker.processFn;
    await processor(mockJob);

    expect(mockAcquireLock).toHaveBeenCalledWith('payroll_user123_2026_08', 600000);
    expect(mockReleaseLock).toHaveBeenCalledWith('payroll_user123_2026_08');

    mongoose.startSession.mockRestore();
  });

  it('should release the lock on processing failure', async () => {
    mockAcquireLock.mockResolvedValue(true);
    mockEmployee.find.mockRejectedValue(new Error('DB Query Failure'));

    const processor = payrollWorker.processFn;
    await expect(processor(mockJob)).rejects.toThrow('DB Query Failure');

    expect(mockReleaseLock).toHaveBeenCalledWith('payroll_user123_2026_08');
  });
});
