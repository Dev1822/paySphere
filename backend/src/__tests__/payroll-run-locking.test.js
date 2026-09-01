'use strict';

const payrollRunLockingService = require('../services/PayrollRunLockingService');
const PayrollRunLock = require('../models/payrollRunLock.model');

describe('PayrollRunLocking', () => {
  describe('Lock Acquisition', () => {
    test('should acquire lock for payroll run', async () => {
      const payrollRunId = 'run-123';
      const payrollPeriodId = 'period-456';
      const employeeIds = ['emp-1', 'emp-2', 'emp-3'];
      const userId = 'user-789';

      const result = await payrollRunLockingService.acquireLock(
        payrollRunId,
        payrollPeriodId,
        employeeIds,
        userId
      );

      expect(result.success).toBe(true);
      expect(result.lockId).toBeDefined();
      expect(result.inputBoundary).toBeDefined();
    });

    test('should prevent duplicate lock acquisition', async () => {
      const payrollRunId = 'run-123';
      const payrollPeriodId = 'period-456';
      const employeeIds = ['emp-1'];
      const userId = 'user-789';

      // First lock should succeed
      const result1 = await payrollRunLockingService.acquireLock(
        payrollRunId,
        payrollPeriodId,
        employeeIds,
        userId
      );
      expect(result1.success).toBe(true);

      // Second lock on same period should fail
      const result2 = await payrollRunLockingService.acquireLock(
        'run-different',
        payrollPeriodId,
        employeeIds,
        userId
      );
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('already processing');
    });
  });

  describe('Lock Release', () => {
    test('should release lock after processing completes', async () => {
      const lockId = 'lock-123';
      const userId = 'user-789';
      const metadata = { totalRecordsProcessed: 100 };

      const result = await payrollRunLockingService.releaseLock(
        lockId,
        userId,
        metadata
      );

      expect(result.success).toBe(true);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    test('should force release lock on failure', async () => {
      const lockId = 'lock-123';
      const failureReason = 'Calculation timeout';

      const result = await payrollRunLockingService.forceReleaseLock(
        lockId,
        failureReason
      );

      expect(result.success).toBe(true);
      expect(result.forcedRelease).toBe(true);
    });

    test('should return error for non-existent lock', async () => {
      const lockId = 'non-existent-123';
      const userId = 'user-789';

      const result = await payrollRunLockingService.releaseLock(lockId, userId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('Concurrent Run Prevention', () => {
    test('should detect active lock for payroll period', async () => {
      const payrollPeriodId = 'period-789';

      // Create active lock
      await PayrollRunLock.create({
        payrollRunId: 'run-123',
        payrollPeriodId,
        employeeIds: ['emp-1'],
        status: 'active',
        acquiredBy: 'user-123',
        inputBoundary: new Date(),
      });

      const activeLock = await payrollRunLockingService.getActiveLock(
        payrollPeriodId
      );

      expect(activeLock).toBeDefined();
      expect(activeLock.status).toBe('active');
    });

    test('should return null for unlocked period', async () => {
      const payrollPeriodId = 'period-no-lock';

      const activeLock = await payrollRunLockingService.getActiveLock(
        payrollPeriodId
      );

      expect(activeLock).toBeNull();
    });

    test('should check lock status correctly', async () => {
      const lockId = 'lock-456';

      // Create active lock
      const lock = await PayrollRunLock.create({
        _id: lockId,
        payrollRunId: 'run-456',
        payrollPeriodId: 'period-456',
        employeeIds: ['emp-1'],
        status: 'active',
        acquiredBy: 'user-456',
        inputBoundary: new Date(),
      });

      const isActive = await payrollRunLockingService.isLockActive(lock._id);
      expect(isActive).toBe(true);
    });
  });

  describe('Modification Blocking', () => {
    test('should block attendance modification during active lock', async () => {
      const payrollPeriodId = 'period-modify';

      // Create active lock
      await PayrollRunLock.create({
        payrollRunId: 'run-modify',
        payrollPeriodId,
        employeeIds: ['emp-1'],
        status: 'active',
        acquiredBy: 'user-789',
        inputBoundary: new Date(),
      });

      const result = await payrollRunLockingService.checkModificationAllowed(
        payrollPeriodId,
        'attendance'
      );

      expect(result.allowed).toBe(false);
      expect(result.message).toContain('Cannot modify');
    });

    test('should allow modification after lock release', async () => {
      const payrollPeriodId = 'period-released';

      // Create and immediately release lock
      const lock = await PayrollRunLock.create({
        payrollRunId: 'run-released',
        payrollPeriodId,
        employeeIds: ['emp-1'],
        status: 'released',
        acquiredBy: 'user-789',
        releasedBy: 'user-789',
        releasedAt: new Date(),
        inputBoundary: new Date(),
      });

      const result = await payrollRunLockingService.checkModificationAllowed(
        payrollPeriodId,
        'attendance'
      );

      expect(result.allowed).toBe(true);
    });

    test('should block leave modification during lock', async () => {
      const payrollPeriodId = 'period-leave';

      await PayrollRunLock.create({
        payrollRunId: 'run-leave',
        payrollPeriodId,
        employeeIds: ['emp-1'],
        status: 'active',
        acquiredBy: 'user-789',
        inputBoundary: new Date(),
      });

      const result = await payrollRunLockingService.checkModificationAllowed(
        payrollPeriodId,
        'leave'
      );

      expect(result.allowed).toBe(false);
    });

    test('should block compensation modification during lock', async () => {
      const payrollPeriodId = 'period-comp';

      await PayrollRunLock.create({
        payrollRunId: 'run-comp',
        payrollPeriodId,
        employeeIds: ['emp-1'],
        status: 'active',
        acquiredBy: 'user-789',
        inputBoundary: new Date(),
      });

      const result = await payrollRunLockingService.checkModificationAllowed(
        payrollPeriodId,
        'compensation'
      );

      expect(result.allowed).toBe(false);
    });
  });

  describe('Lock Metadata', () => {
    test('should update locked record counts', async () => {
      const lock = await PayrollRunLock.create({
        payrollRunId: 'run-meta',
        payrollPeriodId: 'period-meta',
        employeeIds: ['emp-1', 'emp-2'],
        status: 'active',
        acquiredBy: 'user-789',
        inputBoundary: new Date(),
      });

      await payrollRunLockingService.updateLockedRecordCount(
        lock._id,
        'attendance',
        150
      );

      await payrollRunLockingService.updateLockedRecordCount(lock._id, 'leave', 45);

      const updated = await PayrollRunLock.findById(lock._id);

      expect(updated.lockedRecords.attendance).toBe(150);
      expect(updated.lockedRecords.leave).toBe(45);
    });

    test('should calculate processing duration', async () => {
      const now = new Date();
      const lock = await PayrollRunLock.create({
        payrollRunId: 'run-duration',
        payrollPeriodId: 'period-duration',
        employeeIds: ['emp-1'],
        status: 'released',
        acquiredBy: 'user-789',
        acquiredAt: new Date(now.getTime() - 10000), // 10 seconds ago
        releasedAt: now,
        inputBoundary: new Date(),
      });

      const duration = lock.getProcessingDuration();

      expect(duration).toBeCloseTo(10000, -2);
    });
  });

  describe('Lock History', () => {
    test('should retrieve lock history for payroll run', async () => {
      const payrollRunId = 'run-history';

      // Create multiple locks for same run (simulating retries)
      await PayrollRunLock.create({
        payrollRunId,
        payrollPeriodId: 'period-1',
        employeeIds: ['emp-1'],
        status: 'released',
        acquiredBy: 'user-789',
        inputBoundary: new Date(),
      });

      const history = await payrollRunLockingService.getLockHistory(payrollRunId);

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].payrollRunId).toBe(payrollRunId);
    });
  });

  describe('Input Boundary Definition', () => {
    test('should mark input boundary at lock time', async () => {
      const beforeLock = new Date();
      const result = await payrollRunLockingService.acquireLock(
        'run-boundary',
        'period-boundary',
        ['emp-1'],
        'user-789'
      );
      const afterLock = new Date();

      expect(result.inputBoundary).toBeDefined();
      expect(result.inputBoundary.getTime()).toBeGreaterThanOrEqual(
        beforeLock.getTime()
      );
      expect(result.inputBoundary.getTime()).toBeLessThanOrEqual(
        afterLock.getTime()
      );
    });

    test('should ensure all data before boundary is included', async () => {
      const lock = await PayrollRunLock.create({
        payrollRunId: 'run-data',
        payrollPeriodId: 'period-data',
        employeeIds: ['emp-1'],
        status: 'active',
        acquiredBy: 'user-789',
        inputBoundary: new Date(),
      });

      // Data created before boundary should be included
      expect(lock.inputBoundary).toBeLessThanOrEqual(new Date());
    });
  });

  describe('Safe Failure Handling', () => {
    test('should safely release locks on processing crash', async () => {
      const lock = await PayrollRunLock.create({
        payrollRunId: 'run-crash',
        payrollPeriodId: 'period-crash',
        employeeIds: ['emp-1'],
        status: 'active',
        acquiredBy: 'user-789',
        inputBoundary: new Date(),
      });

      const result = await payrollRunLockingService.forceReleaseLock(
        lock._id,
        'Calculation process crashed'
      );

      expect(result.success).toBe(true);

      const updatedLock = await PayrollRunLock.findById(lock._id);
      expect(updatedLock.status).toBe('force_released');
      expect(updatedLock.forcedReleaseReason).toContain('crashed');
    });

    test('should allow new lock after force release', async () => {
      const payrollPeriodId = 'period-recovery';

      // Create and force release lock
      const lock1 = await PayrollRunLock.create({
        payrollRunId: 'run-recovery-1',
        payrollPeriodId,
        employeeIds: ['emp-1'],
        status: 'active',
        acquiredBy: 'user-789',
        inputBoundary: new Date(),
      });

      await payrollRunLockingService.forceReleaseLock(
        lock1._id,
        'Test failure'
      );

      // Should be able to acquire new lock now
      const result = await payrollRunLockingService.acquireLock(
        'run-recovery-2',
        payrollPeriodId,
        ['emp-1'],
        'user-789'
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle concurrent lock attempts gracefully', async () => {
      const payrollPeriodId = 'period-concurrent';
      const employeeIds = ['emp-1', 'emp-2'];

      // Simulate concurrent lock attempts
      const promise1 = payrollRunLockingService.acquireLock(
        'run-concurrent-1',
        payrollPeriodId,
        employeeIds,
        'user-1'
      );

      const promise2 = payrollRunLockingService.acquireLock(
        'run-concurrent-2',
        payrollPeriodId,
        employeeIds,
        'user-2'
      );

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // One should succeed, one should fail
      const successCount = [result1, result2].filter(r => r.success).length;
      expect(successCount).toBe(1);
    });

    test('should handle large employee count locks', async () => {
      const employeeIds = Array.from({ length: 1000 }, (_, i) => `emp-${i}`);

      const result = await payrollRunLockingService.acquireLock(
        'run-large',
        'period-large',
        employeeIds,
        'user-789'
      );

      expect(result.success).toBe(true);
      expect(result.lockId).toBeDefined();
    });
  });
});