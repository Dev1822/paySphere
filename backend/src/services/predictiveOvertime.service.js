const { Queue, Worker, QueueEvents } = require('bullmq');
const Redis = require('ioredis');
const { ShiftRoster } = require('../models/shiftRoster.model');
const { TimesheetEntry } = require('../models/timesheet.model');
const { BurnoutTelemetry } = require('../models/BurnoutRiskModels');
const ClinicalTelemetry = require('../models/clinicalTelemetry.model');
const burnoutPredictorService = require('./burnoutPredictorService');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

// Assuming standard REDIS_URL for connection
const connection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

const PREDICTIVE_OVERTIME_QUEUE = 'PredictiveOvertimeQueue';

const overtimeQueue = new Queue(PREDICTIVE_OVERTIME_QUEUE, { connection });

const overtimeWorker = new Worker(
  PREDICTIVE_OVERTIME_QUEUE,
  async (job) => {
    logger.info(`Processing overtime calculation job: ${job.id}`);
    try {
      const { tenantId } = job.data;

      // 1. Fetch all employees currently on roster or with telemetry
      const telemetries = await BurnoutTelemetry.find({}).lean();

      for (const t of telemetries) {
        // Aggregate hours from ShiftRoster (future)
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + 7);

        // Forecast logic placeholder:
        // We would sum the hours from upcoming ShiftRosters and combine with recent TimesheetEntries

        // For now, let's just trigger the predictor with some aggregated data
        const empData = {
          employeeId: t.employeeId,
          department: t.department,
          averageWeeklyHours: t.averageWeeklyHours + Math.random() * 5, // Simulating forecast adding hours
          weekendHoursLogged: t.weekendHoursLogged,
          afterHoursCommunications: t.afterHoursCommunications,
          daysSinceLastPto: t.daysSinceLastPto,
          sentimentScore: t.sentimentScore,
          engagementIndex: t.engagementIndex,
          manager1on1Frequency: t.manager1on1Frequency,
          peerRecognitionCount: t.peerRecognitionCount,
          sickDaysTaken: t.sickDaysTaken,
        };

        const { score, category } =
          await burnoutPredictorService.calculateBurnoutRisk(empData);

        await BurnoutTelemetry.updateOne(
          { _id: t._id },
          {
            $set: {
              burnoutRiskScore: score,
              riskCategory: category,
              averageWeeklyHours: empData.averageWeeklyHours,
            },
          },
        );

        // If critical, could trigger interventions
        if (category === 'CRITICAL') {
          logger.warn(
            `Employee ${t.employeeId} has reached CRITICAL burnout risk!`,
          );
        }
      }

      logger.info('Overtime calculation job completed successfully');
      return { success: true };
    } catch (error) {
      logger.error(`Error in overtime calculation job: ${error.message}`);
      throw error;
    }
  },
  { connection },
);

// Set up recurring job (hourly)
overtimeQueue.add(
  'hourly-calculation',
  {},
  {
    repeat: { pattern: '0 * * * *' }, // Every hour
  },
);

module.exports = {
  overtimeQueue,
  overtimeWorker,

  // Redis-based lock utility
  acquireLock: async (lockKey, ttlSeconds = 10) => {
    const result = await connection.set(
      lockKey,
      'locked',
      'EX',
      ttlSeconds,
      'NX',
    );
    return result === 'OK';
  },

  releaseLock: async (lockKey) => {
    await connection.del(lockKey);
  },
};
