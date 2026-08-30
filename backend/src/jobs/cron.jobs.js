const cron = require('node-cron');
const PayrollUpdate = require('../models/payroll.model');
const Employee = require('../models/employee.model');
const CronLock = require('../models/cronlock.model');
const Tenant = require('../models/tenant.model');
const { enqueueEmail } = require('../jobs/email.queue');
const { emailableStatusFilter } = require('../config/payrollStatus');
const { processMonthlyAccrual } = require('./leaveAccrual.job');
const logger = require('../utils/logger');
const { runDatabaseBackupJob } = require('./backup.job');
const { runDatabaseArchivalJob } = require('./archival.job');
const { runForexSyncJob } = require('./forexSync.job');
const {
  runCompensationCycleReminderJob,
} = require('./compensationCycleReminder.job');
const LOCK_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Take a named lock so only one instance runs a given job for a given period.
 *
 * The lock is a document whose `_id` is the period key, so a second instance
 * loses on the unique index rather than on a race the application has to reason
 * about itself.
 *
 * @param {string} lockId
 * @returns {Promise<{acquired: boolean, reason?: string}>}
 */
async function acquireLock(lockId) {
  try {
    await CronLock.create({
      _id: lockId,
      lockedAt: new Date(),
      expiresAt: new Date(Date.now() + LOCK_TTL_MS),
    });

    return { acquired: true };
  } catch (error) {
    if (error.code === 11000) {
      return { acquired: false, reason: 'held' };
    }

    logger.error('Failed to acquire cron lock', {
      lockId,
      error: error.message,
    });
    return { acquired: false, reason: 'error' };
  }
}

/**
 * Give a lock back.
 *
 * The lock exists to stop two instances doing the same work at once, not to
 * record that the work was attempted. A run that failed — or that found nothing
 * because of a bug — used to leave it behind for 24 hours, so a corrected
 * deployment on the same day was skipped without a word.
 *
 * @param {string} lockId
 * @returns {Promise<void>}
 */
async function releaseLock(lockId) {
  try {
    await CronLock.deleteOne({ _id: lockId });
  } catch (error) {
    // Not fatal: the TTL index clears it within the day regardless.
    logger.warn('Failed to release cron lock', {
      lockId,
      error: error.message,
    });
  }
}

/**
 * The month a payslip run on `now` is for — the one that just ended.
 *
 * Anchored to the 1st before stepping back, because `setMonth(getMonth() - 1)`
 * on the 31st lands on the wrong month whenever the previous one is shorter.
 *
 * @param {Date} now
 * @returns {{month: number, year: number}}
 */
function previousPeriod(now) {
  const anchor = new Date(now.getFullYear(), now.getMonth(), 1);
  anchor.setMonth(anchor.getMonth() - 1);

  return { month: anchor.getMonth() + 1, year: anchor.getFullYear() };
}

/**
 * Email the payslips for the month that just ended.
 *
 * The query used to be `status: "finalized"`. `config/payrollStatus.js` retired
 * that value: `payroll.model.js` normalises it to `approved` on write and
 * `migrations/backfillPayrollStatus.js` rewrote every existing row, so nothing
 * on disk could match it. The job found zero rows every month, logged "Found 0
 * finalized payrolls", and exited successfully — payslips stopped going out and
 * nothing said so (#560).
 *
 * It now asks `emailableStatusFilter()`, the same source of truth the manual
 * dispatch path reaches through `isEmailable`, so an unapproved or rejected run
 * can never be emailed and the two cannot drift apart again.
 *
 * Exported so it can be tested, and so an operator can re-run a month by hand.
 *
 * @param {object} [options]
 * @param {Date} [options.now] the moment the job is treated as having fired
 * @returns {Promise<{ran: boolean, reason?: string, month: number, year: number, found: number, sent: number, skipped: number, failed: number}>}
 */
