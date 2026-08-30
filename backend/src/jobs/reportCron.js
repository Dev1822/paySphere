const cron = require('node-cron');
const ReportSchedule = require('../models/reportSchedule.model');
const CronLock = require('../models/cronlock.model');
const { sendEmail } = require('../utils/email');
const { buildReport } = require('./reportBuilders');
const logger = require('../utils/logger');

/**
 * The scheduled-report runner (#667).
 *
 * What this used to do, in full:
 *
 *     // --- Mocking the actual report generation and email dispatch ---
 *     logger.info(`Cron: Simulated sending email to ${schedule.recipients...}`);
 *     schedule.lastRunAt = now;
 *     await schedule.save();
 *
 * It found due schedules well enough, sent nothing, and then stamped
 * `lastRunAt` — so the UI showed a recent run for a report that was never
 * generated and never delivered. A silent no-op that reports success is worse
 * than a job that fails loudly: nobody finds out until someone asks where their
 * monthly payroll register went.
 *
 * Four other things were wrong around it, and all of them are fixed here:
 *
 *   1. `cron.schedule(...)` ran at require time, so importing the module for a
 *      unit test started a live timer. `cron.jobs.js` exports `startCronJobs()`
 *      for exactly this reason; this file follows it.
 *   2. No lock, so N instances behind a load balancer meant N copies of every
 *      report to every recipient. `cron.jobs.js` takes a `CronLock` per period.
 *   3. Due-ness was elapsed-millisecond arithmetic. See `isDue` below.
 *   4. The `try` wrapped the whole `for` loop, so one bad schedule aborted every
 *      schedule after it — and since `lastRunAt` was never stamped for those,
 *      they queued behind the broken one indefinitely.
 */

/** How long a run may hold its lock before the TTL index reclaims it. */
const LOCK_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Take a lock for the day's run.
 *
 * The `_id` is the lock, so a second instance loses on the unique index rather
 * than on a race the application has to reason about itself.
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
    if (error.code === 11000) return { acquired: false, reason: 'held' };

    logger.error('Failed to acquire a report cron lock', {
      lockId,
      error: error.message,
    });
    return { acquired: false, reason: 'error' };
  }
}

/**
 * Give a lock back.
 *
 * Released on failure as well as on success: the lock exists to stop two
 * instances doing the same work at once, not to record that the work was
 * attempted — the reasoning `cron.jobs.js#releaseLock` already documents.
 *
 * @param {string} lockId
 * @returns {Promise<void>}
 */
async function releaseLock(lockId) {
  try {
    await CronLock.deleteOne({ _id: lockId });
  } catch (error) {
    logger.warn('Failed to release a report cron lock', {
      lockId,
      error: error.message,
    });
  }
}

/** Midnight on the day `date` falls in. */
function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * A stable key for the period `now` falls in, at this frequency.
 *
 * @param {string} frequency
 * @param {Date} now
 * @returns {string}
 */
function periodKey(frequency, now) {
  const day = startOfDay(now);

  if (frequency === 'monthly') {
    return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}`;
  }

  if (frequency === 'weekly') {
    // The Monday of this week. Anchoring to a weekday rather than counting
    // sevens means a run that slips a day does not shift every later period.
    const monday = new Date(day);
    const offset = (monday.getDay() + 6) % 7;
    monday.setDate(monday.getDate() - offset);
    return `W${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
  }

  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
}

/**
 * Is this schedule due?
 *
 * Compares calendar periods, not elapsed time. The old test was:
 *
 *     const diffDays = (now - lastRunAt) / 86400000;
 *     if (frequency === "daily"   && diffDays >= 1)  shouldRun = true;
 *     if (frequency === "monthly" && diffDays >= 30) shouldRun = true;
 *
 * The cron fires at 00:00 and `lastRunAt` is stamped when the run *finishes*, a
 * few hundred milliseconds later. The next night `diffDays` is 0.99999…, which
 * is not `>= 1`, so a daily schedule skipped a day — and because `lastRunAt`
 * then moved forward again, it skipped roughly every other day forever. `>= 30`
 * for monthly drifts the run date backwards through the year and fires twice in
 * February.
 *
 * Asking "is the period this run belongs to different from the period the last
 * run belonged to?" has none of those properties.
 *
 * @param {object} schedule
 * @param {Date} now
 * @returns {boolean}
 */
function isDue(schedule, now) {
  if (!schedule.lastRunAt) return true;

  return (
    periodKey(schedule.frequency, now) !==
    periodKey(schedule.frequency, new Date(schedule.lastRunAt))
  );
}

