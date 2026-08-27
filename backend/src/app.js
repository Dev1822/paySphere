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
const publicVerificationRoutes = require('./routes/publicVerification.routes');
const userRoutes = require('./routes/user.routes');
const employeeRoutes = require('./routes/employee.routes');
const employeeImportRoutes = require('./routes/employeeImport.routes');
const payrollRoutes = require('./routes/payroll.routes');
const payrollApprovalRoutes = require('./routes/payrollApproval.routes');
const payrollComparisonRoutes = require('./routes/payrollComparison.routes');
const employeeCompensationRoutes = require('./routes/employeeCompensation.routes');

// Statutory bonus under the Payment of Bonus Act, 1965 (#1346). Next to the
// payroll routers because it is a payment to employees, and separate from them
// because it is not payroll: the amount is fixed by statute rather than by the
// company, it is computed on a wage capped by section 12 rather than on the one
// that is paid, and it produces a Rule 5 register.
const statutoryBonusRoutes = require('./routes/statutoryBonus.routes');

// Minimum Wages Act, 1948 (#1698). Next to the statutory bonus router because
// the two are the same kind of thing — a floor the statute sets rather than a
// figure the company chooses — and because section 12 of the Payment of Bonus
// Act computes on the higher of ₹7,000 and the applicable minimum wage, so this
// is where that number now comes from.
const minimumWagesRoutes = require('./routes/minimumWages.routes');

// Payment of Wages Act, 1936 (#1767). Next to the minimum wages router because
// the two are opposite halves of one question — that one sets the floor under
// what must be paid, this one the ceiling on what may be taken back out — and
// because section 7(3)'s ceiling is measured on the wages that router certifies.
const wageDeductionRoutes = require('./routes/wageDeductions.routes');
const reportsRoutes = require('./routes/reports.routes');
const auditRoutes = require('./routes/audit.routes');
const attendanceRoutes = require('./routes/attendance.routes');

// Working hours compliance (#1702). Next to attendance because it reads that
// ledger, and separate from it because the questions differ: attendance answers
// "was this person here", and this answers "is this shift pattern lawful" —
// which is a question about the employer rather than about the employee.
const workingHoursRoutes = require('./routes/workingHours.routes');
const settlementRoutes = require('./routes/settlement.routes');

// Employees' Compensation Act, 1923 (#1699). Next to settlements because both
// answer "what is owed to this person now that something has happened to the
// employment", and apart from them because a settlement is what the company
// agreed to pay and this is what a statute says it must — computed from the
// employee's age through a Schedule IV commutation factor, on a wage capped at
// ₹15,000.
//
// Named for the injury, not the Act: `employeeCompensation.routes` is already
// taken by the longitudinal compensation timeline, which is a different subject
// wearing three quarters of the same name.
const injuryCompensationRoutes = require('./routes/injuryCompensation.routes');

// Employees' State Insurance Act, 1948 (#1768). Next to the injury
// compensation router because section 53 decides between them: a claim under
// the Employees' Compensation Act is barred where ESI covers the same injury,
// so which router applies to an employee is settled by the coverage question
// this one answers.
const esiRoutes = require('./routes/esi.routes');
const severanceRoutes = require('./routes/severance.routes');

// Gratuity actuarial valuation (#1344). Next to settlements on purpose: the
// two are the same statute seen from opposite ends. `settlement.routes` pays
// gratuity to somebody who is leaving; this one measures what is still owed to
// everybody who has not.
const gratuityRoutes = require('./routes/gratuity.routes');

// Employees' Pension Scheme, 1995 (#1769). Next to the gratuity router because
// both value a defined benefit on service and a final salary. Apart from it
// because gratuity is the company's own liability and EPS is a funded scheme
// run by the EPFO, where the employer's obligation ends at the ₹1,250
// remittance — putting them together would suggest a pension liability the
// company does not carry.
const epsRoutes = require('./routes/eps.routes');
const loanRoutes = require('./routes/loan.routes');
const schedulerRoutes = require('./routes/scheduler.routes');
const employeePortalRoutes = require('./routes/employeePortal.routes');
const workflowRoutes = require('./routes/workflow.routes');
const salaryHistoryRoutes = require('./routes/salaryHistory.routes');
const dashboardRoutes = require('./routes/dashboard.routes');

