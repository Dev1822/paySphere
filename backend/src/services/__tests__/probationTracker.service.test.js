const ProbationTrackerService = require('../probationTracker.service');
const ProbationTracker = require('../../models/probationTracker.model');
const ProbationPolicy = require('../../models/probationPolicy.model');
const Employee = require('../../models/employee.model');
const mongoose = require('mongoose');

jest.mock('../../models/probationTracker.model');
jest.mock('../../models/probationPolicy.model');
jest.mock('../../models/employee.model');

describe('ProbationTrackerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('extendProbation', () => {
    it('should throw 422 if max extensions exceeded', async () => {
      ProbationTracker.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: 'tracker123',
          status: 'active',
          extensionCount: 1,
          policyId: { maxExtensions: 1, durationMonths: 3, maxTotalMonths: 6 },
        }),
      });

      await expect(
        ProbationTrackerService.extendProbation({
          tenantId: 'tenant1',
          trackerId: 'tracker123',
          extensionMonths: 3,
        }),
      ).rejects.toMatchObject({
        statusCode: 422,
        message: expect.stringContaining(
          'Maximum number of extensions reached',
        ),
      });
    });

    it('should throw 422 if max total months exceeded', async () => {
      ProbationTracker.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: 'tracker123',
          status: 'active',
          extensionCount: 0,
          policyId: { maxExtensions: 2, durationMonths: 3, maxTotalMonths: 6 },
        }),
      });

      await expect(
        ProbationTrackerService.extendProbation({
          tenantId: 'tenant1',
          trackerId: 'tracker123',
          extensionMonths: 4, // 3 + 4 = 7 > 6
        }),
      ).rejects.toMatchObject({
        statusCode: 422,
        message: expect.stringContaining(
          'Total probation duration would exceed maximum',
        ),
      });
    });
  });

  describe('confirmProbation', () => {
    it('should confirm probation and update salary atomically', async () => {
      const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
      };
      mongoose.startSession = jest.fn().mockResolvedValue(mockSession);

      const mockTracker = {
        _id: 'tracker123',
        status: 'active',
        employeeId: 'emp123',
        save: jest.fn(),
        policyId: { salaryStepUpType: 'percentage', salaryStepUpValue: 10 },
      };

      const mockEmployee = {
        _id: 'emp123',
        employmentStatus: 'probation',
        monthlySalary: 1000,
        save: jest.fn(),
      };

      ProbationTracker.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          session: jest.fn().mockResolvedValue(mockTracker),
        }),
      });

      Employee.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockEmployee),
      });

      await ProbationTrackerService.confirmProbation({
        tenantId: 'tenant1',
        trackerId: 'tracker123',
      });

      expect(mockSession.startTransaction).toHaveBeenCalled();
      expect(mockTracker.status).toBe('confirmed');
      expect(mockTracker.save).toHaveBeenCalledWith({ session: mockSession });
      expect(mockEmployee.employmentStatus).toBe('active');
      expect(mockEmployee.monthlySalary).toBe(1100);
      expect(mockEmployee.save).toHaveBeenCalledWith({ session: mockSession });
      expect(mockSession.commitTransaction).toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
    });
  });
});
