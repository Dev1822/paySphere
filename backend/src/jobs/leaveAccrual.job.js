/**
 * @fileoverview Monthly Leave Accrual Cron Job
 * @description Runs on the 1st of every month. Processes leave accruals for all
 * active employees, handling pro-ration and idempotency via the CronLock model
 * to prevent double-accrual on restarts.
 *
 * Issues: #646, #796.
 *
 * ---
 *
 * As written in #646 this job had never run, and could not have been safe if it
 * had (#796):
 *
 *   - Nothing called `processMonthlyAccrual`. The file header says "Runs on the
 *     1st of every month at 00:00 UTC" and there was no `cron.schedule` for it
 *     anywhere in the tree, so `LeaveBalance` was never written and every
 *     balance in the product read 0. It is registered in `startCronJobs` now,
 *     alongside the payslip and greetings jobs.
 *
 *   - The idempotency guard could not fire. It wrote `status: 'processing'` to a
 *     CronLock schema with no `status` field, so mongoose dropped it and
 *     `lock.status === 'completed'` compared against `undefined` on every run.
 *     Two runs in the same month — a restart, a redeploy, a second instance —
 *     accrued everyone twice.
 *
 *   - The lock never expired. `findOneAndUpdate(..., { upsert: true })` does not
 *     run validators by default, so the required `expiresAt` was simply absent
 *     and the TTL index ignores documents that lack the field.
 *
 *   - `findOneAndUpdate(upsert)` cannot tell the winner from the loser: both
 *     racing instances get a document back and both proceed. `create()` and a
 *     duplicate-key catch can, which is what `jobs/cron.jobs.js` already does.
 *     This job reimplemented the pattern instead of calling it.
 */

const Employee = require('../models/employee.model');
const LeavePolicy = require('../models/leavePolicy.model');
const LeaveBalance = require('../models/leaveBalance.model');
const CronLock = require('../models/cronlock.model');
const { calculateProRatedAccrual } = require('../utils/leaveAccrual');
const logger = require('../utils/logger');

const { LOCK_STATUS } = CronLock;

/**
 * How long a lock is honoured before it is assumed abandoned.
 *
 * Longer than the payslip job's 24 hours because a completed accrual lock is
 * doing a second job: it is the record that says "this period has already been
 * credited". It has to outlive the run, and outlive a redeploy on the same day,
 * without outliving the month.
 */
const LOCK_TTL_MS = 45 * 24 * 60 * 60 * 1000;

/**
 * Take the lock for one period.
 *
 * Three outcomes, and the caller needs to tell them apart:
 *
 *   - `acquired`  — this process owns the run
 *   - `completed` — a previous run already credited this period; skip
 *   - `held`      — someone else is mid-run, or a previous run failed and its
 *                   lock is still there to be retried
 *
 * The insert is what decides. A second caller loses on the `_id` unique index
 * (E11000) rather than on a comparison, so there is no window in which two
 * processes both believe they won.
 *
 * @param {string} lockId
 * @returns {Promise<{acquired: boolean, reason?: string}>}
 */
async function processMonthlyAccrual(tenantId) {
  QueryValidatorService.validateBackgroundJobContext({ tenantId });
  
  // Set tenant context for all operations within this job
  TenantContextService.setTenantContext(tenantId, 'system-job', {
    jobName: 'processMonthlyAccrual',
  });
  
  try {
    const employees = await Employee.find({ tenantId });
    // ... rest of processing ...
  } finally {
    TenantContextService.clearTenantContext();
  }
}
async function acquireAccrualLock(lockId) {
  try {
    await CronLock.create({
      _id: lockId,
      lockedAt: new Date(),
      expiresAt: new Date(Date.now() + LOCK_TTL_MS),
      status: LOCK_STATUS.PROCESSING,
    });

    return { acquired: true };
  } catch (error) {
    if (error.code !== 11000) {
      logger.error('Failed to acquire the leave accrual lock', {
        lockId,
        error: error.message,
      });
      return { acquired: false, reason: 'error' };
    }

    // Somebody got there first. Whether we skip or retry depends on how their
    // run ended, which is exactly what the `status` field #796 added is for.
    const existing = await CronLock.findById(lockId).lean();

    if (existing && existing.status === LOCK_STATUS.COMPLETED) {
      return { acquired: false, reason: 'completed' };
    }

    return { acquired: false, reason: 'held' };
  }
}

/**
 * Processes the monthly leave accrual for all active employees.
 *
 * @param {object} [options]
 * @param {Date} [options.now] the moment the job is treated as having fired
 * @returns {Promise<{ran: boolean, reason?: string, month: number, year: number, tenants: number, employees: number, accrued: number, failed: number}>}
 */