// Pay equity analytics (#1347). Next to the dashboard and stats routers because
// it is analysis over the same directory, and behind its own permissions
// because it is the only part of the product that reads declared gender.
const payEquityRoutes = require('./routes/payEquity.routes');
const statsRoutes = require('./routes/stats.routes');
const departmentsRoutes = require('./routes/departments.routes');
const flashcardRoutes = require('./routes/flashcard.routes');
const webhookRoutes = require('./routes/webhook.routes');
const integrationRoutes = require('./routes/integration.routes');
const archiveRoutes = require('./routes/archive.routes');
const documentVaultRoutes = require('./routes/documentVault.routes');
const notificationRoutes = require('./routes/notification.routes');
const monthlyUpdatesRoutes = require('./routes/monthlyUpdates.routes');
const expenseRoutes = require('./routes/expense.routes');
const fringeBenefitsRoutes = require('./routes/fringeBenefits.routes');

// Labour Welfare Fund (#1701). There is no central Act — fifteen or so state
// enactments that agree on almost nothing — so the state rule is data and this
// router is the calendar and the register built on top of it.
const labourWelfareFundRoutes = require('./routes/labourWelfareFund.routes');
const varianceReportRoutes = require('./routes/varianceReport.routes');
const searchRoutes = require('./routes/search.routes');
const emailRoutes = require('./routes/email.routes');
const complianceRoutes = require('./routes/compliance.routes');
const forexRoutes = require('./routes/forex.routes');
const announcementRoutes = require('./routes/announcement.routes');
const companyEventRoutes = require('./routes/companyEvent.routes');

// The eleven routers #1009 found unmounted. Each one had a router, a
// controller, its models and — for most of them — a finished frontend page, and
// no line anywhere in this file, so every endpoint they define answered 404.
// Roughly 1,600 lines of controller that no request could reach.
//
// The mount paths are below, next to the mounts themselves, because two of them
// are not the obvious choice and the reason belongs where someone would look.
const assetRoutes = require('./routes/asset.routes');
const vendorRoutes = require('./routes/vendor.routes');

// Contract Labour (Regulation and Abolition) Act, 1970 (#1700). Next to the
// vendor router because a contractor is one, and separate from it because this
// is not about the counterparty to an invoice: it is the principal employer's
// liability for that contractor's workmen, of whom there may be four hundred
// behind one vendor row.
const contractLabourRoutes = require('./routes/contractLabour.routes');

// Apprentices Act, 1961 (#1771). Next to the contract labour router because
// both are about people on the site who are not on the payroll, and apart from
// it because the law treats them oppositely: a contract worker *is* a worker
// and is covered by provident fund and ESI through the principal employer,
// while section 18 says an apprentice is not.
const apprenticeshipRoutes = require('./routes/apprenticeships.routes');
const grievanceRoutes = require('./routes/grievance.routes');
const taxProofRoutes = require('./routes/taxProof.routes');

// Perquisite valuation under Rule 3 (#1770). Next to the tax-proof router
// because both decide what a Form 16 says — that one by what an employee
// declares, this one by what the employer provided.
const perquisiteRoutes = require('./routes/perquisites.routes');

// Leave Travel Allowance (#1345). Next to the tax proofs because it is the same
// act from the employee's side — file a document, get an exemption — and a
// completely different rule set behind it: the entitlement is a four-year
// statutory block rather than a financial year.
const ltaRoutes = require('./routes/lta.routes');
const appraisalRoutes = require('./routes/appraisal.routes');
const contractRoutes = require('./routes/contract.routes');
const forecastRoutes = require('./routes/forecast.routes');
const accountingRoutes = require('./routes/accounting.routes');
const clientInvoiceRoutes = require('./routes/clientInvoice.routes');
const shiftRosterRoutes = require('./routes/shiftRoster.routes');
const shiftPreferenceRoutes = require('./routes/shiftPreference.routes');
const successionRoutes = require('./routes/succession.routes');
const pyqRoutes = require('./routes/pyq.routes');

