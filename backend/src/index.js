require('dotenv').config();
const Sentry = require('@sentry/node');

// Initialize Sentry for production error tracking (#770)
Sentry.init({
  dsn: process.env.SENTRY_DSN || 'https://public@o0.ingest.sentry.io/0',
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV || 'production',
});

const app = require('./app');
const connectDB = require('./config/db');
const { startCronJobs } = require('./jobs/cron.jobs');
const { startReportCron } = require('./jobs/reportCron');
const { seedRbac } = require('./seeds/rbac.seed');
const { backfillAccountType } = require('./migrations/backfillAccountType');
const { backfillPayrollStatus } = require('./migrations/backfillPayrollStatus');
const {
  backfillSalaryStructures,
} = require('./migrations/backfillSalaryStructures');
const { backfillTenants } = require('./migrations/backfillTenants');
const { registerAuditListener } = require('./listeners/audit.listener');
const {
  registerNotificationListener,
} = require('./listeners/notification.listener');
const { initializeWebhookService } = require('./services/webhook.service');
const { startWebhookWorker } = require('./workers/webhook.worker');
const { startEmailWorker } = require('./workers/email.worker');
const { startOutboxWorker } = require('./workers/outbox.worker');
const { isRedisAvailable } = require('./config/redis');
const { attachGraphQL } = require('./graphql');
const logger = require('./utils/logger');
const TelemetryService = require('./config/telemetry');

let server;

process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...', {
    name: err.name,
    message: err.message,
    stack: err.stack,
  });
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason) => {
  logger.error('UNHANDLED REJECTION! 💥 Shutting down...', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

const startServer = async () => {
  const { validateEnv } = require('./utils/envValidator');
  validateEnv();

  TelemetryService.initTelemetry();
  await connectDB();

  // Separate the account type from the RBAC role reference on accounts written
  // while both shared the name `role`, and stamp `accountType` on the rest.
  // Runs *before* the seeder: it unsets `role` on accounts that never had a
  // real one, which is exactly what the seeder's own backfill then fills in.
  // Idempotent and never throws — see migrations/backfillAccountType.js (#558).
  await backfillAccountType();

  // Ensure the RBAC roles/permissions exist and that no account is left without
  // a role. Idempotent, and never throws — see seeds/rbac.seed.js (#413).
  await seedRbac();

  // Normalise the three generations of payroll status strings onto the
  // canonical vocabulary and build the new compound indexes. Idempotent, a
  // no-op on an already-clean collection, and never throws — see
  // migrations/backfillPayrollStatus.js (#458).
  await backfillPayrollStatus();

  // Give every existing employee an `initial` salary revision derived from the
  // figure already on their record, so the history starts from a true
  // statement. Never changes anyone's pay, idempotent, and never throws — see
  // migrations/backfillSalaryStructures.js (#461).
  await backfillSalaryStructures();

  // Create one tenant per existing company and stamp `tenantId` onto the
  // accounts and business rows that predate #585, deriving ownership from
  // `createdBy`. Runs last of the migrations because it reads the account
  // shapes the earlier ones normalise. Idempotent, a no-op on an already-scoped
  // database, and never throws — see migrations/backfillTenants.js (#612).
  await backfillTenants();

  // Subscribe to AUDIT_LOG. Nothing did, ever: `listeners/audit.listener.js`
  // registered its handler as a side effect of being required, and no file in
  // the tree required it. Thirty-three emits across nine controllers fired into
  // an EventEmitter with no subscribers — a silent no-op — so the AuditLog
  // collection was empty and `GET /api/audit-logs` returned [] on every account
  // (#664). Called here rather than imported for its side effect, because a
  // side-effect import is what got deleted the first time.
  registerAuditListener();

  // Subscribe to AUDIT_LOG for the in-app notification centre (#898). Same
  // shape and the same reasoning as the line above: #440 shipped the model, the
  // controller, the router and the bell in the navbar, and nothing in the
  // codebase ever created a Notification — `grep -rn "Notification.create"`
  // returned nothing — so every account's bell was permanently empty. The
  // events were already being emitted at the right moments; only a subscriber
  // was missing.
  registerNotificationListener();

  // Subscribe to AUDIT_LOG for webhook dispatch (#645/#474). Same shape as
  // `registerAuditListener` above — an exported call in the boot sequence, not
  // a side-effect import, so it cannot silently go unrequired.
  initializeWebhookService();

  // Start background jobs
  startCronJobs();
  startReportCron();

  // Start the BullMQ worker that delivers webhooks. Redis is optional in
  // PaySphere (cache.service.js falls back to in-memory), so without REDIS_URL
  // the worker is not started at all — the dispatch service logs a warning on
  // each event instead of enqueueing into a queue nothing is draining.
  if (process.env.REDIS_URL) {
    startWebhookWorker();
    startEmailWorker();
    startOutboxWorker();

    const {
      startBulkOperationWorker,
    } = require('./workers/bulkOperation.worker');
    startBulkOperationWorker();

    const {
      startEpfRemittanceWorker,
    } = require('./workers/epfRemittance.worker');
    startEpfRemittanceWorker();
  } else if (!isRedisAvailable()) {
    logger.warn(
      'Webhook worker not started: REDIS_URL is not set. Webhook deliveries require Redis.',
    );
    logger.warn(
      'Email worker not started: REDIS_URL is not set. Emails will not be sent until Redis is available.',
    );
    logger.warn(
      'Outbox worker not started: REDIS_URL is not set. Payroll events will queue in MongoDB until Redis is available.',
    );
  } // Mount /graphql, if the packages for it are installed.  //
  // This used to live in app.js as a top-level `await`, which is a syntax error
  // in CommonJS and left the whole file unparseable (#792). `ApolloServer.start()`
  // really is asynchronous, so it belongs here in the startup sequence rather
  // than in the middle of a module body. Never throws — see graphql/index.js.
  await attachGraphQL(app);

  const PORT = process.env.PORT || 5000;
  server = app.listen(PORT, () =>
    logger.info(`Server running on port ${PORT}`),
  );
  require('./sockets/payroll.socket').init(server);
  require('./sockets/shiftMarketplace.socket').init(server);

  // Start the surge pricing service for shift marketplace
  const surgePricingService = require('./services/SurgePricingService').default;
  if (surgePricingService) {
    surgePricingService.start();
  }

  const { initShutdownHandler } = require('./shutdown');
  initShutdownHandler(server);
};

startServer().catch((error) => {
  logger.error('SERVER STARTUP FAILED', { error: error.message || error });
  process.exit(1);
});
