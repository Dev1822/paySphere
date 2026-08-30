const CompensationCycle = require('../models/compensationCycle.model');
const RevisionProposal = require('../models/revisionProposal.model');
const logger = require('../utils/logger');
// const { sendEmail } = require('../utils/email.utils'); // Assuming an email util exists

async function runCompensationCycleReminderJob() {
  try {
    logger.info('Running compensation cycle reminder job...');
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 3);

    // Find cycles closing in exactly 3 days (ignoring time of day for simplicity,
    // in production we'd do a range check for the day)
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    const cycles = await CompensationCycle.find({
      status: 'Open',
      endDate: { $gte: startOfDay, $lte: endOfDay },
    });

    for (const cycle of cycles) {
      // Find managers who have pending/draft proposals or haven't submitted
      // We'll find all proposals in 'Draft' status for this cycle
      const draftProposals = await RevisionProposal.find({
        compensationCycleId: cycle._id,
        status: 'Draft',
      }).populate('managerId');

      // Extract unique managers
      const managerMap = new Map();
      draftProposals.forEach((p) => {
        if (p.managerId && p.managerId.email) {
          managerMap.set(p.managerId._id.toString(), p.managerId);
        }
      });

      // Send reminders
      for (const [managerId, manager] of managerMap.entries()) {
        try {
          // Pseudo-code for sending email
          /*
          await sendEmail({
            to: manager.email,
            subject: `Reminder: Compensation Cycle "${cycle.name}" closes in 3 days`,
            text: `Dear ${manager.firstName}, please submit your pending compensation proposals by ${cycle.endDate.toDateString()}.`
          });
          */
          logger.info(`Sent reminder to manager ${manager.email}`);
        } catch (err) {
          logger.error(`Failed to send reminder to ${manager.email}:`, err);
        }
      }
    }
    return { ran: true };
  } catch (error) {
    logger.error('Error in compensation cycle reminder job:', error);
    return { ran: false, reason: 'error' };
  }
}

module.exports = { runCompensationCycleReminderJob };
