const mongoose = require('mongoose');
const { getIo: getPayrollIo } = require('./sockets/payroll.socket');
const { getIo: getShiftIo } = require('./sockets/shiftMarketplace.socket');
const { stopWebhookWorker } = require('./workers/webhook.worker');
const { stopEmailWorker } = require('./workers/email.worker');
const { stopOutboxWorker } = require('./workers/outbox.worker');const { stopCronJobs } = require('./jobs/cron.jobs');
const { stopReportCron } = require('./jobs/reportCron');
const redisConnection = require('./config/redis');
const logger = require('./utils/logger');

let isShuttingDown = false;

const getIsShuttingDown = () => isShuttingDown;

const initShutdownHandler = (server) => {
  const shutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info(`Shutdown initiated. Received ${signal}.`);

    // 15 seconds hard timeout
    setTimeout(() => {
      logger.error(
        'Graceful shutdown timed out after 15 seconds. Forcing exit.',
      );
      process.exit(1);
    }, 15000);

    try {
      logger.info('Stopping cron jobs...');
      stopCronJobs();
      stopReportCron();

      logger.info('Closing HTTP server and sockets...');
      const payrollIo = getPayrollIo();
      if (payrollIo) payrollIo.close();
      const shiftIo = getShiftIo();
      if (shiftIo) shiftIo.close();

      if (server) {
        await new Promise((resolve) => server.close(resolve));
      }

      logger.info('Closing BullMQ workers...');
      await Promise.all([
        stopWebhookWorker && stopWebhookWorker(),
        stopEmailWorker && stopEmailWorker(),
        stopOutboxWorker && stopOutboxWorker(),
      ]);
      logger.info('Disconnecting databases...');
      await mongoose.disconnect();
      await redisConnection.quit();

      logger.info('Shutdown complete. Exiting.');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown:', { error: error.message });
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

module.exports = { getIsShuttingDown, initShutdownHandler };
