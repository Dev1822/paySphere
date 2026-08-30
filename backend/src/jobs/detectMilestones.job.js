const Employee = require('../models/employee.model');
const lifecycleEventService = require('../services/lifecycleEvent.service');
const logger = require('../utils/logger');
const { acquireLock, releaseLock } = require('./cron.jobs');

/**
 * Detects upcoming work anniversaries and records them in the employee timeline.
 * Designed to run daily.
 */
async function runDetectMilestonesJob({ now = new Date() } = {}) {
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const lockId = `detect_milestones_${now.getFullYear()}_${month}_${day}`;

  const lock = await acquireLock(lockId);
  if (!lock.acquired) {
    logger.info('Detect milestones job skipped: lock is held elsewhere', {
      lockId,
    });
    return { ran: false, reason: lock.reason };
  }

  let processed = 0;
  let failed = 0;

  try {
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + 7); // 7-day lead time
    const targetMonth = targetDate.getMonth() + 1;
    const targetDay = targetDate.getDate();

    const employees = await Employee.find({
      isActive: true,
      joiningDate: { $exists: true, $ne: null },
    });

    for (const employee of employees) {
      try {
        const joined = new Date(employee.joiningDate);
        if (
          joined.getMonth() + 1 === targetMonth &&
          joined.getDate() === targetDay
        ) {
          const years = targetDate.getFullYear() - joined.getFullYear();
          if (years > 0) {
            await lifecycleEventService.recordEvent({
              employeeId: employee._id,
              tenantId: employee.tenantId,
              eventType: 'WORK_ANNIVERSARY',
              category: 'Milestones',
              occurredAt: targetDate,
              newValues: { years },
              note: `Upcoming ${years} year work anniversary`,
            });
            processed++;
          }
        }
      } catch (err) {
        failed++;
        logger.error('Failed to process milestone for employee', {
          employeeId: employee._id,
          error: err.message,
        });
      }
    }

    logger.info('Detect milestones job complete', { processed, failed });
    await releaseLock(lockId);
    return { ran: true, processed, failed };
  } catch (error) {
    logger.error('Detect milestones job failed', { error: error.message });
    await releaseLock(lockId);
    return { ran: false, reason: 'error', processed, failed };
  }
}

module.exports = { runDetectMilestonesJob };