async function processMonthlyAccrual({ now = new Date() } = {}) {
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const lockKey = `leave-accrual-${currentYear}-${currentMonth}`;

  const result = {
    ran: false,
    month: currentMonth,
    year: currentYear,
    tenants: 0,
    employees: 0,
    accrued: 0,
    failed: 0,
  };

  const lock = await acquireAccrualLock(lockKey);

  if (!lock.acquired) {
    logger.info(
      `Leave accrual for ${currentMonth}/${currentYear} skipped: ${lock.reason}`,
      { lockKey },
    );
    return { ...result, reason: lock.reason };
  }

  try {
    logger.info(
      `Starting monthly leave accrual for ${currentMonth}/${currentYear}`,
    );

    const policies = await LeavePolicy.find({ isActive: true }).lean();

    if (policies.length === 0) {
      logger.info('No active leave policies found.');
      await CronLock.updateOne(
        { _id: lockKey },
        { $set: { status: LOCK_STATUS.COMPLETED, completedAt: new Date() } },
      );
      return { ...result, ran: true };
    }

    // Group policies by tenant for efficient processing
    const policiesByTenant = policies.reduce((acc, p) => {
      const key = String(p.tenantId);
      if (!acc[key]) acc[key] = [];
      acc[key].push(p);
      return acc;
    }, {});

    const tenantIds = Object.keys(policiesByTenant);
    result.tenants = tenantIds.length;

    const monthStart = new Date(currentYear, currentMonth - 1, 1);
    const monthEnd = new Date(currentYear, currentMonth, 0);

    for (const tenantId of tenantIds) {
      const tenantPolicies = policiesByTenant[tenantId];

      // `isDeleted` is deliberately *not* passed here. The soft-delete plugin
      // adds that filter itself, and it bails out when the caller mentions the
      // field — so spelling it out turned the plugin off rather than
      // reinforcing it.
      const employees = await Employee.find({
        tenantId,
        isActive: true,
        employmentStatus: { $ne: 'exited' },
      })
        .select('_id joiningDate exitDetails')
        .lean();

      result.employees += employees.length;

      for (const emp of employees) {
        for (const policy of tenantPolicies) {
          try {
            const joinDate = emp.joiningDate ? new Date(emp.joiningDate) : null;

            // Somebody who had not started by the end of the month accrues
            // nothing for it. `calculateProRatedAccrual` handles this correctly
            // now too, but the cheap check saves a call per employee per policy.
            if (joinDate && joinDate > monthEnd) continue;

            const exitDate = emp.exitDetails?.exitDate
              ? new Date(emp.exitDetails.exitDate)
              : null;

            // An employee who left mid-month accrues for the part they worked,
            // not for the whole of it. `exitDetails` was selected by #646 and
            // then never read.
            if (exitDate && exitDate < monthStart) continue;

            const accrualAmount = calculateProRatedAccrual(
              policy.accrualRate,
              joinDate || monthStart,
              exitDate || monthEnd,
              currentMonth,
              currentYear,
            );

            if (accrualAmount <= 0) continue;

            await LeaveBalance.findOneAndUpdate(
              {
                tenantId,
                employeeId: emp._id,
                policyId: policy._id,
                year: currentYear,
              },
              {
                $inc: { currentBalance: accrualAmount },
                $set: {
                  lastAccrualDate: now,
                  leaveType: policy.leaveType,
                },
                $setOnInsert: {
                  usedThisYear: 0,
                  carriedForwardFromLastYear: 0,
                },
              },
              { upsert: true, new: true, setDefaultsOnInsert: true },
            );

            result.accrued += 1;
          } catch (empError) {
            result.failed += 1;
            logger.error(`Failed to accrue leave for employee ${emp._id}`, {
              error: empError.message,
            });
          }
        }
      }
    }

    await CronLock.updateOne(
      { _id: lockKey },
      { $set: { status: LOCK_STATUS.COMPLETED, completedAt: new Date() } },
    );

    logger.info(
      `Successfully completed leave accrual for ${currentMonth}/${currentYear}`,
      result,
    );

    return { ...result, ran: true };
  } catch (error) {
    logger.error('Monthly leave accrual job failed', { error: error.message });

    // Deleted rather than marked failed. A lock left behind blocks every retry
    // for the rest of its TTL, and a run that threw has credited an unknown
    // subset — the operator needs to be able to fix the cause and run it again
    // the same day. The per-employee upsert is `$inc`, so a partial run is the
    // one case that is *not* safe to repeat blindly; that is why the failure is
    // logged loudly rather than swallowed.
    await CronLock.deleteOne({ _id: lockKey }).catch((cleanupError) =>
      logger.warn('Failed to release the leave accrual lock', {
        lockKey,
        error: cleanupError.message,
      }),
    );

    throw error;
  }
}

module.exports = {
  processMonthlyAccrual,
  acquireAccrualLock,
  LOCK_TTL_MS,
};
