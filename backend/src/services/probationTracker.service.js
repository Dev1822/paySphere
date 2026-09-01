const mongoose = require('mongoose');
const ProbationTracker = require('../models/probationTracker.model');
const ProbationPolicy = require('../models/probationPolicy.model');
const Employee = require('../models/employee.model');
const {
  ValidationError,
  NotFoundError,
  AppError,
} = require('../utils/apiError');
const { EMPLOYMENT_STATUS } = require('../config/employment');
const { addMonths } = require('date-fns');

/**
 * Service to manage employee probation lifecycles.
 */
class ProbationTrackerService {
  /**
   * Auto-initiates probation during onboarding.
   */
  static async initiateProbation(
    { tenantId, employeeId, createdBy },
    session = null,
  ) {
    const employee = await Employee.findOne({
      _id: employeeId,
      tenantId,
    }).session(session);
    if (!employee) throw new NotFoundError('Employee not found');

    if (employee.employmentStatus !== EMPLOYMENT_STATUS.PROBATION) {
      return null;
    }

    // Try to find a matching policy by department and role, fallback to generic
    let policy = await ProbationPolicy.findOne({
      tenantId,
      department: employee.department,
      role: employee.role,
    }).session(session);

    if (!policy) {
      policy = await ProbationPolicy.findOne({
        tenantId,
        department: '',
        role: '',
      }).session(session);
    }

    if (!policy) {
      // Create a default policy if none exists
      policy = await ProbationPolicy.create(
        [
          {
            tenantId,
            name: 'Default Probation Policy',
            durationMonths: 3,
            maxExtensions: 1,
            maxTotalMonths: 6,
            createdBy,
          },
        ],
        { session },
      ).then((docs) => docs[0]);
    }

    const startDate = employee.joiningDate || new Date();
    const endDate = addMonths(startDate, policy.durationMonths);

    const tracker = new ProbationTracker({
      tenantId,
      employeeId,
      policyId: policy._id,
      startDate,
      endDate,
      status: 'active',
      createdBy,
    });

    await tracker.save({ session });
    return tracker;
  }

  /**
   * Submits a manager review.
   */
  static async submitReview({
    tenantId,
    trackerId,
    managerId,
    recommendation,
    notes,
  }) {
    const tracker = await ProbationTracker.findOne({
      _id: trackerId,
      tenantId,
    });
    if (!tracker) throw new NotFoundError('Probation tracker not found');
    if (!['active', 'extended'].includes(tracker.status)) {
      throw new ValidationError(
        'Can only review active or extended probations',
      );
    }

    tracker.reviews.push({
      managerId,
      reviewDate: new Date(),
      recommendation,
      notes,
    });

    await tracker.save();
    return tracker;
  }

  /**
   * Extends probation checking against policy limits.
   */
  static async extendProbation({
    tenantId,
    trackerId,
    extensionMonths,
    createdBy,
  }) {
    const tracker = await ProbationTracker.findOne({
      _id: trackerId,
      tenantId,
    }).populate('policyId');
    if (!tracker) throw new NotFoundError('Probation tracker not found');
    if (!['active', 'extended'].includes(tracker.status)) {
      throw new ValidationError(
        'Can only extend active or extended probations',
      );
    }

    const policy = tracker.policyId;

    if (tracker.extensionCount >= policy.maxExtensions) {
      throw new AppError(
        'Maximum number of extensions reached according to policy',
        422,
      );
    }

    const totalDurationMonths =
      (tracker.extensionCount + 1) * extensionMonths + policy.durationMonths;
    if (totalDurationMonths > policy.maxTotalMonths) {
      throw new AppError(
        'Total probation duration would exceed maximum allowed by policy',
        422,
      );
    }

    tracker.endDate = addMonths(tracker.endDate, extensionMonths);
    tracker.extensionCount += 1;
    tracker.status = 'extended';

    await tracker.save();
    return tracker;
  }

  /**
   * Confirms probation and atomically applies salary adjustments.
   */
  static async confirmProbation({ tenantId, trackerId, createdBy }) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const tracker = await ProbationTracker.findOne({
        _id: trackerId,
        tenantId,
      })
        .populate('policyId')
        .session(session);

      if (!tracker) throw new NotFoundError('Probation tracker not found');
      if (!['active', 'extended'].includes(tracker.status)) {
        throw new ValidationError(
          'Can only confirm active or extended probations',
        );
      }

      const employee = await Employee.findOne({
        _id: tracker.employeeId,
        tenantId,
      }).session(session);
      if (!employee) throw new NotFoundError('Employee not found');

      tracker.status = 'confirmed';
      await tracker.save({ session });

      employee.employmentStatus = EMPLOYMENT_STATUS.ACTIVE;

      const policy = tracker.policyId;
      if (
        policy.salaryStepUpType === 'percentage' &&
        policy.salaryStepUpValue > 0
      ) {
        employee.monthlySalary =
          employee.monthlySalary * (1 + policy.salaryStepUpValue / 100);
      } else if (
        policy.salaryStepUpType === 'fixed_amount' &&
        policy.salaryStepUpValue > 0
      ) {
        employee.monthlySalary += policy.salaryStepUpValue;
      }

      await employee.save({ session });

      await session.commitTransaction();
      return tracker;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}

module.exports = ProbationTrackerService;