async function runMonthlyPayslipJob({ now = new Date() } = {}) {
  const { month, year } = previousPeriod(now);
  const lockId = `monthly_payslip_${year}_${month}`;

  let found = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  const lock = await acquireLock(lockId);
  if (!lock.acquired) {
    logger.info('Monthly payslip job skipped: lock is held elsewhere', {
      lockId,
      month,
      year,
    });
    return {
      ran: false,
      reason: lock.reason,
      month,
      year,
      found,
      sent,
      skipped,
      failed,
    };
  }

  try {
    const payrolls = await PayrollUpdate.find({
      month,
      year,
      ...emailableStatusFilter(),
      // `$ne: true` rather than `false`: a document written before
      // `payslipEmailed` was added to the schema has no such field, and
      // `{ payslipEmailed: false }` does not match a missing field. Those are
      // exactly the "finalized"-era rows this job has never managed to reach,
      // so matching them is the whole point.
      payslipEmailed: { $ne: true },
    });

    found = payrolls.length;
    logger.info(`Monthly payslip job: ${found} payslip(s) to send`, {
      month,
      year,
    });

    for (const payroll of payrolls) {
      try {
        const employee = await Employee.findById(payroll.employeeId);

        if (!employee || !employee.email) {
          // Nothing to send to. Counted rather than ignored, so "0 sent" can be
          // told apart from "nobody has an email address on file".
          skipped += 1;
          continue;
        }

        await enqueueEmail('payslip', { employee, payroll });
        sent += 1;
      } catch (error) {
        // One bad address or SMTP hiccup must not cost everyone else their
        // payslip, so the loop carries on and the failure is counted.
        failed += 1;
        logger.error('Failed to send a payslip', {
          payrollId: String(payroll._id),
          month,
          year,
          error: error.message,
        });
      }
    }

    logger.info('Monthly payslip job complete', {
      month,
      year,
      found,
      sent,
      skipped,
      failed,
    });

    // A run that sent nothing is not proof of a quiet month — it is precisely
    // what this bug looked like for months — so hand the lock back and let a
    // later attempt try again instead of blocking it for 24 hours.
    if (sent === 0) await releaseLock(lockId);

    return { ran: true, month, year, found, sent, skipped, failed };
  } catch (error) {
    logger.error('Monthly payslip job failed', {
      month,
      year,
      error: error.message,
    });
    await releaseLock(lockId);

    return {
      ran: false,
      reason: 'error',
      month,
      year,
      found,
      sent,
      skipped,
      failed,
    };
  }
}

/**
 * Birthday and work-anniversary greetings for today.
 *
 * Exported for the same reasons as the payslip job.
 *
 * @param {object} [options]
 * @param {Date} [options.now]
 * @returns {Promise<{ran: boolean, reason?: string, sent: number, failed: number}>}
 */
async function runDailyGreetingsJob({ now = new Date(), tenantId } = {}) {
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const lockId = `daily_greetings_${now.getFullYear()}_${month}_${day}`;

  let sent = 0;
  let failed = 0;

  const lock = await acquireLock(lockId);
  if (!lock.acquired) {
    logger.info('Daily greetings job skipped: lock is held elsewhere', {
      lockId,
    });
    return { ran: false, reason: lock.reason, sent, failed };
  }

  try {
    let tenants = [];
    if (tenantId) {
      const tenant = await Tenant.findOne({ _id: tenantId, isActive: true });
      if (tenant) {
        tenants.push(tenant);
      }
    } else {
      tenants = await Tenant.find({ isActive: true });
    }

    for (const tenant of tenants) {
      const employees = await Employee.find({
        tenantId: tenant._id,
        isActive: true,
        email: { $exists: true, $ne: '' },
      });

      for (const employee of employees) {
        try {
          if (employee.dateOfBirth) {
            const dob = new Date(employee.dateOfBirth);
            if (dob.getMonth() + 1 === month && dob.getDate() === day) {
              await enqueueEmail('generic', {
                to: employee.email,
                subject: `Happy Birthday, ${employee.fullName}!`,
                text: `Dear ${employee.fullName},\n\nWishing you a very Happy Birthday from everyone at ${employee.companyName}!\n\nBest Regards,\nThe Team`,
              });
              sent += 1;
            }
          }

          if (employee.joiningDate) {
            const joined = new Date(employee.joiningDate);
            if (joined.getMonth() + 1 === month && joined.getDate() === day) {
              const years = now.getFullYear() - joined.getFullYear();
              if (years > 0) {
                await enqueueEmail('generic', {
                  to: employee.email,
                  subject: `Happy ${years} Year Work Anniversary, ${employee.fullName}!`,
                  text: `Dear ${employee.fullName},\n\nCongratulations on reaching your ${years} year anniversary at ${employee.companyName}! We appreciate all your hard work.\n\nBest Regards,\nThe Team`,
                });
                sent += 1;
              }
            }
          }
        } catch (error) {
          // Same reasoning as the payslip loop: one bad address is not a reason
          // for everybody else to go without.
          failed += 1;
          logger.error('Failed to send a greeting', {
            employeeId: String(employee._id),
            tenantId: String(tenant._id),
            error: error.message,
          });
        }
      }
    }

    logger.info('Daily greetings job complete', { sent, failed });

    return { ran: true, sent, failed };
  } catch (error) {
    logger.error('Daily greetings job failed', { error: error.message });
    await releaseLock(lockId);

    return { ran: false, reason: 'error', sent, failed };
  }
}

