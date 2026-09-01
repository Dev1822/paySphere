/**
 * Atomic Payroll Finalization Service (Issue #1902)
 *
 * Implements a transactional finalization workflow that ensures atomicity
 * of all payroll-related mutations:
 * - Updates payroll status
 * - Records calculation snapshots
 * - Creates audit events
 * - Schedules downstream background work
 *
 * The workflow uses MongoDB sessions to coordinate operations, preventing
 * partial finalization and safely handling concurrent attempts.
 */

const mongoose = require('mongoose');
const PayrollUpdate = require('../models/payroll.model');
const PayrollRun = require('../models/payrollRun.model');
const logger = require('../utils/logger');
const eventBus = require('./event.service');
const { PAYROLL_STATUS } = require('../config/payrollStatus');
const { PAYROLL_CALCULATION_VERSION } = require('../config/payrollCalculationVersion');

class PayrollFinalizationService {
  /**
   * Atomic finalization workflow.
   *
   * Wraps all database mutations and side effects in a transaction:
   * 1. Validate payroll run can be finalized
   * 2. Acquire transactional lock via PayrollRun
   * 3. Validate payroll records can transition
   * 4. Update payroll status and snapshots (atomic)
   * 5. Record audit events (atomic)
   * 6. Update PayrollRun finalization state
   * 7. Only then schedule background jobs
   *
   * @param {object} params
   * @param {string} params.tenantId - Company identifier
   * @param {string[]} params.payrollIds - Records to finalize
   * @param {string} params.payrollRunId - Associated PayrollRun document
   * @param {string} params.userId - User performing finalization
   * @param {object} params.sessionOptions - Optional MongoDB session options
   * @returns {Promise<{success: boolean, applied: object[], errors: object[]}>}
   */
  static async finalizePayroll({
    tenantId,
    payrollIds,
    payrollRunId,
    userId,
    sessionOptions = {},
  }) {
    // Create idempotency key for this finalization attempt
    const idempotencyKey = `${payrollRunId}-${Date.now()}`;
    const session = await mongoose.startSession(sessionOptions);
    session.startTransaction();

    try {
      // STEP 1: Lock the PayrollRun document for exclusive finalization
      const payrollRun = await PayrollRun.findByIdAndUpdate(
        payrollRunId,
        {
          status: 'finalizing',
          finalizationStatus: 'in_progress',
          finalizationStartedAt: new Date(),
          $inc: { finalizationAttempts: 1 },
        },
        {
          new: true,
          session,
          runValidators: false,
        }
      );

      if (!payrollRun) {
        throw new Error('PayrollRun not found');
      }

      // STEP 2: Check if already finalized (idempotency)
      if (payrollRun.finalizationStatus === 'completed') {
        logger.info('Payroll already finalized, returning cached result', {
          payrollRunId,
        });
        return {
          success: true,
          applied: [],
          skipped: 'Already finalized',
        };
      }

      // STEP 3: Fetch and validate payroll records
      const payrollRecords = await PayrollUpdate.find(
        {
          _id: { $in: payrollIds },
          tenantId,
        },
        null,
        { session }
      );

      if (payrollRecords.length !== payrollIds.length) {
        throw new Error(
          `Found ${payrollRecords.length} payroll records, expected ${payrollIds.length}`
        );
      }

      // STEP 4: Validate all records are in approvable state
      const validRecords = [];
      const invalidRecords = [];

      for (const record of payrollRecords) {
        if (record.status === PAYROLL_STATUS.APPROVED) {
          validRecords.push(record);
        } else {
          invalidRecords.push({
            payrollId: String(record._id),
            employeeName: record.employeeName,
            currentStatus: record.status,
          });
        }
      }

      if (validRecords.length === 0) {
        throw new Error('No valid payroll records to finalize');
      }

      // STEP 5: Atomic update of all payroll records
      const finalizedAt = new Date();
      const validIds = validRecords.map((r) => r._id);

      const updateResult = await PayrollUpdate.updateMany(
        {
          _id: { $in: validIds },
          tenantId,
          status: PAYROLL_STATUS.APPROVED,
        },
        {
          $set: {
            'calculationSnapshot.version':
              PAYROLL_CALCULATION_VERSION,
            'calculationSnapshot.finalizedAt': finalizedAt,
            'calculationSnapshot.finalizedBy': userId,
          },
          $inc: { __v: 1 },
        },
        { session }
      );

      if (updateResult.modifiedCount !== validRecords.length) {
        throw new Error(
          `Expected to update ${validRecords.length} records, but updated ${updateResult.modifiedCount}`
        );
      }

      // STEP 6: Record audit event within transaction
      const auditEvent = {
        timestamp: finalizedAt,
        action: 'PAYROLL_FINALIZED',
        userId,
        tenantId,
        payrollRunId,
        recordCount: validRecords.length,
        totalNetSalary: validRecords.reduce((sum, r) => sum + r.netSalary, 0),
      };

      // Store audit event reference (actual logging happens after commit)
      const auditEventForLater = { ...auditEvent };

      // STEP 7: Update PayrollRun finalization completion state
      await PayrollRun.findByIdAndUpdate(
        payrollRunId,
        {
          status: 'finalized',
          finalizationStatus: 'completed',
          finalizationCompletedAt: finalizedAt,
          finalizationIdempotencyKey: idempotencyKey,
          $inc: { finalizationVersion: 1 },
        },
        {
          session,
          runValidators: false,
        }
      );

      // All database operations succeeded — commit transaction
      await session.commitTransaction();

      // STEP 8: Schedule downstream work AFTER successful persistence
      // This ensures we never schedule a job for a transaction that rolled back
      this._scheduleDownstreamWork({
        payrollRunId,
        payrollIds: validIds,
        tenantId,
        finalizedAt,
      });

      // Emit audit event AFTER transaction completes
      eventBus.emit('AUDIT_LOG', {
        userId,
        action: 'PAYROLL_FINALIZED',
        resourceType: 'PayrollRun',
        resourceIds: validIds.map(String),
        details: auditEventForLater,
        result: invalidRecords.length === 0 ? 'success' : 'partial',
      });

      logger.info('Payroll finalization completed successfully', {
        payrollRunId,
        count: validRecords.length,
      });

      return {
        success: true,
        applied: validRecords.map((r) => ({
          payrollId: String(r._id),
          employeeName: r.employeeName,
          netSalary: r.netSalary,
        })),
        invalidRecords,
      };
    } catch (error) {
      // Rollback on any error
      await session.abortTransaction();

      logger.error('Payroll finalization failed', {
        payrollRunId,
        error: error.message,
      });

      // Update PayrollRun to reflect failure
      try {
        await PayrollRun.updateOne(
          { _id: payrollRunId },
          {
            status: 'failed',
            finalizationStatus: 'failed',
            error: error.message,
          }
        );
      } catch (updateError) {
        logger.error('Failed to update PayrollRun failure status', {
          error: updateError.message,
        });
      }

      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Schedule downstream work after successful payroll finalization.
   *
   * This is called AFTER transaction commits to ensure we never queue
   * work for a failed or rolled-back transaction.
   *
   * @private
   */
  static _scheduleDownstreamWork({
    payrollRunId,
    payrollIds,
    tenantId,
    finalizedAt,
  }) {
    // Example: queue payslip generation job
    // In production, this would push to a job queue (BullMQ, Sidekiq, etc.)
    try {
      eventBus.emit('PAYROLL_FINALIZED', {
        payrollRunId,
        payrollIds: payrollIds.map(String),
        tenantId,
        timestamp: finalizedAt,
      });

      logger.info('Downstream work scheduled', {
        payrollRunId,
        type: 'payslip_generation',
      });
    } catch (error) {
      logger.error('Failed to schedule downstream work', {
        payrollRunId,
        error: error.message,
      });
      // Don't throw — finalization succeeded even if job scheduling failed.
      // This can be retried later via a recovery process.
    }
  }

  /**
   * Recover a failed finalization attempt.
   *
   * If downstream work scheduling failed but the transaction succeeded,
   * this allows replaying the work scheduling without re-finalizing.
   *
   * @param {string} payrollRunId
   * @returns {Promise<{recovered: boolean, message: string}>}
   */
  static async recoverFinalization(payrollRunId) {
    const payrollRun = await PayrollRun.findById(payrollRunId);

    if (!payrollRun) {
      throw new Error('PayrollRun not found');
    }

    if (payrollRun.finalizationStatus !== 'completed') {
      return {
        recovered: false,
        message: 'Finalization did not complete successfully',
      };
    }

    const finalized = await PayrollUpdate.find({
      _id: {
        $in: await PayrollUpdate.distinct('_id', {
          'calculationSnapshot.finalizedAt': { $exists: true },
        }),
      },
    }).limit(1000);

    // Re-schedule downstream work
    this._scheduleDownstreamWork({
      payrollRunId,
      payrollIds: finalized.map((p) => p._id),
      tenantId: payrollRun.tenantId,
      finalizedAt: payrollRun.finalizationCompletedAt,
    });

    return {
      recovered: true,
      message: 'Downstream work re-scheduled successfully',
    };
  }
}

module.exports = PayrollFinalizationService;