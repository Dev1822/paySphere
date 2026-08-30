/**
 * @fileoverview Overtime & Rest-Day Multiplier Controller
 * @description Manages overtime calculations, holiday shift compensations,
 * and monthly employee overtime summaries.
 * Issue: #1762
 */

const {
  computeHourlyOrdinaryWage,
  calculateOvertimePay,
  aggregateMonthlyOvertime,
} = require('../utils/overtimeMultiplierEngine.utils');
const Employee = require('../models/employee.model');
const logger = require('../utils/logger');

// In-memory or database-backed overtime shift records
const recordedOvertimeLogs = [];
const employeeCoffBalances = new Map();

/**
 * POST /api/overtime-calculator/calculate-ot
 * Calculates overtime wages from punch hours and wage details.
 */
async function calculateOt(req, res, next) {
  try {
    const {
      employeeId,
      basicPay,
      dearnessAllowance = 0,
      standardOtHours = 0,
      doubleOtHours = 0,
      holidayShiftHours = 0,
      optForHolidayWage = true,
    } = req.body;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'employeeId is required',
      });
    }

    let employee = null;
    try {
      employee = await Employee.findById(employeeId);
    } catch {
      // Mock fallback
    }

    const basic = basicPay !== undefined ? Number(basicPay) : (employee?.salaryDetails?.basic || 52000);
    const da = dearnessAllowance !== undefined ? Number(dearnessAllowance) : (employee?.salaryDetails?.da || 0);

    const hourlyRate = computeHourlyOrdinaryWage(basic, da, 26, 8);
    const calculation = calculateOvertimePay(
      hourlyRate,
      Number(standardOtHours),
      Number(doubleOtHours),
      Number(holidayShiftHours),
      Boolean(optForHolidayWage),
    );

    const logRecord = {
      logId: `OT-LOG-${Date.now()}`,
      employeeId: String(employeeId),
      loggedAt: new Date().toISOString(),
      basic,
      da,
      ...calculation,
    };

    recordedOvertimeLogs.push(logRecord);

    if (calculation.coffEarnedDays > 0) {
      const current = employeeCoffBalances.get(String(employeeId)) || 0;
      employeeCoffBalances.set(String(employeeId), current + calculation.coffEarnedDays);
    }

    return res.status(200).json({
      success: true,
      data: logRecord,
    });
  } catch (error) {
    logger.error('Error calculating overtime:', error);
    return next(error);
  }
}

/**
 * POST /api/overtime-calculator/claim-c-off
 * Redeems earned Compensatory Off days.
 */
async function claimCoff(req, res, next) {
  try {
    const { employeeId, daysToRedeem = 1 } = req.body;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'employeeId is required',
      });
    }

    const current = employeeCoffBalances.get(String(employeeId)) || 0;
    const requested = Math.max(0.5, Number(daysToRedeem) || 1);

    if (current < requested) {
      return res.status(400).json({
        success: false,
        message: `Insufficient C-OFF balance. Available: ${current} days, Requested: ${requested} days`,
      });
    }

    const newBalance = current - requested;
    employeeCoffBalances.set(String(employeeId), newBalance);

    return res.status(200).json({
      success: true,
      message: `Successfully redeemed ${requested} C-OFF days`,
      data: {
        employeeId,
        redeemedDays: requested,
        remainingCoffBalance: newBalance,
      },
    });
  } catch (error) {
    logger.error('Error claiming C-OFF:', error);
    return next(error);
  }
}

/**
 * GET /api/overtime-calculator/summary/:employeeId
 * Fetches employee overtime earnings and C-OFF balances.
 */
async function getEmployeeOtSummary(req, res, next) {
  try {
    const { employeeId } = req.params;
    const logs = recordedOvertimeLogs.filter((l) => String(l.employeeId) === String(employeeId));
    const coffBalance = employeeCoffBalances.get(String(employeeId)) || 0;

    const totalOtEarnings = logs.reduce((sum, l) => sum + l.totalOtEarnings, 0);

    return res.status(200).json({
      success: true,
      data: {
        employeeId,
        totalLogs: logs.length,
        totalOtEarnings: Math.round(totalOtEarnings * 100) / 100,
        availableCoffBalance: coffBalance,
        recentLogs: logs.slice(-5),
      },
    });
  } catch (error) {
    logger.error('Error fetching employee OT summary:', error);
    return next(error);
  }
}

module.exports = {
  calculateOt,
  claimCoff,
  getEmployeeOtSummary,
  recordedOvertimeLogs,
  employeeCoffBalances,
};