const scheduledTasks = [];

const startCronJobs = () => {
  // 09:00 on the 1st of every month.
  scheduledTasks.push(
    cron.schedule('0 9 1 * *', () => {
      runMonthlyPayslipJob().catch((error) =>
        logger.error('Monthly payslip job threw', { error: error.message }),
      );
    }),
  );
  logger.info('Payslip cron job registered.');

  // 08:00 daily.
  scheduledTasks.push(
    cron.schedule('0 8 * * *', () => {
      runDailyGreetingsJob().catch((error) =>
        logger.error('Daily greetings job threw', { error: error.message }),
      );
    }),
  );
  logger.info('Daily greetings cron job registered.');

  // 00:00 daily
  scheduledTasks.push(
    cron.schedule('0 0 * * *', () => {
      runCompensationCycleReminderJob().catch((error) =>
        logger.error('Compensation cycle reminder job threw', {
          error: error.message,
        }),
      );
    }),
  );
  logger.info('Compensation cycle reminder job registered.');

  // 00:30 on the 1st of every month.
  //
  // #646 wrote this job and never scheduled it. Its own header says "Runs on
  // the 1st of every month at 00:00 UTC" and there was no `cron.schedule` for
  // it anywhere in the tree, so `LeaveBalance` was never written and every
  // balance in the product read 0 (#796).
  //
  // Half an hour past midnight rather than on it: a run that starts a few
  // seconds early would compute the period from the previous month and credit
  // it a second time.
  scheduledTasks.push(
    cron.schedule('30 0 1 * *', () => {
      processMonthlyAccrual().catch((error) =>
        logger.error('Monthly leave accrual job threw', {
          error: error.message,
        }),
      );
    }),
  );
  logger.info('Monthly leave accrual cron job registered.');

  // 02:00 daily — the hour `IntegrationConfig.syncSchedule` defaults to.
  //
  // One scheduled run that walks every active integration, rather than a cron
  // registration per tenant: the set of tenants changes while the process is
  // running, and a schedule built at boot would never know about a company
  // that connected an HRMS afterwards (#954).
  scheduledTasks.push(
    cron.schedule('0 2 * * *', () => {
      runHrmsSyncJob().catch((error) =>
        logger.error('HRMS sync job threw', { error: error.message }),
      );
    }),
  );
  logger.info('HRMS integration sync cron job registered.');

  // 03:00 daily — Database backup to S3/local.
  scheduledTasks.push(
    cron.schedule('0 3 * * *', () => {
      runDatabaseBackupJob().catch((error) =>
        logger.error('Database backup job threw', { error: error.message }),
      );
    }),
  );
  logger.info('Daily database backup cron job registered.');

  // 00:00 daily — Forex exchange rate daily sync.
  scheduledTasks.push(
    cron.schedule('0 0 * * *', () => {
      runForexSyncJob().catch((error) =>
        logger.error('Forex sync job threw', { error: error.message }),
      );
    }),
  );
  logger.info('Daily forex sync cron job registered.');

  // 00:00 on the 1st of every month — Database archival to S3 Glacier/local.
  scheduledTasks.push(
    cron.schedule('0 0 1 * *', () => {
      runDatabaseArchivalJob().catch((error) =>
        logger.error('Database archival job threw', { error: error.message }),
      );
    }),
  );
  logger.info('Monthly database archival cron job registered.');
  // 01:00 daily — Data retention and privacy lifecycle.
  //
  // Runs separately from cold-storage archival so retention policy decisions
  // can be applied per tenant without deleting historical payroll or audit data.
  scheduledTasks.push(
    cron.schedule('0 1 * * *', () => {
      runRetentionLifecycleJob().catch((error) =>
        logger.error('Retention lifecycle job threw', {
          error: error.message,
        }),
      );
    }),
  );
  logger.info('Daily retention lifecycle cron job registered.');
  // 04:00 daily — TOIL Expirations and Warnings.
  scheduledTasks.push(
    cron.schedule('0 4 * * *', () => {
      runToilExpirationJob().catch((error) =>
        logger.error('TOIL expiration job threw', { error: error.message }),
      );
    }),
  );
  logger.info('Daily TOIL expiration cron job registered.');

  // 05:00 daily — Treasury Vault Liquidity Rebalancing.
  scheduledTasks.push(
    cron.schedule('0 5 * * *', () => {
      runTreasuryRebalancingCron().catch((error) =>
        logger.error('Treasury rebalancing job threw', {
          error: error.message,
        }),
      );
    }),
  );
  logger.info('Daily treasury rebalancing cron job registered.');

  // 06:00 daily — Regional Tax Slab Auto-Sync.
  scheduledTasks.push(
    cron.schedule('0 6 * * *', () => {
      runTaxSyncCron().catch((error) =>
        logger.error('Tax sync job threw', { error: error.message }),
      );
    }),
  );
  logger.info('Daily regional tax sync cron job registered.');

  // 02:00 daily - Usage Counter Rollup (#1113).
  // Persists Redis usage counters to TenantSubscription.usage and checks overage alerts.
  scheduledTasks.push(
    cron.schedule('0 2 * * *', () => {
      const { runUsageRollup } = require('./usageRollup.job');
      runUsageRollup().catch((error) =>
        logger.error('Usage rollup job threw', { error: error.message }),
      );
    }),
  );
  logger.info('Daily usage rollup cron job registered.');

  // Every 15 minutes — Payroll Approval Escalation (#1247).
  // Finds approval instances past their escalationDeadlineAt and marks them
  // escalated so salary disbursement is not blocked by an absent approver.
  scheduledTasks.push(
    cron.schedule('*/15 * * * *', () => {
      const { processEscalation } = require('./approvalEscalation.job');
      processEscalation().catch((error) =>
        logger.error('Payroll approval escalation job threw', {
          error: error.message,
        }),
      );
    }),
  );
  logger.info(
    'Payroll approval escalation cron job registered (every 15 min).',
  );

  // 01:30 daily — Detect Milestones (Work Anniversaries) with 7-day lead time.
  scheduledTasks.push(
    cron.schedule('30 1 * * *', () => {
      const { runDetectMilestonesJob } = require('./detectMilestones.job');
      runDetectMilestonesJob().catch((error) =>
        logger.error('Detect milestones job threw', { error: error.message }),
      );
    }),
  );
  logger.info('Daily detect milestones cron job registered.');

  // 02:30 daily — Certification Expiry Notifications.
  scheduledTasks.push(
    cron.schedule('30 2 * * *', () => {
      const {
        runCertificationExpiryJob,
      } = require('./certificationExpiry.job');
      runCertificationExpiryJob().catch((error) =>
        logger.error('Certification expiry job threw', {
          error: error.message,
        }),
      );
    }),
  );
  logger.info('Daily certification expiry cron job registered.');
};