// Business travel, per-diem and advance settlement (#1077). `expenseClaim` is
// for money already spent; a trip is pre-approved, funded in advance, and its
// per-diem has no receipt at all — so an unspent advance was a receivable
// nothing in the product tracked.
const travelRoutes = require('./routes/travel.routes');

// International assignments (#1348). Next to travel and emphatically not part
// of it: `travel.routes` settles a trip in per-diems over a few weeks, while an
// assignment runs for years, changes where the employee is tax resident and is
// the reason the employer files in a second country. The two share a plane and
// nothing else.
const assignmentRoutes = require('./routes/assignment.routes');

// Stock option schemes, grants, vesting and exercises (#1073). Equity was the
// one component of total compensation with no model, no route and no
// calculator — and exercising an option is a taxable perquisite the employer
// has to withhold on, so it is payroll's business and not just HR's.
const esopRoutes = require('./routes/esop.routes');
const esppRoutes = require('./routes/espp.routes');
const cryptoRouter = require('./services/CryptoPayrollService').default;

// Requisitions, the candidate pipeline and interview scorecards (#1074). The
// product covered an employee's life from the offer letter onwards and nothing
// before it — `OfferLetterBuilder.jsx` types in a name and a salary by hand
// because there was no candidate record to draw them from.
const recruitmentRoutes = require('./routes/recruitment.routes');
const referralBonusRoutes = require('./routes/referralBonus.routes');

// Salary disbursement (#1075). Payroll was computed to the rupee and then
// stopped: `payroll.model.js` has a `disbursed` status and nothing in the
// product produced the bank file that actually moves the money.
const disbursementRoutes = require('./routes/disbursement.routes');

// Leave year-end closure (#1159). The leave module has had models and two pure
// engines since #646 and never a controller or a router, so none of it has
// been reachable over HTTP — `calculateCarryForward()` is called from nowhere
// and `maxCarryForward` has never had an effect on anything.
const leaveClosureRoutes = require('./routes/leaveClosure.routes');
const treasuryRoutes = require('./routes/treasury.routes');
const regionalTaxRoutes = require('./routes/regionalTax.routes');
const salaryAdjustmentRoutes = require('./routes/salaryAdjustment.routes');
const deferredCompensationRoutes = require('./routes/deferredCompensation.routes');
const pensionRoutes = require('./routes/pension.routes');
const fbpRoutes = require('./routes/fbp.routes');
const teamRoutes = require('./routes/team.routes');
const healthChallengeRoutes = require('./routes/healthChallenge.routes');
const {
  tenantRouter: subscriptionTenantRoutes,
  adminRouter: subscriptionAdminRoutes,
} = require('./routes/subscription.routes');

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
const { maskPII } = require('./middlewares/dataMask.middleware');

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
app.use('/api', maskPII);

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

