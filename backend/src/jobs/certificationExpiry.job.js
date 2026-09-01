const cron = require('node-cron');
const EmployeeSkill = require('../models/employeeSkill.model');
const NotificationService = require('../services/notification.service');
const { addDays } = require('../utils/dates');
const logger = require('../utils/logger');

class CertificationExpiryJob {
  constructor() {
    this.name = 'certification-expiry-job';
  }

  async run() {
    logger.info(`Starting ${this.name}...`);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const in30Days = addDays(today, 30);
      const startOf30thDay = new Date(in30Days);
      startOf30thDay.setHours(0, 0, 0, 0);

      const endOf30thDay = new Date(in30Days);
      endOf30thDay.setHours(23, 59, 59, 999);

      // Find skills where certificationExpiry is exactly 30 days away
      const expiringSkills = await EmployeeSkill.find({
        certificationExpiry: {
          $gte: startOf30thDay,
          $lte: endOf30thDay,
        },
        isDeleted: false,
        status: 'approved',
      })
        .populate('skillId', 'name')
        .populate('employeeId', 'createdBy tenantId');

      for (const skill of expiringSkills) {
        if (skill.employeeId && skill.employeeId.createdBy) {
          await NotificationService.sendNotification({
            userId: skill.employeeId.createdBy,
            title: 'Certification Expiring Soon',
            body: `Your certification for ${skill.skillId?.name || 'a skill'} is expiring in 30 days on ${skill.certificationExpiry.toLocaleDateString()}. Please renew it and upload the updated document.`,
            type: 'CERTIFICATION_EXPIRY',
            tenantId: skill.employeeId.tenantId,
          });
        }
      }

      logger.info(
        `Finished ${this.name}. Processed ${expiringSkills.length} records.`,
      );
    } catch (error) {
      logger.error(`Error in ${this.name}:`, error);
    }
  }
}

const jobInstance = new CertificationExpiryJob();

module.exports = {
  runCertificationExpiryJob: () => jobInstance.run(),
};
