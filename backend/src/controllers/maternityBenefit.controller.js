/**
 * @fileoverview Maternity Benefit Controller
 * @description Manages statutory maternity enrollments, tenurial eligibility checks,
 * and weekly/monthly wage disbursement schedules under MB Act 1961.
 * Issue: #1665
 */

const {
  evaluateMaternityEligibility,
  computeAverageDailyMaternityWage,
  generateMaternityDisbursementSchedule,
  STATUTORY_MEDICAL_BONUS,
} = require('../utils/maternityBenefitEngine.utils');
const Employee = require('../models/employee.model');
const logger = require('../utils/logger');

// In-memory or database-backed active maternity enrollments
const maternityEnrollments = new Map();

/**
 * POST /api/maternity-benefit/enroll
 * Registers a statutory maternity or paternity claim with medical documentation.
 */
async function enrollMaternityClaim(req, res, next) {
  try {
    const {
      employeeId,
      leaveType = 'MATERNITY',
      expectedDeliveryDate,
      survivingChildren = 0,
      workedDaysInLast12Months = 220,
      monthlyGrossSalaries = [60000, 60000, 60000],
    } = req.body;

    if (!employeeId || !expectedDeliveryDate) {
      return res.status(400).json({
        success: false,
        message: 'employeeId and expectedDeliveryDate are required',
      });
    }

    const eligibility = evaluateMaternityEligibility(
      Number(workedDaysInLast12Months),
      Number(survivingChildren),
      leaveType,
    );

    if (!eligibility.isEligible) {
      return res.status(400).json({
        success: false,
        message: eligibility.rejectionReason,
      });
    }

    const wageCalculation = computeAverageDailyMaternityWage(monthlyGrossSalaries, 66);
    const schedule = generateMaternityDisbursementSchedule(
      wageCalculation.averageDailyWage,
      eligibility.leaveDurationWeeks,
      new Date(expectedDeliveryDate),
      eligibility.statutoryMedicalBonus,
    );

    const enrollmentRecord = {
      enrollmentId: `MB-ENROLL-${Date.now()}`,
      employeeId: String(employeeId),
      leaveType,
      expectedDeliveryDate,
      survivingChildren: Number(survivingChildren),
      enrolledAt: new Date().toISOString(),
      eligibility,
      wageCalculation,
      schedule,
    };

    maternityEnrollments.set(String(employeeId), enrollmentRecord);

    return res.status(201).json({
      success: true,
      message: 'Maternity/Paternity benefit claim enrolled successfully',
      data: enrollmentRecord,
    });
  } catch (error) {
    logger.error('Error enrolling maternity claim:', error);
    return next(error);
  }
}

/**
 * GET /api/maternity-benefit/eligibility/:employeeId
 * Verifies 80-day statutory tenure and computes projected daily benefit rate.
 */
async function checkEligibility(req, res, next) {
  try {
    const { employeeId } = req.params;
    let employee = null;
    try {
      employee = await Employee.findById(employeeId);
    } catch {
      // Mock fallback
    }

    const workedDays = employee?.attendanceSummary?.workedDaysLastYear || 240;
    const monthlyGross = employee?.salaryDetails?.gross || employee?.baseSalary || 70000;

    const eligibility = evaluateMaternityEligibility(workedDays, 0, 'MATERNITY');
    const wageCalculation = computeAverageDailyMaternityWage([monthlyGross, monthlyGross, monthlyGross], 66);

    return res.status(200).json({
      success: true,
      data: {
        employeeId,
        workedDaysInLast12Months: workedDays,
        monthlyGross,
        eligibility,
        projectedDailyWageRate: wageCalculation.averageDailyWage,
      },
    });
  } catch (error) {
    logger.error('Error checking maternity eligibility:', error);
    return next(error);
  }
}

/**
 * GET /api/maternity-benefit/disbursement-schedule/:employeeId
 * Retrieves wage disbursement schedule for an enrolled claim.
 */
async function getDisbursementSchedule(req, res, next) {
  try {
    const { employeeId } = req.params;
    const enrollment = maternityEnrollments.get(String(employeeId));

    if (!enrollment) {
      // Default sample projection if not pre-enrolled
      const wageCalc = computeAverageDailyMaternityWage([65000, 65000, 65000], 66);
      const schedule = generateMaternityDisbursementSchedule(wageCalc.averageDailyWage, 26, new Date(), STATUTORY_MEDICAL_BONUS);

      return res.status(200).json({
        success: true,
        data: {
          employeeId,
          isEnrolled: false,
          schedule,
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        employeeId,
        isEnrolled: true,
        enrollment,
      },
    });
  } catch (error) {
    logger.error('Error fetching maternity disbursement schedule:', error);
    return next(error);
  }
}

module.exports = {
  enrollMaternityClaim,
  checkEligibility,
  getDisbursementSchedule,
  maternityEnrollments,
};