const responseEnvelopeMiddleware = require('./middlewares/responseEnvelope.middleware');
app.use(responseEnvelopeMiddleware);

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
app.use('/api/employees', employeeImportRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/payroll', payrollApprovalRoutes);
app.use('/api/payroll-comparison', payrollComparisonRoutes);
app.use('/api/compensation', employeeCompensationRoutes);

// #1346. Its own prefix rather than a sub-path of `/api/payroll`: the
// discretionary bonus on a payroll row and the statutory bonus under the Act
// are different money with different authorities, and sharing a namespace
// invites them to be confused. The router owns `/computations`, `/preview` and
// `/ledger`.
app.use('/api/statutory-bonus', statutoryBonusRoutes);

// #1698. Its own prefix rather than a sub-path of `/api/compliance`: the
// compliance router is about what gets filed with the tax authorities, and this
// is about what is paid to the employee before any of that. The router owns
// `/notifications`, `/preview` and `/assessments`.
app.use('/api/minimum-wages', minimumWagesRoutes);

// #1767. Its own prefix rather than a sub-path of `/api/payroll`: a payroll row
// is what one person was paid and a finding here is about what the employer was
// allowed to take from it, which is a question about the employer. The router
// owns `/rules`, `/assessment`, `/registers` and `/deferred`.
app.use('/api/wage-deductions', wageDeductionRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/employee-portal', employeePortalRoutes);
app.use('/api/schedules', schedulerRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/attendance', attendanceRoutes);

// #1702. Its own prefix rather than a sub-path of `/api/attendance`: an
// attendance row is about one person's day and a finding here is about a shift
// pattern across a quarter. The router owns `/limits`, `/assessment` and
// `/assessments`.
app.use('/api/working-hours', workingHoursRoutes);
app.use('/api/settlements', settlementRoutes);

// #1699. Its own prefix rather than a sub-path of `/api/settlements`: a
// settlement is paid to somebody who is leaving, and a compensation claim for
// temporary disablement is paid to somebody who is still on the rolls and
// coming back. The router owns `/schedules`, `/preview` and `/claims`.
app.use('/api/injury-compensation', injuryCompensationRoutes);

// #1768. Its own prefix rather than a sub-path of `/api/compliance`: the
// compliance router files what the tax authorities want, and this is a
// contribution to a benefit scheme the employee draws on. The router owns
// `/rules`, `/assessment`, `/coverage` and `/returns`.
app.use('/api/esi', esiRoutes);

// #1344. The router owns `/assumptions`, `/preview`, `/valuations` and
// `/employees/:employeeId`, so the prefix carries no noun of its own.
app.use('/api/gratuity', gratuityRoutes);

// #1769. Its own prefix rather than a sub-path of `/api/gratuity`, for the
// reason above. The router owns `/assumptions`, `/wage-history`, `/preview`,
// `/valuations` and `/members/:employeeId`.
app.use('/api/eps', epsRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/treasury', treasuryRoutes);
app.use('/api/regional-tax', regionalTaxRoutes);
app.use('/api/salary-adjustments', salaryAdjustmentRoutes);
app.use('/api/deferred-compensation', deferredCompensationRoutes);
app.use('/api/pension', pensionRoutes);

// The archive browser for soft-deleted employees (#759). Mounted by one of the
// two duplicated route tables and not the other.
app.use('/api/archive', archiveRoutes);

// Employee Document Vault
app.use('/api/document-vault', documentVaultRoutes);

// #590 shipped the controller, the models, the router and a WorkflowBuilder
// page, and never registered the router — so the whole engine was a 404 and the
// builder had nothing to talk to. It could not simply be added either: the
// router destructured a `verifyToken` export that does not exist, so mounting
// it threw at require time and took the process down at boot (#614).
app.use('/api/workflows', workflowRoutes);

app.use('/api', salaryHistoryRoutes);
app.use('/api/flashcards', flashcardRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/forex', forexRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/events', companyEventRoutes);

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
app.use('/api/public/verification', publicVerificationRoutes);

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
app.use('/api/stats', statsRoutes);

// #1347. The router owns `/preview`, `/reports`, `/compa-ratio` and `/bands`.
app.use('/api/pay-equity', payEquityRoutes);
app.use('/api/departments', departmentsRoutes);

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
app.use('/api/fringe-benefits', fringeBenefitsRoutes);

// #1701. The router owns `/rules`, `/preview`, `/calendar` and
// `/contributions`.
app.use('/api/labour-welfare-fund', labourWelfareFundRoutes);

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

// #1700. The router owns `/contractors`, `/deployments`, `/assessment`,
// `/returns` and `/registers`.
app.use('/api/contract-labour', contractLabourRoutes);

// #1771. Its own prefix rather than a sub-path of `/api/contract-labour`, for
// the reason above — filing apprentices there would attach exactly the
// liabilities section 18 removes. The router owns `/rules`, `/strength`,
// `/apprentices` and `/assessments`.
app.use('/api/apprenticeships', apprenticeshipRoutes);

// POSH grievances (#958). Gated by `requireICC` rather than `requirePermission`
// — the committee is deliberately not the same population as "HR", and admins
// are locked out on purpose for anti-retaliation reasons.
app.use('/api/grievances', grievanceRoutes);

app.use('/api/tax-proofs', taxProofRoutes);

// #1770. Its own prefix rather than a sub-path of `/api/compliance`: the
// compliance router files what has been withheld, and this decides how much
// there was to withhold on. The router owns `/rules`, `/grants`, `/preview`,
// `/statements` and `/employees/:employeeId`.
app.use('/api/perquisites', perquisiteRoutes);

// #1345. The router owns `/claims`, `/preview`, `/entitlement`, `/my-claims`,
// `/queue` and `/summary/:employeeId`.
app.use('/api/lta', ltaRoutes);
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
app.use('/api/shift-preferences', shiftPreferenceRoutes);

// Succession Planning Hub
app.use('/api/succession', successionRoutes);

app.use('/api/pyqs', pyqRoutes);

// Business travel (#1077). The router owns `/policies`, `/requests`,
// `/advances` and `/my-trips`.
app.use('/api/travel', travelRoutes);

// #1348. The router owns `/`, `/:id`, `/:id/presence`, `/:id/cost-projection`,
// `/:id/gross-up` and `/:id/settlements`.
app.use('/api/assignments', assignmentRoutes);

// Equity (#1073). The router owns `/schemes`, `/grants` and `/my-grants`, so
// the prefix carries no noun of its own.
app.use('/api/esop', esopRoutes);
app.use('/api/espp', esppRoutes);
app.use('/api', cryptoRouter);

// Recruitment (#1074). The router owns `/requisitions`, `/candidates` and
// `/analytics`, so the prefix carries no noun of its own.
app.use('/api/recruitment', recruitmentRoutes);

// Referral Bonus Tracking
app.use('/api/referral-bonuses', referralBonusRoutes);

// Salary disbursement (#1075). The router owns `/batches` and `/profiles`.
app.use('/api/disbursements', disbursementRoutes);

// Subscription & Feature Gating (#1113)
// Tenant routes: plan info, upgrade, cancel, usage
app.use('/api/tenant', subscriptionTenantRoutes);
// Admin routes: list all subscriptions, aggregate stats
app.use('/api/admin', subscriptionAdminRoutes);

// Leave year-end closure (#1159). The router owns `/policies`, `/preview`,
// `/run` and `/history`. Not mounted at `/api/leave`: this router closes a
// leave year and does not manage leave requests, so taking the whole `/leave`
// prefix would claim a namespace it does not implement.
app.use('/api/leave-closure', leaveClosureRoutes);
app.use('/api/fbp', fbpRoutes);
app.use('/api/team', teamRoutes);

// Company Policy Management & Employee Acknowledgment. Admins create and
// version policies; employees acknowledge them; analytics track compliance.
app.use('/api/policies', companyPolicyRoutes);

// Peer Nomination & Awards (#peer-nominations). Employee-driven recognition
// with category configuration, cycle management, voting, review, and analytics.
app.use('/api/peer-nominations', peerNominationRoutes);

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

// CORS, Multer and JSON SyntaxError handler
app.use((err, req, res, next) => {
  // CORS error handler — return 403 for blocked origins
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ message: 'CORS not allowed' });
  }

  // Multer error handler — return 400 for file upload issues
  if (err instanceof multer.MulterError || err.code === 'LIMIT_FILE_SIZE') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const maxMB = MAX_FILE_SIZE / (1024 * 1024);
      return res
        .status(400)
        .json({ message: `File too large. Maximum size is ${maxMB}MB.` });
    }
    return res.status(400).json({ message: 'File upload error' });
  }

  // JSON parse error handler — return 400 for invalid JSON
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ message: 'Invalid JSON payload format' });
  }

  next(err);
});

// Sentry error handler — must be registered before general error handlers (#770)
Sentry.setupExpressErrorHandler(app);

// Centralized error handler
app.use(errorHandler);

module.exports = app;
