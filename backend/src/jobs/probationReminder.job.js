const ProbationTracker = require('../models/probationTracker.model');
const { enqueueEmail } = require('./email.queue');
const logger = require('../utils/logger');
const { startOfDay, endOfDay, addDays } = require('date-fns');

async function checkExpiriesForDay(targetDate, reminderType) {
  const start = startOfDay(targetDate);
  const end = endOfDay(targetDate);

  const trackers = await ProbationTracker.find({
    status: { $in: ['active', 'extended'] },
    endDate: { $gte: start, $lte: end },
  })
    .populate('employeeId')
    .populate('tenantId');

  for (const tracker of trackers) {
    if (!tracker.employeeId || !tracker.tenantId) continue;

    // We send the email to the employee's manager, or a fallback HR email if no manager
    const employee = tracker.employeeId;
    let managerEmail = 'hr@example.com'; // fallback
    if (employee.managerId) {
      // Find the manager
      const Employee = require('../models/employee.model');
      const manager = await Employee.findById(employee.managerId);
      if (manager && manager.email) {
        managerEmail = manager.email;
      }
    }

    await enqueueEmail({
      to: managerEmail,
      subject: `Probation Review Reminder: ${employee.fullName}`,
      html: `<p>The probation period for ${employee.fullName} expires in ${reminderType}. Please submit your review recommendation.</p>`,
    });
  }
}

async function runProbationReminders() {
  try {
    logger.info('Starting probation reminders job');

    // 30 days
    await checkExpiriesForDay(addDays(new Date(), 30), '30 days');

    // 14 days
    await checkExpiriesForDay(addDays(new Date(), 14), '14 days');

    // 0 days
    await checkExpiriesForDay(new Date(), 'today');

    logger.info('Finished probation reminders job');
  } catch (error) {
    logger.error('Error running probation reminders', { error: error.message });
  }
}

module.exports = {
  runProbationReminders,
};
