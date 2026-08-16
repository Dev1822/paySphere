/**
 * The Express application.
 *
 * This file was unparseable on `main` between #539 and #792. Two separate
 * events put it there, and the second is the reason it is worth a comment:
 *
 *   - #539 added the Apollo requires twice — once at the top of the file and
 *     once in the middle of the middleware stack — and then called
 *     `await apolloServer.start()` at module scope. `backend` is CommonJS, so
 *     top-level `await` is a syntax error whatever else is going on.
 *
 *   - #785's "Merge branch 'main' into feature/soft-delete-759" resolved a
 *     whitespace-only conflict by keeping *both* sides, so the file ended up
 *     with two complete copies of the require block, the middleware stack and
 *     the route table.
 *
 * The two copies of the route table were not identical, which is the part that
 * bites quietly: the first mounted `/api/archive` and not `/api/notifications`,
 * the second the other way round, and Express serves whichever match it reaches
 * first. Neither mounted `/api/expenses`. The mount list below is the union, and
 * `__tests__/app.routeMounting.test.js` now asserts it so a future merge cannot
 * drop a router without a test going red.
 */

const express = require('express');
const cors = require('cors');
const Sentry = require('@sentry/node');
const helmet = require('helmet');
const multer = require('multer');
const cookieParser = require('cookie-parser');