/**
 * Generate and deliver one schedule's report.
 *
 * `lastRunAt` advances only on a delivery that actually happened, so a failure
 * leaves the schedule due and the next run retries it.
 *
 * @param {object} schedule a ReportSchedule document
 * @param {Date} now
 * @returns {Promise<{delivered: boolean, reason?: string, rows?: number}>}
 */
async function runSchedule(schedule, now) {
  const report = await buildReport(schedule, now);

  const result = await sendEmail({
    to: schedule.recipients.join(', '),
    subject: `PaySphere ${schedule.reportType} report — ${report.window.label}`,
    text: [
      `Your scheduled ${schedule.frequency} ${schedule.reportType} report is attached.`,
      '',
      `Period: ${report.window.start.toISOString().slice(0, 10)} to ${report.window.end
        .toISOString()
        .slice(0, 10)}`,
      `Rows: ${report.rows}`,
      '',
      '— PaySphere',
    ].join('\n'),
    attachments: [{ filename: report.filename, content: report.content }],
  });

  // sendEmail resolves with `{ success: false }` rather than throwing when SMTP
  // is unconfigured or the send fails, so the result has to be checked.
  // Treating a resolved promise as a delivery is how the stamp got ahead of the
  // work in the first place.
  if (!result?.success) {
    return { delivered: false, reason: result?.error || 'delivery failed' };
  }

  schedule.lastRunAt = now;
  await schedule.save();

  return { delivered: true, rows: report.rows };
}

/**
 * Walk every active schedule and run the ones that are due.
 *
 * @param {object} [options]
 * @param {Date} [options.now] the moment the job is treated as having fired
 * @returns {Promise<{ran: boolean, reason?: string, due: number, delivered: number, failed: number}>}
 */
async function runScheduledReports({ now = new Date() } = {}) {
  let due = 0;
  let delivered = 0;
  let failed = 0;

  const lockId = `report_schedules_${periodKey('daily', now)}`;

  const lock = await acquireLock(lockId);
  if (!lock.acquired) {
    logger.info('Scheduled reports skipped: the lock is held elsewhere', {
      lockId,
    });
    return { ran: false, reason: lock.reason, due, delivered, failed };
  }

  try {
    const schedules = await ReportSchedule.find({ isActive: true });

    for (const schedule of schedules) {
      if (!isDue(schedule, now)) continue;

      due += 1;

      // Per schedule, not around the loop. One schedule pointing at a deleted
      // tenant used to abort every schedule after it in the list.
      try {
        const result = await runSchedule(schedule, now);

        if (result.delivered) {
          delivered += 1;
          logger.info('Scheduled report delivered', {
            scheduleId: String(schedule._id),
            reportType: schedule.reportType,
            frequency: schedule.frequency,
            recipients: schedule.recipients.length,
            rows: result.rows,
          });
        } else {
          failed += 1;
          logger.error('Scheduled report was not delivered', {
            scheduleId: String(schedule._id),
            reportType: schedule.reportType,
            reason: result.reason,
          });
        }
      } catch (error) {
        failed += 1;
        logger.error('Scheduled report failed', {
          scheduleId: String(schedule._id),
          reportType: schedule.reportType,
          error: error.message,
        });
      }
    }

    logger.info('Scheduled reports complete', { due, delivered, failed });

    return { ran: true, due, delivered, failed };
  } catch (error) {
    logger.error('Scheduled reports job failed', { error: error.message });
    return { ran: false, reason: 'error', due, delivered, failed };
  } finally {
    await releaseLock(lockId);
  }
}

let reportCronTask = null;

/**
 * Register the cron.
 *
 * Called from the boot sequence rather than run on require, so that importing
 * this module — from a test, from a script — has no side effects.
 *
 * @returns {void}
 */
function startReportCron() {
  // 00:30 daily. Half an hour after midnight so a daily schedule's window,
  // which ends at the close of yesterday, is unambiguously closed.
  reportCronTask = cron.schedule('30 0 * * *', () => {
    runScheduledReports().catch((error) =>
      logger.error('Scheduled reports job threw', { error: error.message }),
    );
  });

  logger.info('Report schedule cron registered.');
}

function stopReportCron() {
  if (reportCronTask) reportCronTask.stop();
}

module.exports = {
  startReportCron,
  stopReportCron,
  runScheduledReports,
  runSchedule,
  isDue,
  periodKey,
  acquireLock,
  releaseLock,
};
