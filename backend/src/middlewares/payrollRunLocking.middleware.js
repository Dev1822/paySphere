'use strict';

const payrollRunLockingService = require('../services/PayrollRunLockingService');
const logger = require('../utils/logger');

/**
 * Middleware to prevent modification of data locked by active payroll run
 * Checks: attendance updates, leave updates, compensation updates, employee updates
 */
async function checkPayrollRunLocking(req, res, next) {
  try {
    const { payrollPeriodId } = req.body || req.query;

    if (!payrollPeriodId) {
      // No period specified, allow modification
      return next();
    }

    // Determine record type from route
    const recordType = getRecordTypeFromRoute(req.path);

    // Check if modification is allowed
    const modificationAllowed = await payrollRunLockingService.checkModificationAllowed(
      payrollPeriodId,
      recordType
    );

    if (!modificationAllowed.allowed) {
      logger.warn('Blocked modification on locked payroll data', {
        payrollRunId: modificationAllowed.payrollRunId,
        recordType,
        userId: req.userId,
      });

      return res.status(423).json({
        message: 'Cannot modify data during active payroll run',
        error: modificationAllowed.message,
        lockId: modificationAllowed.lockId,
        inputBoundary: modificationAllowed.inputBoundary,
        suggestion:
          'Changes will apply to the next payroll run after this one completes',
      });
    }

    next();
  } catch (error) {
    logger.error('checkPayrollRunLocking error', { error: error.message });
    // Fail open on error: allow modification
    next();
  }
}

/**
 * Extract record type from API route
 */
function getRecordTypeFromRoute(path) {
  if (path.includes('/attendance')) return 'attendance';
  if (path.includes('/leave')) return 'leave';
  if (path.includes('/compensation')) return 'compensation';
  if (path.includes('/employee')) return 'employee';
  return 'unknown';
}

module.exports = checkPayrollRunLocking;