// #1008. Both of these are called further down — `swaggerJsdoc(swaggerOptions)`
// and `swaggerUi.serve` / `swaggerUi.setup(…)` in the /api-docs block — and
// neither was ever imported, so evaluating this module threw
// `ReferenceError: swaggerJsdoc is not defined`.
//
// This is exactly the failure #896 documents for `roleRoutes` a few lines
// below: the packages were in package.json the whole time, the usage was in
// this file the whole time, and the one line joining them was missing. Worth
// naming plainly because it is the third instance — a require block and the
// code depending on it get edited in different places, and nothing fails until
// boot. `__tests__/appBoot.test.js` now loads this module for real, so a
// fourth cannot reach main.
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const roleRoutes = require('./routes/role.routes');
const userRoutes = require('./routes/user.routes');
const employeeRoutes = require('./routes/employee.routes');
const payrollRoutes = require('./routes/payroll.routes');
const reportsRoutes = require('./routes/reports.routes');
const auditRoutes = require('./routes/audit.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const settlementRoutes = require('./routes/settlement.routes');
const loanRoutes = require('./routes/loan.routes');
const schedulerRoutes = require('./routes/scheduler.routes');
const employeePortalRoutes = require('./routes/employeePortal.routes');
const workflowRoutes = require('./routes/workflow.routes');
const salaryHistoryRoutes = require('./routes/salaryHistory.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const flashcardRoutes = require('./routes/flashcard.routes');
const webhookRoutes = require('./routes/webhook.routes');
const integrationRoutes = require('./routes/integration.routes');
const archiveRoutes = require('./routes/archive.routes');
const notificationRoutes = require('./routes/notification.routes');
const monthlyUpdatesRoutes = require('./routes/monthlyUpdates.routes');
const expenseRoutes = require('./routes/expense.routes');
const varianceReportRoutes = require('./routes/varianceReport.routes');
const searchRoutes = require('./routes/search.routes');
const emailRoutes = require('./routes/email.routes');
const complianceRoutes = require('./routes/compliance.routes');

// The eleven routers #1009 found unmounted. Each one had a router, a
// controller, its models and — for most of them — a finished frontend page, and
// no line anywhere in this file, so every endpoint they define answered 404.
// Roughly 1,600 lines of controller that no request could reach.
//
// The mount paths are below, next to the mounts themselves, because two of them
// are not the obvious choice and the reason belongs where someone would look.
const assetRoutes = require('./routes/asset.routes');
const vendorRoutes = require('./routes/vendor.routes');
const grievanceRoutes = require('./routes/grievance.routes');
const taxProofRoutes = require('./routes/taxProof.routes');
const appraisalRoutes = require('./routes/appraisal.routes');
const contractRoutes = require('./routes/contract.routes');
const forecastRoutes = require('./routes/forecast.routes');
const accountingRoutes = require('./routes/accounting.routes');
const clientInvoiceRoutes = require('./routes/clientInvoice.routes');
const shiftRosterRoutes = require('./routes/shiftRoster.routes');
const pyqRoutes = require('./routes/pyq.routes');

// Salary disbursement (#1075). Payroll was computed to the rupee and then
// stopped: `payroll.model.js` has a `disbursed` status and nothing in the
// product produced the bank file that actually moves the money.
const disbursementRoutes = require('./routes/disbursement.routes');

// Training and certification expiry (#1076). The frontend's "Learning" nav
// group held only exam-prep content; there was no employment training record
// anywhere, and no way to answer "who holds a current POSH certification".
const trainingRoutes = require('./routes/training.routes');

// Stock option schemes, grants, vesting and exercises (#1073). Equity was the
// one component of total compensation with no model, no route and no
// calculator — and exercising an option is a taxable perquisite the employer
// has to withhold on, so it is payroll's business and not just HR's.
const esopRoutes = require('./routes/esop.routes');

// Requisitions, the candidate pipeline and interview scorecards (#1074). The
// product covered an employee's life from the offer letter onwards and nothing
// before it — `OfferLetterBuilder.jsx` types in a name and a salary by hand
// because there was no candidate record to draw them from.
const recruitmentRoutes = require('./routes/recruitment.routes');

// #896. `app.use('/api/roles', roleRoutes)` was in the route table below and
// this line was not, so `roleRoutes` was a free variable and evaluating this
// module threw `ReferenceError: roleRoutes is not defined`. Same damage as
// #792: not a 404 on /api/roles, but no server at all.
//
// The header above explains that the file was reconstructed from two divergent
// copies after #785 and that the mount list is the union of the two. The union
// of the route tables was taken; the union of the *import* blocks was not.

const errorHandler = require('./middlewares/error.middleware');
const { generalRateLimiter } = require('./middlewares/rateLimiter.middleware');
const requireBody = require('./middlewares/requireBody.middleware');
const { MAX_FILE_SIZE } = require('./middlewares/upload.middleware');
// `logger` was required here too and never called — the third unused import in
// the block, and the reason `app.security.test.js` asserts the absence of them
// rather than the presence of these three. Logging from this file now goes
// through `requestLogger`, which brings its own.
const { trackHttpMetrics, metricsHandler } = require('./utils/metrics');
const auditContextMiddleware = require('./middlewares/auditContext.middleware');
const requestLogger = require('./middlewares/requestLogger.middleware');

const app = express();

// Belt to Helmet's braces (`hidePoweredBy` is on by default). Express sets this
// header itself, and advertising the framework and its version is free
// reconnaissance.
app.disable('x-powered-by');

app.use(auditContextMiddleware);

// Sentry user context configuration (#770)
app.use((req, res, next) => {
  if (req.auditContext) {
    Sentry.setUser({
      id: req.auditContext.userId || undefined,
      tenantId: req.auditContext.tenantId || undefined,
      ip_address: req.ip,
    });
  }
  next();
});

// ─── Middleware ────────────────────────────────────────────────────────────
//
// Order matters, and it is the reason #663 existed: a router mounted above this
// block gets none of it. Everything below `app.use('/api', …)` is therefore
// declared after the whole stack, with no exceptions.

// Security headers (#896).
//
// `helmet` has been in this file's require block, and in package.json, since
// before #792 — and was never called. Not once. So the API shipped with no
// CSP, no `nosniff`, no `Referrer-Policy`, no frame protection and no HSTS,
// while the comment above the dashboard mount below describes "no security
// headers" as the bug #663 fixed. The mount was moved under the middleware
// stack; the headers were never put into the stack.
//
// Two directives are set explicitly rather than left at their defaults, because
// the defaults are wrong for this particular server:
//
//   - The CSP default is tuned for a server that returns HTML. This one returns
//     JSON to a separate frontend origin, so nothing it serves should ever load
//     a script, a style or a frame. `default-src 'none'` says exactly that, and
//     `frame-ancestors 'none'` is what actually stops an authenticated response
//     being framed — `X-Frame-Options` is the legacy half of the same idea and
//     Helmet still sends it.
//
//   - `Cross-Origin-Resource-Policy` defaults to `same-origin` in Helmet 8,
//     which would block the frontend on :5173 from reading responses from the
//     API on :5000 *even though* the CORS config below allows the origin. The
//     two mechanisms are separate checks and both have to pass. `cross-origin`
//     here leaves the origin decision to `corsOptions`, which is the one place
//     it should be made.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

// HTTP access logging (#723, mounted in #896).
//
// `morgan` was required at the top of this file and never used either, so there
// was no access log at all — which is why there is no way to tell from a
// deployed environment's logs whether any of the boot failures above were ever
// reached. `requestLogger` is the replacement #723 wrote for exactly this and
// then did not mount: it records method, path, status, duration, ip, userId and
// tenantId through the same winston pipeline as everything else, rather than
// morgan's separate plaintext stream.
//
// Skipped under test so a suite firing a few hundred requests does not bury its
// own output.
if (process.env.NODE_ENV !== 'test') {
  app.use(requestLogger);
}

app.use(cookieParser());

// CORS configuration — restrict strictly to frontend origin
const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. server-to-server, unit tests)
    if (!origin) {
      return callback(null, true);
    }
    if (origin === allowedOrigin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Global Input Sanitization (Issue #727)
// Must be placed AFTER body parsers but BEFORE route handlers
const sanitizeMiddleware = require('./middlewares/sanitize.middleware');
app.use(sanitizeMiddleware);
app.use(cors(corsOptions));

const redactionMiddleware = require('./middlewares/redaction.middleware');
app.use(redactionMiddleware);

const responseMiddleware = require('./middlewares/response.middleware');
app.use(responseMiddleware);

// Require request body for state-changing methods
app.use('/api', requireBody);

// Prometheus HTTP metrics (#765). Mounted once, above the route table, so
// every request is captured. Must stay above `app.use('/api', …)`.
app.use(trackHttpMetrics);

// ─── Routes ────────────────────────────────────────────────────────────────

// Prometheus metrics (#765). Public on purpose — scrapers carry no auth token —
// so it sits beside the root probe, above the /api auth/rate-limit stack.
app.get('/metrics', metricsHandler);

app.get('/', (req, res) => res.send('PaySphere API is running...'));

// Swagger API documentation configuration (#767)
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PaySphere REST API',
      version: '1.0.0',
      description:
        'Interactive API documentation for PaySphere backend services.',
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development Server',
      },
    ],
  },
  apis: ['./src/routes/*.js', './src/app.js', './backend/src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health probes (#913) - outside /api so Kubernetes and Prometheus can reach without auth.
const healthRoutes = require('./routes/health.routes');
app.use(healthRoutes);

app.use('/api', generalRateLimiter);
app.use('/api/auth', userRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/employee-portal', employeePortalRoutes);
app.use('/api/schedules', schedulerRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/settlements', settlementRoutes);
app.use('/api/loans', loanRoutes);

// The archive browser for soft-deleted employees (#759). Mounted by one of the
// two duplicated route tables and not the other.
app.use('/api/archive', archiveRoutes);

// #590 shipped the controller, the models, the router and a WorkflowBuilder
// page, and never registered the router — so the whole engine was a 404 and the
// builder had nothing to talk to. It could not simply be added either: the
// router destructured a `verifyToken` export that does not exist, so mounting
// it threw at require time and took the process down at boot (#614).
app.use('/api/workflows', workflowRoutes);

app.use('/api', salaryHistoryRoutes);
app.use('/api/flashcards', flashcardRoutes);
app.use('/api/email', emailRoutes);

// Webhook endpoints (#474) — an admin lets an external system subscribe to
// payroll and employee events. The controller and models were written in #645
// but never mounted here, so the whole feature was a 404.
app.use('/api/webhooks', webhookRoutes);

// HRMS integrations (#954). `src/integrations/` has held a working adapter
// layer — BambooHR, Workday, a registry that validates them — with no
// controller, no router and no mount, so `registry.getAdapter()` was reachable
// from no request and `IntegrationConfig` had no writer.
app.use('/api/integrations', integrationRoutes);

// Custom role management (#475) — the owner role manages the permission sets
// that decide what every other account can do. Mounted once, after the security
// middleware, like the rest of the API.
app.use('/api/roles', roleRoutes);

// Mounted here, once (#663).
//
// This router used to be mounted twice: on line 23, immediately after
// `express()` and therefore *above* the cookie parser, Helmet, the request
// logger, CORS, the JSON body parser, the rate limiter and `requireBody` — and
// again down here. Express serves the first mount that matches, so the copy
// that won was the one with no middleware in front of it. Dashboard traffic got
// no security headers, no origin check, no rate limit and no access log, and
// `POST /api/dashboard/layout` threw a TypeError destructuring an unparsed
// `req.body` on every call.
//
// Worth noting what #663 could and could not fix: moving the mount below the
// stack is only worth something if the stack contains what the comment claims.
// Helmet and morgan were both required at the top of this file and neither was
// ever called, so until #896 *no* route had security headers or an access log —
// the dashboard was not a special case, it was just the one that got noticed.
app.use('/api/dashboard', dashboardRoutes);

// The in-app notification centre (#440). The other half of the duplicate.
app.use('/api/notifications', notificationRoutes);

// Monthly activity updates (#509). Router and controller both written, never
// mounted by either copy of the route table — the same omission as #614 and
// #474, found while reconciling the two.
app.use('/api/monthly-updates', monthlyUpdatesRoutes);

// Expense claims (#719). Also never mounted by either copy. The endpoints
// answer 403 until the EXPENSE permissions exist (#794); mounting them is the
// part that belongs to this file.
app.use('/api/expenses', expenseRoutes);

// Payroll variance reports, budget tracking, annual forecasting (#915).
app.use('/api/reports', varianceReportRoutes);

// Full-text search via Elasticsearch (#771). Returns ranked results across
// employees, payroll, and audit-log indices without exposing raw Mongo regex.
app.use('/api/search', searchRoutes);

// Statutory compliance: Form 16 certificates and Form 24Q returns (#933).
// The controller has been in the tree since #933 with no router and no mount,
// so there was no URL that reached it — and consequently nobody noticed that
// neither of the two models it requires had been committed (#951).
app.use('/api/compliance', complianceRoutes);

// ─── Feature routers that were never mounted (#1009) ───────────────────────
//
// Eleven of them, each shipped complete — router, controller, models, utils,
// and in most cases a frontend page calling it — and never added to this table.
// This is the fifth time: #614 (workflows), #474 (webhooks), #954
// (integrations), #509 (monthly updates) and #719 (expenses) are all the same
// omission, and all documented above. `app.routeMounting.test.js` now derives
// its expectations by walking `routes/` instead of from a hand-written list, so
// the next router to arrive without a mount fails CI rather than going quiet
// for a few months.
//
// The paths are not a free choice. Each router defines its own sub-paths and
// the frontend pages already call specific URLs, so the mount is whatever makes
// the two line up. Most are unsurprising; the two that are not are called out.

app.use('/api/assets', assetRoutes);
app.use('/api/vendors', vendorRoutes);

// POSH grievances (#958). Gated by `requireICC` rather than `requirePermission`
// — the committee is deliberately not the same population as "HR", and admins
// are locked out on purpose for anti-retaliation reasons.
app.use('/api/grievances', grievanceRoutes);

app.use('/api/tax-proofs', taxProofRoutes);
app.use('/api/appraisals', appraisalRoutes);
app.use('/api/contracts', contractRoutes);

// Plural. `BudgetPlanner.jsx` posts to `/api/forecasts/generate` and the router
// defines `/generate`, so `/api/forecast` would leave the page on a 404.
app.use('/api/forecasts', forecastRoutes);

app.use('/api/accounting', accountingRoutes);

// Not `/api/client-invoices`. This router defines `/invoices`,
// `/invoices/:id/payment`, `/invoices/dashboard` and `/invoices/aging-report`
// internally, and `ClientInvoices.jsx` calls
// `/api/clients/invoices/dashboard` — so the mount is the `/api/clients` half
// of that path and the router supplies the rest.
app.use('/api/clients', clientInvoiceRoutes);

// Same shape: the router defines `/roster`, `/templates` and `/swap/...`, and
// `Roster.jsx` calls `/api/shifts/roster`.
app.use('/api/shifts', shiftRosterRoutes);

app.use('/api/pyqs', pyqRoutes);

// Salary disbursement (#1075). The router owns `/batches` and `/profiles`.
app.use('/api/disbursements', disbursementRoutes);

// Training and certification (#1076). The router owns `/courses`,
// `/enrollments`, `/compliance` and `/my-training`.
app.use('/api/training', trainingRoutes);

// Equity (#1073). The router owns `/schemes`, `/grants` and `/my-grants`, so
// the prefix carries no noun of its own.
app.use('/api/esop', esopRoutes);

// Recruitment (#1074). The router owns `/requisitions`, `/candidates` and
// `/analytics`, so the prefix carries no noun of its own.
app.use('/api/recruitment', recruitmentRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────
// Must be registered AFTER all valid routes but BEFORE error handlers.
// Uses NotFoundError if available, otherwise falls back to a standard Error
// so the centralized error handler can format the response consistently.
app.use((req, res, next) => {
  let err;
  try {
    const { NotFoundError } = require('./utils/apiError');
    err = new NotFoundError(`Cannot find ${req.originalUrl} on this server!`);
  } catch {
    // Fallback if apiError module doesn't exist yet
    err = new Error(`Cannot find ${req.originalUrl} on this server!`);
    err.statusCode = 404;
  }
  next(err);
});

// ─── Error handlers ────────────────────────────────────────────────────────

// CORS error handler — return 403 for blocked origins
app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ message: 'CORS not allowed' });
  }
  next(err);
});

// Multer error handler — return 400 for file upload issues
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const maxMB = MAX_FILE_SIZE / (1024 * 1024);
      return res
        .status(400)
        .json({ message: `File too large. Maximum size is ${maxMB}MB.` });
    }
    return res.status(400).json({ message: 'File upload error' });
  }
  next(err);
});

// Sentry error handler — must be registered before general error handlers (#770)
Sentry.setupExpressErrorHandler(app);

// Centralized error handler
app.use(errorHandler);

module.exports = app;
