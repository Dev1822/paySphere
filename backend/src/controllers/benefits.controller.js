/**
 * @fileoverview Company Benefits Enrollment Controller
 * @description Manages benefit plans and employee enrollments.  Admins define
 * benefit offerings with premiums and coverage types; employees enroll during
 * open windows; the system tracks monthly deductions for payroll.
 */

const BenefitPlan = require('../models/benefitPlan.model');
const BenefitEnrollment = require('../models/benefitEnrollment.model');
const Employee = require('../models/employee.model');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');
const { sanitizeText } = require('../utils/validators');

// ─── Admin: Create Benefit Plan ───────────────────────────────────────────

exports.createPlan = async (req, res, next) => {
  try {
    const {
      name,
      category,
      description,
      provider,
      monthlyPremium,
      employerContribution,
      employeeContribution,
      coverageType,
      enrollmentStartDate,
      enrollmentEndDate,
      maxEnrollees,
    } = req.body;

    if (!name || !name.trim())
      return res.status(400).json({ message: 'Plan name is required' });
    if (!category)
      return res.status(400).json({ message: 'Category is required' });
    if (monthlyPremium === undefined || monthlyPremium < 0) {
      return res
        .status(400)
        .json({ message: 'Monthly premium must be a non-negative number' });
    }

    const existing = await BenefitPlan.findOne({
      tenantId: req.tenantId,
      name: name.trim(),
    });
    if (existing) {
      return res
        .status(409)
        .json({
          message: `A benefit plan named "${name.trim()}" already exists`,
        });
    }

    const plan = await BenefitPlan.create({
      tenantId: req.tenantId,
      name: sanitizeText(name),
      category,
      description: description ? sanitizeText(description) : '',
      provider: provider ? sanitizeText(provider) : '',
      monthlyPremium: Number(monthlyPremium),
      employerContribution: Number(employerContribution) || 0,
      employeeContribution: Number(employeeContribution) || 0,
      coverageType: coverageType || 'individual',
      enrollmentStartDate: enrollmentStartDate
        ? new Date(enrollmentStartDate)
        : undefined,
      enrollmentEndDate: enrollmentEndDate
        ? new Date(enrollmentEndDate)
        : undefined,
      maxEnrollees: maxEnrollees || undefined,
      createdBy: req.userId,
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'BENEFIT_PLAN_CREATE',
      resourceType: 'BenefitPlan',
      resourceIds: [plan._id],
      details: {
        name: plan.name,
        category: plan.category,
        premium: plan.monthlyPremium,
      },
      req,
    });

    logger.info('Benefit plan created', {
      userId: req.userId,
      planId: plan._id,
    });
    return res.status(201).json({ message: 'Benefit plan created', plan });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: 'Benefit plan name already exists' });
    }
    logger.error('Failed to create benefit plan', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Admin: List Benefit Plans ────────────────────────────────────────────

exports.getPlans = async (req, res, next) => {
  try {
    const { category, isActive } = req.query;
    const filter = { tenantId: req.tenantId };
    if (category) filter.category = category;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const plans = await BenefitPlan.find(filter)
      .populate('createdBy', 'fullName email')
      .sort({ category: 1, name: 1 });

    return res.status(200).json({ plans });
  } catch (error) {
    logger.error('Failed to fetch benefit plans', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Admin/Employee: Get Plan by ID ───────────────────────────────────────

exports.getPlanById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const plan = await BenefitPlan.findOne({
      _id: id,
      tenantId: req.tenantId,
    }).populate('createdBy', 'fullName email');

    if (!plan)
      return res.status(404).json({ message: 'Benefit plan not found' });
    return res.status(200).json({ plan });
  } catch (error) {
    logger.error('Failed to fetch benefit plan', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Admin: Update Benefit Plan ───────────────────────────────────────────

exports.updatePlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      category,
      description,
      provider,
      monthlyPremium,
      employerContribution,
      employeeContribution,
      coverageType,
      enrollmentStartDate,
      enrollmentEndDate,
      maxEnrollees,
      isActive,
    } = req.body;

    const plan = await BenefitPlan.findOne({ _id: id, tenantId: req.tenantId });
    if (!plan)
      return res.status(404).json({ message: 'Benefit plan not found' });

    if (name !== undefined) plan.name = sanitizeText(name);
    if (category !== undefined) plan.category = category;
    if (description !== undefined) plan.description = sanitizeText(description);
    if (provider !== undefined) plan.provider = sanitizeText(provider);
    if (monthlyPremium !== undefined)
      plan.monthlyPremium = Number(monthlyPremium);
    if (employerContribution !== undefined)
      plan.employerContribution = Number(employerContribution);
    if (employeeContribution !== undefined)
      plan.employeeContribution = Number(employeeContribution);
    if (coverageType !== undefined) plan.coverageType = coverageType;
    if (enrollmentStartDate !== undefined)
      plan.enrollmentStartDate = enrollmentStartDate
        ? new Date(enrollmentStartDate)
        : undefined;
    if (enrollmentEndDate !== undefined)
      plan.enrollmentEndDate = enrollmentEndDate
        ? new Date(enrollmentEndDate)
        : undefined;
    if (maxEnrollees !== undefined)
      plan.maxEnrollees = maxEnrollees || undefined;
    if (isActive !== undefined) plan.isActive = isActive;

    await plan.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'BENEFIT_PLAN_UPDATE',
      resourceType: 'BenefitPlan',
      resourceIds: [plan._id],
      details: { name: plan.name, changes: Object.keys(req.body) },
      req,
    });

    logger.info('Benefit plan updated', {
      userId: req.userId,
      planId: plan._id,
    });
    return res.status(200).json({ message: 'Plan updated', plan });
  } catch (error) {
    logger.error('Failed to update benefit plan', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Admin: Delete Benefit Plan ───────────────────────────────────────────

exports.deletePlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const activeEnrollments = await BenefitEnrollment.countDocuments({
      planId: id,
      tenantId: req.tenantId,
      status: { $in: ['enrolled', 'pending'] },
    });
    if (activeEnrollments > 0) {
      return res.status(400).json({
        message: `Cannot delete plan with ${activeEnrollments} active enrollment(s). Terminate them first.`,
      });
    }

    const plan = await BenefitPlan.findOneAndDelete({
      _id: id,
      tenantId: req.tenantId,
    });
    if (!plan)
      return res.status(404).json({ message: 'Benefit plan not found' });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'BENEFIT_PLAN_DELETE',
      resourceType: 'BenefitPlan',
      resourceIds: [plan._id],
      details: { name: plan.name },
      req,
    });

    logger.info('Benefit plan deleted', {
      userId: req.userId,
      planId: plan._id,
    });
    return res.status(200).json({ message: 'Plan deleted' });
  } catch (error) {
    logger.error('Failed to delete benefit plan', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Employee: Enroll in Benefit Plan ─────────────────────────────────────

exports.enroll = async (req, res, next) => {
  try {
    const { planId, coverageType, dependents } = req.body;

    if (!planId) return res.status(400).json({ message: 'planId is required' });

    const plan = await BenefitPlan.findOne({
      _id: planId,
      tenantId: req.tenantId,
      isActive: true,
    });
    if (!plan)
      return res.status(404).json({ message: 'Active benefit plan not found' });

    // Check enrollment window
    const now = new Date();
    if (plan.enrollmentStartDate && now < plan.enrollmentStartDate) {
      return res
        .status(400)
        .json({ message: 'Enrollment period has not started yet' });
    }
    if (plan.enrollmentEndDate && now > plan.enrollmentEndDate) {
      return res.status(400).json({ message: 'Enrollment period has ended' });
    }

    // Check max capacity
    if (plan.maxEnrollees) {
      const currentCount = await BenefitEnrollment.countDocuments({
        planId: plan._id,
        tenantId: req.tenantId,
        status: { $in: ['enrolled', 'pending'] },
      });
      if (currentCount >= plan.maxEnrollees) {
        return res
          .status(409)
          .json({ message: 'Benefit plan has reached maximum enrollees' });
      }
    }

    // Find employee record
    const employee = await Employee.findOne({
      createdBy: req.userId,
      tenantId: req.tenantId,
      });
    if (!employee)
      return res.status(404).json({ message: 'No employee record found' });

    // Check for existing enrollment
    const existingEnrollment = await BenefitEnrollment.findOne({
      employeeId: employee._id,
      planId: plan._id,
      tenantId: req.tenantId,
    });
    if (existingEnrollment && existingEnrollment.status !== 'cancelled') {
      return res
        .status(409)
        .json({ message: 'You are already enrolled in this plan' });
    }

    // Re-enroll if previously cancelled
    if (existingEnrollment && existingEnrollment.status === 'cancelled') {
      existingEnrollment.status = 'enrolled';
      existingEnrollment.enrolledAt = new Date();
      existingEnrollment.cancelledAt = undefined;
      existingEnrollment.cancellationReason = '';
      existingEnrollment.coverageType = coverageType || plan.coverageType;
      existingEnrollment.dependents = dependents || [];
      existingEnrollment.monthlyDeduction = plan.employeeContribution;
      await existingEnrollment.save();

      eventBus.emit('AUDIT_LOG', {
        userId: req.userId,
        action: 'BENEFIT_ENROLL',
        resourceType: 'BenefitEnrollment',
        resourceIds: [existingEnrollment._id],
        details: { planName: plan.name, coverageType },
        req,
      });

      return res
        .status(200)
        .json({
          message: 'Re-enrolled successfully',
          enrollment: existingEnrollment,
        });
    }

    const finalCoverage = coverageType || plan.coverageType;
    const deduction = plan.employeeContribution;

    const enrollment = await BenefitEnrollment.create({
      tenantId: req.tenantId,
      employeeId: employee._id,
      planId: plan._id,
      status: 'enrolled',
      enrolledAt: new Date(),
      coverageType: finalCoverage,
      dependents: dependents || [],
      monthlyDeduction: deduction,
      createdBy: req.userId,
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'BENEFIT_ENROLL',
      resourceType: 'BenefitEnrollment',
      resourceIds: [enrollment._id],
      details: {
        planName: plan.name,
        coverageType: finalCoverage,
        monthlyDeduction: deduction,
      },
      req,
    });

    logger.info('Benefit enrollment', {
      userId: req.userId,
      planName: plan.name,
    });
    return res
      .status(201)
      .json({ message: 'Enrolled successfully', enrollment });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Already enrolled in this plan' });
    }
    logger.error('Failed to enroll', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Employee: Cancel Enrollment ──────────────────────────────────────────

exports.cancelEnrollment = async (req, res, next) => {
  try {
    const { enrollmentId } = req.params;
    const { reason } = req.body;

    const enrollment = await BenefitEnrollment.findOne({
      _id: enrollmentId,
      tenantId: req.tenantId,
    });
    if (!enrollment)
      return res.status(404).json({ message: 'Enrollment not found' });

    if (
      enrollment.status === 'cancelled' ||
      enrollment.status === 'terminated'
    ) {
      return res
        .status(400)
        .json({ message: `Enrollment is already ${enrollment.status}` });
    }

    enrollment.status = 'cancelled';
    enrollment.cancelledAt = new Date();
    enrollment.cancellationReason = reason ? sanitizeText(reason) : '';
    await enrollment.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'BENEFIT_CANCEL',
      resourceType: 'BenefitEnrollment',
      resourceIds: [enrollment._id],
      details: { planId: enrollment.planId, reason },
      req,
    });

    logger.info('Benefit enrollment cancelled', {
      userId: req.userId,
      enrollmentId,
    });
    return res
      .status(200)
      .json({ message: 'Enrollment cancelled', enrollment });
  } catch (error) {
    logger.error('Failed to cancel enrollment', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Employee: My Enrollments ─────────────────────────────────────────────

exports.getMyEnrollments = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({
      createdBy: req.userId,
      tenantId: req.tenantId,
      });
    if (!employee) return res.status(200).json({ enrollments: [] });

    const enrollments = await BenefitEnrollment.find({
      employeeId: employee._id,
      tenantId: req.tenantId,
    })
      .populate('planId', 'name category provider coverageType monthlyPremium')
      .sort({ enrolledAt: -1 });

    return res.status(200).json({ enrollments });
  } catch (error) {
    logger.error('Failed to fetch enrollments', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Admin: All Enrollments Overview ──────────────────────────────────────

exports.getAllEnrollments = async (req, res, next) => {
  try {
    const { status, planId } = req.query;
    const filter = { tenantId: req.tenantId };
    if (status) filter.status = status;
    if (planId) filter.planId = planId;

    const enrollments = await BenefitEnrollment.find(filter)
      .populate('employeeId', 'fullName department role')
      .populate('planId', 'name category provider')
      .sort({ enrolledAt: -1 });

    return res.status(200).json({ enrollments });
  } catch (error) {
    logger.error('Failed to fetch all enrollments', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Admin: Enrollment Statistics ─────────────────────────────────────────

exports.getEnrollmentStats = async (req, res, next) => {
  try {
    const plans = await BenefitPlan.find({ tenantId: req.tenantId });
    const totalEmployees = await Employee.countDocuments({
      tenantId: req.tenantId,
      isActive: true,
    });

    const planStats = [];
    for (const plan of plans) {
      const enrolled = await BenefitEnrollment.countDocuments({
        planId: plan._id,
        tenantId: req.tenantId,
        status: { $in: ['enrolled', 'pending'] },
      });
      const totalDeductions = await BenefitEnrollment.aggregate([
        {
          $match: {
            planId: plan._id,
            tenantId: require('mongoose').Types.ObjectId.createFromHexString(
              req.tenantId,
            ),
            status: 'enrolled',
          },
        },
        { $group: { _id: null, total: { $sum: '$monthlyDeduction' } } },
      ]);

      planStats.push({
        planId: plan._id,
        planName: plan.name,
        category: plan.category,
        enrolled,
        maxEnrollees: plan.maxEnrollees || null,
        utilization: plan.maxEnrollees
          ? Math.round((enrolled / plan.maxEnrollees) * 100)
          : null,
        totalMonthlyDeductions: totalDeductions[0]?.total || 0,
      });
    }

    return res.status(200).json({ totalEmployees, plans: planStats });
  } catch (error) {
    logger.error('Failed to fetch enrollment stats', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Admin: Terminate Enrollment (HR action) ──────────────────────────────

exports.terminateEnrollment = async (req, res, next) => {
  try {
    const { enrollmentId } = req.params;
    const { reason } = req.body;

    const enrollment = await BenefitEnrollment.findOne({
      _id: enrollmentId,
      tenantId: req.tenantId,
    });
    if (!enrollment)
      return res.status(404).json({ message: 'Enrollment not found' });

    if (enrollment.status === 'terminated') {
      return res
        .status(400)
        .json({ message: 'Enrollment is already terminated' });
    }

    enrollment.status = 'terminated';
    enrollment.cancelledAt = new Date();
    enrollment.cancellationReason = reason
      ? sanitizeText(reason)
      : 'Terminated by HR';
    await enrollment.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'BENEFIT_TERMINATE',
      resourceType: 'BenefitEnrollment',
      resourceIds: [enrollment._id],
      details: { planId: enrollment.planId, reason },
      req,
    });

    logger.info('Benefit enrollment terminated', {
      userId: req.userId,
      enrollmentId,
    });
    return res
      .status(200)
      .json({ message: 'Enrollment terminated', enrollment });
  } catch (error) {
    logger.error('Failed to terminate enrollment', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};