function stopCronJobs() {
  scheduledTasks.forEach((task) => task.stop());
}

/**
 * Sync every active HRMS integration (#954).
 *
 * Locked like the jobs above: two instances syncing the same tenant would race
 * each other's upserts. Never throws — a cron callback that rejects is an
 * unhandled rejection with nothing to catch it.
 *
 * @returns {Promise<{ran: boolean, reason?: string, tenants?: number}>}
 */
async function runHrmsSyncJob() {
  const now = new Date();
  const lockId = `hrms-sync-${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

  const lock = await acquireLock(lockId);
  if (!lock.acquired) {
    logger.info('HRMS sync job skipped', { reason: lock.reason });
    return { ran: false, reason: lock.reason };
  }

  try {
    const { syncAllTenants } = require('../services/integrationSync.service');
    const summary = await syncAllTenants();

    logger.info('HRMS sync job complete', summary);

    // Released rather than left to expire, for the reason `releaseLock` gives:
    // a run that failed would otherwise block a corrected deployment on the
    // same day without a word.
    await releaseLock(lockId);

    return { ran: true, ...summary };
  } catch (error) {
    logger.error('HRMS sync job failed', { error: error.message });
    await releaseLock(lockId);

    return { ran: false, reason: 'error' };
  }
}

async function runToilExpirationJob() {
  const now = new Date();
  const lockId = `toil_expiration_${now.getFullYear()}_${now.getMonth() + 1}_${now.getDate()}`;

  const lock = await acquireLock(lockId);
  if (!lock.acquired) {
    logger.info('TOIL expiration job skipped: lock is held elsewhere', {
      lockId,
    });
    return { ran: false, reason: lock.reason };
  }

  try {
    const {
      processToilExpirations,
      sendToilExpiryWarnings,
    } = require('../services/toilExpiration.service');
    const expirationResult = await processToilExpirations();
    const warningResult = await sendToilExpiryWarnings();
    await releaseLock(lockId);
    return { ran: true, ...expirationResult, ...warningResult };
  } catch (error) {
    logger.error('TOIL expiration job failed', { error: error.message });
    await releaseLock(lockId);
    return { ran: false, reason: 'error' };
  }
}

async function runTreasuryRebalancingCron() {
  const now = new Date();
  const lockId = `treasury_rebalancing_${now.getFullYear()}_${now.getMonth() + 1}_${now.getDate()}`;

  const lock = await acquireLock(lockId);
  if (!lock.acquired) {
    logger.info('Treasury rebalancing job skipped: lock is held elsewhere', {
      lockId,
    });
    return { ran: false, reason: lock.reason };
  }

  try {
    const { runTreasuryRebalancingJob } = require('./treasuryRebalance.job');
    const result = await runTreasuryRebalancingJob();
    await releaseLock(lockId);
    return { ran: true, ...result };
  } catch (error) {
    logger.error('Treasury rebalancing job failed', { error: error.message });
    await releaseLock(lockId);
    return { ran: false, reason: 'error' };
  }
}

async function runTaxSyncCron() {
  const now = new Date();
  const lockId = `tax_sync_${now.getFullYear()}_${now.getMonth() + 1}_${now.getDate()}`;

  const lock = await acquireLock(lockId);
  if (!lock.acquired) {
    logger.info('Tax sync job skipped: lock is held elsewhere', { lockId });
    return { ran: false, reason: lock.reason };
  }

  try {
    const { runTaxSyncJob } = require('./taxSync.job');
    const result = await runTaxSyncJob();
    await releaseLock(lockId);
    return { ran: true, ...result };
  } catch (error) {
    logger.error('Tax sync job failed', { error: error.message });
    await releaseLock(lockId);
    return { ran: false, reason: 'error' };
  }
}

module.exports = {
  startCronJobs,
  stopCronJobs,
  runMonthlyPayslipJob,
  runDailyGreetingsJob,
  runHrmsSyncJob,
  runDatabaseBackupJob,
  runDatabaseArchivalJob,
  runRetentionLifecycleJob,
  runForexSyncJob,
  runToilExpirationJob,
  runTreasuryRebalancingJob: runTreasuryRebalancingCron,
  runTaxSyncJob: runTaxSyncCron,
  previousPeriod,
  acquireLock,
  releaseLock,
};
