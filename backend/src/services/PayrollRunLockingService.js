'use strict';

const logger = require('../utils/logger');
const PayrollRunLock = require('../models/payrollRunLock.model');

/**
 * PayrollRunLockingService
 * Manages input data locking during payroll run processing.
 * Prevents concurrent modifications to employee, attendance, leave, compensation data.
 */
class PayrollRunLockingService {
  /**
   * Acquire lock for a payroll run
   * Locks: employee records, attendance records, leave records, compensation data
   * @param {string} payrollRunId - ID of payroll run
   * @param {string} payrollPeriodId - Payroll period identifier
   * @param {Array<string>} employeeIds - Employee IDs in this run
   * @param {string} userId - User initiating the lock
   * @returns {Promise<Object>} Lock record with boundary timestamp
   */
  async acquireLock(payrollRunId, payrollPeriodId, employeeIds, userId) {
    try {
      // Check if another run is already processing this payroll period
      const existingLock = await PayrollRunLock.findOne({
        payrollPeriodId,
        status: 'active',
      });

      if (existingLock) {
        return {
          success: false,
          error: 'Another payroll run is already processing this period',
          lockId: existingLock._id,
          acquiredBy: existingLock.acquiredBy,
          acquiredAt: existingLock.acquiredAt,
        };
      }

      // Create lock record with input boundary
      const lockRecord = await PayrollRunLock.create({
        payrollRunId,
        payrollPeriodId,
        employeeIds,
        status: 'active',
        acquiredBy: userId,
        acquiredAt: new Date(),
        inputBoundary: new Date(), // Mark boundary for data capture
        lockedRecords: {
          employees: employeeIds.length,
          attendance: 0, // Will be updated after capture
          leave: 0,
          compensation: 0,
        },
      });

      logger.info('Payroll run lock acquired', {
        lockId: lockRecord._id,
        payrollRunId,
        employeeCount: employeeIds.length,
      });

      return {
        success: true,
        lockId: lockRecord._id,
        inputBoundary: lockRecord.inputBoundary,
        message: 'Lock acquired successfully',
      };
    } catch (error) {
      logger.error('acquireLock error', { error: error.message });
      throw error;
    }
  }

  /**
   * Release lock after payroll processing completes
   * @param {string} lockId - Lock record ID
   * @param {string} userId - User releasing lock
   * @param {Object} metadata - Final processing metadata
   * @returns {Promise<Object>} Released lock status
   */
  async releaseLock(lockId, userId, metadata = {}) {
    try {
      const lockRecord = await PayrollRunLock.findByIdAndUpdate(
        lockId,
        {
          status: 'released',
          releasedBy: userId,
          releasedAt: new Date(),
          processingMetadata: metadata,
        },
        { new: true }
      );

      if (!lockRecord) {
        return {
          success: false,
          error: 'Lock record not found',
        };
      }

      logger.info('Payroll run lock released', {
        lockId,
        processingTime: lockRecord.releasedAt - lockRecord.acquiredAt,
      });

      return {
        success: true,
        lockId,
        processingTime: lockRecord.releasedAt - lockRecord.acquiredAt,
      };
    } catch (error) {
      logger.error('releaseLock error', { error: error.message });
      throw error;
    }
  }

  /**
   * Force release lock on failure
   * Called if payroll processing crashes or is cancelled
   * @param {string} lockId - Lock record ID
   * @param {string} failureReason - Reason for failure
   * @returns {Promise<Object>} Released lock status
   */
  async forceReleaseLock(lockId, failureReason) {
    try {
      const lockRecord = await PayrollRunLock.findByIdAndUpdate(
        lockId,
        {
          status: 'force_released',
          forcedReleaseReason: failureReason,
          forcedReleaseAt: new Date(),
        },
        { new: true }
      );

      logger.warn('Payroll run lock force released', {
        lockId,
        reason: failureReason,
      });

      return {
        success: true,
        lockId,
        forcedRelease: true,
      };
    } catch (error) {
      logger.error('forceReleaseLock error', { error: error.message });
      throw error;
    }
  }

  /**
   * Check if lock is still active
   * @param {string} lockId - Lock record ID
   * @returns {Promise<boolean>} True if lock is active
   */
  async isLockActive(lockId) {
    try {
      const lockRecord = await PayrollRunLock.findById(lockId).lean();
      return lockRecord && lockRecord.status === 'active';
    } catch (error) {
      logger.error('isLockActive error', { error: error.message });
      return false;
    }
  }

  /**
   * Get active lock for payroll period
   * @param {string} payrollPeriodId - Payroll period ID
   * @returns {Promise<Object|null>} Active lock or null
   */
  async getActiveLock(payrollPeriodId) {
    try {
      return await PayrollRunLock.findOne({
        payrollPeriodId,
        status: 'active',
      }).lean();
    } catch (error) {
      logger.error('getActiveLock error', { error: error.message });
      return null;
    }
  }

  /**
   * Prevent modification of locked records
   * Called as middleware check before updates
   * @param {string} payrollPeriodId - Payroll period ID
   * @param {string} recordType - Type of record (employee, attendance, leave, compensation)
   * @returns {Promise<Object>} { allowed: boolean, lockId?: string, message?: string }
   */
  async checkModificationAllowed(payrollPeriodId, recordType) {
    try {
      const activeLock = await this.getActiveLock(payrollPeriodId);

      if (!activeLock) {
        return { allowed: true };
      }

      // Lock is active - modification not allowed
      return {
        allowed: false,
        lockId: activeLock._id,
        message: `Cannot modify ${recordType} during active payroll run`,
        payrollRunId: activeLock.payrollRunId,
        inputBoundary: activeLock.inputBoundary,
      };
    } catch (error) {
      logger.error('checkModificationAllowed error', { error: error.message });
      // Fail open: allow modification if check fails
      return { allowed: true };
    }
  }

  /**
   * Record that a record type was locked
   * Updates lock metadata with count of locked records
   * @param {string} lockId - Lock record ID
   * @param {string} recordType - Type (attendance, leave, compensation)
   * @param {number} count - Number of records locked
   */
  async updateLockedRecordCount(lockId, recordType, count) {
    try {
      const updateField = `lockedRecords.${recordType}`;
      await PayrollRunLock.findByIdAndUpdate(lockId, {
        [updateField]: count,
      });
    } catch (error) {
      logger.error('updateLockedRecordCount error', { error: error.message });
    }
  }

  /**
   * Get lock history for a payroll run
   * @param {string} payrollRunId - Payroll run ID
   * @returns {Promise<Array>} Lock history
   */
  async getLockHistory(payrollRunId) {
    try {
      return await PayrollRunLock.find({
        payrollRunId,
      })
        .populate('acquiredBy releasedBy', 'fullName email')
        .sort('-acquiredAt')
        .lean();
    } catch (error) {
      logger.error('getLockHistory error', { error: error.message });
      return [];
    }
  }
}

module.exports = new PayrollRunLockingService();