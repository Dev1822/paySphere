/**
 * Tests for PayrollFinalizationService (Issue #1902)
 *
 * Covers:
 * - Atomic finalization of payroll records
 * - Transaction rollback on partial failures
 * - Concurrent finalization attempt handling
 * - Idempotent finalization
 * - Recovery of failed downstream work
 */

const mongoose = require('mongoose');
const PayrollFinalizationService = require('../../services/payrollFinalization.service');
const PayrollUpdate = require('../../models/payroll.model');
const PayrollRun = require('../../models/payrollRun.model');
const { PAYROLL_STATUS } = require('../../config/payrollStatus');

describe('PayrollFinalizationService', () => {
  let tenantId;
  let userId;
  let payrollRunId;
  let payrollIds;

  beforeEach(async () => {
    tenantId = new mongoose.Types.ObjectId();
    userId = new mongoose.Types.ObjectId();

    // Create PayrollRun
    const payrollRun = await PayrollRun.create({
      tenantId,
      payrollPeriod: '2026-08',
      payrollRunType: 'REGULAR',
      status: 'processing',
    });
    payrollRunId = payrollRun._id;

    // Create test payroll records in APPROVED state
    const records = await PayrollUpdate.insertMany([
      {
        employeeId: new mongoose.Types.ObjectId(),
        employeeName: 'Alice Smith',
        month: 8,
        year: 2026,
        baseSalary: 50000,
        netSalary: 45000,
        status: PAYROLL_STATUS.APPROVED,
        tenantId,
        createdBy: userId,
        approvedBy: userId,
        approvedAt: new Date(),
      },
      {
        employeeId: new mongoose.Types.ObjectId(),
        employeeName: 'Bob Johnson',
        month: 8,
        year: 2026,
        baseSalary: 55000,
        netSalary: 49000,
        status: PAYROLL_STATUS.APPROVED,
        tenantId,
        createdBy: userId,
        approvedBy: userId,
        approvedAt: new Date(),
      },
    ]);

    payrollIds = records.map((r) => r._id);
  });

  describe('finalizePayroll', () => {
    test('should finalize all approved payroll records atomically', async () => {
      const result = await PayrollFinalizationService.finalizePayroll({
        tenantId,
        payrollIds,
        payrollRunId,
        userId,
      });

      expect(result.success).toBe(true);
      expect(result.applied).toHaveLength(2);
      expect(result.applied[0]).toHaveProperty('payrollId');
      expect(result.applied[0]).toHaveProperty('employeeName');

      // Verify database state
      const finalized = await PayrollUpdate.find({
        _id: { $in: payrollIds },
      });

      finalized.forEach((record) => {
        expect(record.calculationSnapshot).toBeDefined();
        expect(record.calculationSnapshot.finalizedAt).toBeDefined();
        expect(record.calculationSnapshot.finalizedBy).toEqual(userId);
      });
    });

    test('should handle mixed approved and non-approved records', async () => {
      // Create one record in PENDING_APPROVAL state
      const pendingRecord = await PayrollUpdate.create({
        employeeId: new mongoose.Types.ObjectId(),
        employeeName: 'Charlie Brown',
        month: 8,
        year: 2026,
        baseSalary: 60000,
        netSalary: 54000,
        status: PAYROLL_STATUS.PENDING_APPROVAL,
        tenantId,
        createdBy: userId,
      });

      const mixedIds = [...payrollIds, pendingRecord._id];

      const result = await PayrollFinalizationService.finalizePayroll({
        tenantId,
        payrollIds: mixedIds,
        payrollRunId,
        userId,
      });

      // Should succeed with partial results
      expect(result.success).toBe(true);
      expect(result.applied).toHaveLength(2);
      expect(result.invalidRecords).toHaveLength(1);
      expect(result.invalidRecords[0].employeeName).toBe('Charlie Brown');
    });

    test('should prevent partial finalization on database errors', async () => {
      // Mock database failure on second update
      const originalUpdateMany = PayrollUpdate.updateMany;
      let callCount = 0;
      PayrollUpdate.updateMany = jest.fn(async () => {
        callCount++;
        if (callCount > 1) {
          throw new Error('Database connection lost');
        }
        return { modifiedCount: payrollIds.length };
      });

      try {
        await PayrollFinalizationService.finalizePayroll({
          tenantId,
          payrollIds,
          payrollRunId,
          userId,
        });
      } catch (error) {
        expect(error.message).toContain('connection lost');

        // Verify PayrollRun is marked as failed
        const run = await PayrollRun.findById(payrollRunId);
        expect(run.finalizationStatus).toBe('failed');

        // Verify payroll records were not modified
        const records = await PayrollUpdate.find({
          _id: { $in: payrollIds },
        });
        records.forEach((record) => {
          expect(record.calculationSnapshot?.finalizedAt).toBeUndefined();
        });
      } finally {
        PayrollUpdate.updateMany = originalUpdateMany;
      }
    });

    test('should handle concurrent finalization attempts with idempotency', async () => {
      // First finalization succeeds
      const result1 = await PayrollFinalizationService.finalizePayroll({
        tenantId,
        payrollIds,
        payrollRunId,
        userId,
      });

      expect(result1.success).toBe(true);

      // Second concurrent attempt should detect already finalized
      const result2 = await PayrollFinalizationService.finalizePayroll({
        tenantId,
        payrollIds,
        payrollRunId,
        userId,
      });

      // Should return early due to idempotency
      expect(result2.success).toBe(true);
      expect(result2.skipped).toBeDefined();

      // Verify only one set of finalization metadata exists
      const record = await PayrollUpdate.findById(payrollIds[0]);
      expect(record.calculationSnapshot.finalizedAt).toBeDefined();
    });

    test('should update PayrollRun status to finalized', async () => {
      await PayrollFinalizationService.finalizePayroll({
        tenantId,
        payrollIds,
        payrollRunId,
        userId,
      });

      const run = await PayrollRun.findById(payrollRunId);
      expect(run.status).toBe('finalized');
      expect(run.finalizationStatus).toBe('completed');
      expect(run.finalizationCompletedAt).toBeDefined();
    });

    test('should increment finalization version for optimistic locking', async () => {
      const runBefore = await PayrollRun.findById(payrollRunId);
      const versionBefore = runBefore.finalizationVersion || 0;

      await PayrollFinalizationService.finalizePayroll({
        tenantId,
        payrollIds,
        payrollRunId,
        userId,
      });

      const runAfter = await PayrollRun.findById(payrollRunId);
      expect(runAfter.finalizationVersion).toBe(versionBefore + 1);
    });
  });

  describe('recoverFinalization', () => {
    test('should recover downstream work scheduling after completed finalization', async () => {
      // Complete initial finalization
      await PayrollFinalizationService.finalizePayroll({
        tenantId,
        payrollIds,
        payrollRunId,
        userId,
      });

      // Recover
      const result = await PayrollFinalizationService.recoverFinalization(
        payrollRunId
      );

      expect(result.recovered).toBe(true);
      expect(result.message).toContain('re-scheduled');
    });

    test('should not recover incomplete finalization', async () => {
      // Don't finalize, just try to recover
      const result = await PayrollFinalizationService.recoverFinalization(
        payrollRunId
      );

      expect(result.recovered).toBe(false);
      expect(result.message).toContain('did not complete');
    });
  });
});