/**
 * The route table is the union of the two copies, and stays that way.
 *
 * #785's merge left `app.js` with two complete route tables that disagreed with
 * each other: the first mounted `/api/archive` and not `/api/notifications`,
 * the second the reverse, and neither mounted `/api/expenses` or
 * `/api/monthly-updates`. Express serves the first match, so which features
 * existed came down to which copy happened to be higher in the file — and
 * nothing failed, the endpoints just quietly 404'd (#792).
 *
 * These assertions are deliberately about *reachability*, not about behaviour:
 * a mounted route that answers 401 or 403 is mounted, and that is the property
 * a merge can silently destroy. What each router does with an authenticated
 * request is its own suite's business.
 */

const request = require('supertest');

// The rate limiters are stubbed for the same reason the payroll and workflow
// route suites stub them: they are IP-keyed and stateful across requests, so a
// suite that fires a few dozen requests will start getting 429s partway through
// and fail on the *second* run rather than the first.
jest.mock('../middlewares/rateLimiter.middleware', () => ({
  generalRateLimiter: (req, res, next) => next(),
  authRateLimiter: (req, res, next) => next(),
  writeRateLimiter: (req, res, next) => next(),
  standardLimiter: (req, res, next) => next(),
  strictLimiter: (req, res, next) => next(),
}));

// `otplib@13` pulls in `@scure/base`, which is pure ESM with no CommonJS build,
// and this project has no babel preset configured to transform it — so *any*
// suite that reaches `user.controller.js` dies on `Unexpected token 'export'`
// before it runs a line of its own. That is a separate problem from #792 and is
// not fixed here; stubbing the two functions the controller uses keeps this
// suite about route mounting.
jest.mock('otplib', () => ({
  authenticator: {
    generateSecret: () => 'TESTSECRET',
    keyuri: () => 'otpauth://totp/test',
    verify: () => false,
  },
}));

// The same class of problem one layer out, and the reason this suite has never
// actually run (#1008):
//
//     sanitize.middleware → utils/sanitizers → jsdom → parse5 / entities /
//     @asamuzakjp/css-color …
//
// all pure ESM, none of it covered by `transformIgnorePatterns`. The suite died
// on `Unexpected token 'export'` before its first assertion, which reads as a
// broken environment rather than as a failing test — so the route-mounting
// guard #792 added to stop routers going missing was itself missing, and two
// unrelated boot failures sat behind it undetected.
//
// `app.security.test.js` already carries this stub with the same reasoning.
// Pass-through, so it cannot weaken what is asserted below: sanitisation has no
// say in whether a route is mounted.
jest.mock(
  '../middlewares/sanitize.middleware',
  () => (req, res, next) => next(),
);

const app = require('../app');

/**
 * Every path prefix the product expects to be able to reach, with a method and
 * path that exists on that router.
 */
const MOUNTED_ROUTES = [
  ['/api/auth', 'post', '/api/auth/login'],
  ['/api/section-89-relief', 'get', '/api/section-89-relief/rules'],
  ['/api/employees', 'get', '/api/employees'],
  ['/api/payroll', 'get', '/api/payroll/summary'],
  ['/api/statutory-bonus', 'get', '/api/statutory-bonus/ledger'],
  ['/api/minimum-wages', 'get', '/api/minimum-wages/notifications'],
  ['/api/reports', 'get', '/api/reports/analytics'],
  ['/api/employee-portal', 'get', '/api/employee-portal/profile'],
  ['/api/schedules', 'get', '/api/schedules'],
  ['/api/audit-logs', 'get', '/api/audit-logs'],
  ['/api/attendance', 'get', '/api/attendance'],
  ['/api/epf-remittance', 'get', '/api/epf-remittance/rules'],

  ['/api/wage-deductions', 'get', '/api/wage-deductions/rules'],
  ['/api/working-hours', 'get', '/api/working-hours/limits'],
  ['/api/assignments', 'get', '/api/assignments'],
  ['/api/settlements', 'get', '/api/settlements'],
  ['/api/suspensions', 'get', '/api/suspensions/rules'],
  ['/api/injury-compensation', 'get', '/api/injury-compensation/claims'],
  ['/api/layoffs', 'get', '/api/layoffs/rules'],
  ['/api/esi', 'get', '/api/esi/rules'],
  ['/api/gratuity', 'get', '/api/gratuity/valuations'],
  ['/api/eps', 'get', '/api/eps/valuations'],
  ['/api/professional-tax', 'get', '/api/professional-tax/rules'],

  ['/api/loans', 'get', '/api/loans'],
  ['/api/archive', 'get', '/api/archive/employees'],
  ['/api/workflows', 'get', '/api/workflows'],
  ['/api/flashcards', 'get', '/api/flashcards/my-decks'],
  ['/api/holidays', 'get', '/api/holidays/rules'],
  ['/api/contract-labour', 'get', '/api/contract-labour/contractors'],
  ['/api/apprenticeships', 'get', '/api/apprenticeships/rules'],
  ['/api/migrant-workmen', 'get', '/api/migrant-workmen/rules'],
  ['/api/webhooks', 'get', '/api/webhooks'],
  ['/api/dashboard', 'get', '/api/dashboard/layout'],
  ['/api/pay-equity', 'get', '/api/pay-equity/reports'],
  ['/api/young-persons', 'get', '/api/young-persons/rules'],

  ['/api/labour-welfare-fund', 'get', '/api/labour-welfare-fund/rules'],
  ['/api/standing-orders', 'get', '/api/standing-orders/rules'],
  ['/api/notifications', 'get', '/api/notifications'],
  [
    '/api/monthly-updates',
    'get',
    '/api/monthly-updates/000000000000000000000000',
  ],
  ['/api/expenses', 'get', '/api/expenses'],

  // Mounted all along, but never probed here — the coverage gap the
  // filesystem-derived checks below turned up while #1009 was being written.
  // Each of these is a router the hand-written list simply never mentioned, so
  // nothing would have noticed if a merge dropped one.
  ['/api/roles', 'get', '/api/roles'],
  ['/api/search', 'get', '/api/search'],
  ['/api/integrations', 'get', '/api/integrations'],
  ['/api/compliance', 'get', '/api/compliance/config'],
  ['/api/aggregator-contribution', 'get', '/api/aggregator-contribution/rules'],
  ['/api/notice-of-change', 'get', '/api/notice-of-change/rules'],
  ['/api/email', 'post', '/api/email/webhooks'],

  // Mounted in #1009. Each of these had a router, a controller, models and in
  // most cases a frontend page, and no entry in the route table.
  ['/api/assets', 'get', '/api/assets'],
  ['/api/edli', 'get', '/api/edli/rules'],

  ['/api/vendors', 'get', '/api/vendors/000000000000000000000000/ledger'],
  ['/api/construction-cess', 'get', '/api/construction-cess/rules'],
  ['/api/grievances', 'get', '/api/grievances/cases'],
  ['/api/tax-proofs', 'get', '/api/tax-proofs/my-proofs'],
  ['/api/perquisites', 'get', '/api/perquisites/rules'],
  ['/api/lta', 'get', '/api/lta/queue'],
  ['/api/appraisals', 'get', '/api/appraisals/my-review'],
  ['/api/international-workers', 'get', '/api/international-workers/rules'],
  ['/api/establishments', 'get', '/api/establishments/rules'],
  ['/api/contracts', 'post', '/api/contracts/issue'],
  ['/api/forecasts', 'get', '/api/forecasts'],
  ['/api/accounting', 'get', '/api/accounting/mappings'],
  ['/api/vacancy-notification', 'get', '/api/vacancy-notification/rules'],

  ['/api/clients', 'get', '/api/clients/invoices/dashboard'],
  ['/api/shifts', 'get', '/api/shifts/roster'],
  ['/api/pyqs', 'get', '/api/pyqs'],

  // Mounted in #1077.
  ['/api/travel', 'get', '/api/travel/requests'],

  // Mounted in #1073. Restored along with the permissions and the app.js mount:
  // #1083's merge kept only its own side of the conflicts in
  // `config/permissions.js` and `app.js`, so the ESOP feature's files landed on
  // main and its wiring did not.
  ['/api/esop', 'get', '/api/esop/schemes'],

  // Mounted in #1074.
  ['/api/recruitment', 'get', '/api/recruitment/requisitions'],

  // Mounted in #1075.
  ['/api/disbursements', 'get', '/api/disbursements/batches'],

  // Mounted in #1159. The leave module's first reachable endpoint of any kind:
  // its models and two pure engines have been in the tree since #646 with no
  // controller and no router, so nothing in it has ever answered a request.
  ['/api/leave-closure', 'get', '/api/leave-closure/policies'],
  ['/api/regional-tax', 'get', '/api/regional-tax/jurisdictions'],
  ['/api/crypto/wallets', 'get', '/api/crypto/wallets'],
  ['/api/salary-adjustments', 'get', '/api/salary-adjustments'],
  ['/api/pension', 'get', '/api/pension/policies'],
];

/**
 * Routes that are unauthenticated on purpose.
 *
 * Kept as an explicit, short list rather than as a `continue` buried in the
 * loop: every entry here is a route anyone on the internet can call, so the set
 * is worth being able to read in one place and worth having to justify a
 * addition to.
 *
 *   /api/auth/login    — signing in is how you get a token.
 *   /api/email/webhooks — the delivery-status receiver the email provider POSTs
 *                        to. It has no session and cannot have one; it is
 *                        authenticated by the provider's signature, and a
 *                        request it cannot make sense of is a 400.
 *
 * `contract.routes.js` also exposes `/public/:token` for candidates who have no
 * account, secured by an unguessable magic token. It is not probed here because
 * the mount check uses the authenticated `POST /issue` instead.
 */
const PUBLIC_ROUTES = new Set(['/api/auth/login', '/api/email/webhooks']);

/**
 * The router files on disk, and the prefix each one is expected to answer on.
 *
 * The list above is hand-maintained, and that is exactly the property that let
 * #1009 happen: it asserts the routers somebody remembered to add to it. A
 * router nobody mounted is also a router nobody adds a test row for, so the
 * guard agreed with the bug.
 *
 * This map is the other direction — it starts from `routes/*.routes.js`, so a
 * new file with no mount is a failure by default rather than by diligence.
 * Adding a router means adding one line here, and the test tells you so.
 *
 * `salaryHistory` and `varianceReport` are mounted on prefixes that another
 * router already owns (`/api` and `/api/reports`), so they are recorded as
 * sharing rather than as having one of their own.
 */
const ROUTER_MOUNTS = {
  accounting: '/api/accounting',
  sectionEightyNineRelief: '/api/section-89-relief',
  appraisal: '/api/appraisals',
  archive: '/api/archive',
  asset: '/api/assets',
  assignment: '/api/assignments',
  attendance: '/api/attendance',
  audit: '/api/audit-logs',
  clientInvoice: '/api/clients',
  compliance: '/api/compliance',
  aggregatorContribution: '/api/aggregator-contribution',
  standingOrders: '/api/standing-orders',
  epfRemittance: '/api/epf-remittance',

  contract: '/api/contracts',
  apprenticeship: '/api/apprenticeships',
  contractLabour: '/api/contract-labour',
  migrantWorkmen: '/api/migrant-workmen',
  dashboard: '/api/dashboard',
  disbursement: '/api/disbursements',
  email: '/api/email',
  employee: '/api/employees',
  employeePortal: '/api/employee-portal',
  esop: '/api/esop',
  holiday: '/api/holidays',
  professionalTax: '/api/professional-tax',

  expense: '/api/expenses',
  flashcard: '/api/flashcards',
  forecast: '/api/forecasts',
  eps: '/api/eps',
  gratuity: '/api/gratuity',
  grievance: '/api/grievances',

  // Mounted at the root — `app.use(healthRoutes)` with no prefix — on purpose,
  // so Kubernetes and Prometheus can reach the probes without a token and
  // without going through the /api rate limiter. Recorded as null so the
  // "mounted in app.js" check below knows to look for the bare `app.use`
  // rather than for a path string that does not exist.
  health: null,

  injuryCompensation: '/api/injury-compensation',
  layoffs: '/api/layoffs',
  integration: '/api/integrations',
  labourWelfareFund: '/api/labour-welfare-fund',
  youngPersons: '/api/young-persons',

  leaveClosure: '/api/leave-closure',
  loan: '/api/loans',
  lta: '/api/lta',
  monthlyUpdates: '/api/monthly-updates',
  notification: '/api/notifications',
  payEquity: '/api/pay-equity',
  pension: '/api/pension',
  internationalWorker: '/api/international-workers',
  shopsEstablishments: '/api/establishments',
  payroll: '/api/payroll',
  pyq: '/api/pyqs',
  recruitment: '/api/recruitment',
  edli: '/api/edli',

  regionalTax: '/api/regional-tax',
  reports: '/api/reports',
  role: '/api/roles',
  salaryAdjustment: '/api/salary-adjustments',
  salaryHistory: '/api',
  scheduler: '/api/schedules',
  search: '/api/search',
  settlement: '/api/settlements',
  suspensions: '/api/suspensions',
  shiftRoster: '/api/shifts',
  minimumWages: '/api/minimum-wages',
  vacancyNotification: '/api/vacancy-notification',

  statutoryBonus: '/api/statutory-bonus',
  perquisite: '/api/perquisites',
  taxProof: '/api/tax-proofs',
  travel: '/api/travel',
  user: '/api/auth',
  varianceReport: '/api/reports',
  esi: '/api/esi',
  vendor: '/api/vendors',
  constructionCess: '/api/construction-cess',
  noticeOfChange: '/api/notice-of-change',
  wageDeduction: '/api/wage-deductions',
  webhook: '/api/webhooks',
  workingHours: '/api/working-hours',
  workflow: '/api/workflows',
};

describe('app route mounting (#792)', () => {
  it('serves the root probe', async () => {
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.text).toContain('PaySphere API is running');
  });

  describe.each(MOUNTED_ROUTES)('%s', (prefix, method, path) => {
    it(`is mounted (${method.toUpperCase()} ${path} is not a 404)`, async () => {
      const res = await request(app)[method](path);

      // Unauthenticated, so 401 is the expected answer from a mounted router.
      // Anything other than 404 proves the router is in the table; 404 is the
      // exact symptom the duplicated route tables produced.
      expect(res.status).not.toBe(404);
    });
  });

  it('puts authentication in front of every mounted data route', async () => {
    // The other half of #663: a router mounted above the middleware stack is
    // reachable *and* unguarded. Every one of these should refuse an
    // anonymous caller rather than answering with data.
    const unguarded = [];

    for (const [, method, path] of MOUNTED_ROUTES) {
      if (PUBLIC_ROUTES.has(path)) continue;

      // `requireBody` is mounted on /api above the routers, so a POST with no
      // body answers 400 before auth is ever consulted — which would read as
      // "this route is unauthenticated" when it is nothing of the sort. A
      // token-free body gets past it and leaves auth as the thing under test.
      const res =
        method === 'post'
          ? await request(app)[method](path).send({ probe: true })
          : await request(app)[method](path);

      // Reported as a list rather than asserted per-iteration: a bare
      // `expect(...).toContain(res.status)` inside a loop says only "400 was
      // not 401" and leaves you to work out which of thirty routes it meant.
      if (![401, 403].includes(res.status)) {
        unguarded.push(`${method.toUpperCase()} ${path} → ${res.status}`);
      }
    }

    expect(unguarded).toEqual([]);
  });

  it('applies the security headers to a route from each duplicated table', async () => {
    // `/api/archive` came from the first copy and `/api/notifications` from the
    // second. Both must now sit below Helmet — the first copy of the table in
    // the merged file was above it.
    for (const path of ['/api/archive/employees', '/api/notifications']) {
      const res = await request(app).get(path);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    }
  });

  it('rejects a state-changing request with no body', async () => {
    // `requireBody` is mounted on /api, above the routers. #663's duplicate
    // dashboard mount sat above it and threw a TypeError instead.
    const res = await request(app)
      .post('/api/dashboard/layout')
      .set('Content-Type', 'application/json');

    expect(res.status).not.toBe(500);
  });
});

/**
 * The guard that would have caught #1009.
 *
 * Everything above starts from a list a person wrote. That is fine for
 * asserting a route still works and useless for noticing one that was never
 * added — eleven routers sat unmounted for months precisely because nobody who
 * forgot the mount also remembered the test row.
 *
 * These start from the filesystem instead. `routes/*.routes.js` is the set of
 * routers that exist; anything in it that cannot be reached is a bug by
 * default.
 */
describe('every router on disk is mounted (#1009)', () => {
  const fs = require('fs');
  const path = require('path');

  const ROUTES_DIR = path.join(__dirname, '..', 'routes');

  const routerNames = fs
    .readdirSync(ROUTES_DIR)
    .filter((file) => file.endsWith('.routes.js'))
    .map((file) => file.replace('.routes.js', ''))
    .sort();

  it('finds a plausible number of routers', () => {
    // A guard on the guard: if the read breaks and returns [], every
    // assertion below passes vacuously.
    expect(routerNames.length).toBeGreaterThan(20);
  });

  const appSource = fs.readFileSync(
    path.join(__dirname, '..', 'app.js'),
    'utf8',
  );

  it.each(routerNames)('%s.routes.js has a declared mount path', (name) => {
    // Failing here means a new router was added without a line in
    // ROUTER_MOUNTS. The fix is to add one — and if the honest answer is "it is
    // not mounted anywhere", to mount it in app.js first. That is the whole
    // point: leaving a router unreachable has to be a deliberate act rather
    // than an oversight.
    expect(Object.prototype.hasOwnProperty.call(ROUTER_MOUNTS, name)).toBe(
      true,
    );
  });

  it.each(routerNames)('%s.routes.js is required by app.js', (name) => {
    // Two separate things can go wrong and they fail differently: #896 had the
    // mount without the import (ReferenceError at boot), #1009 had neither
    // (a silent 404). This checks the import.
    expect(appSource).toContain(`./routes/${name}.routes`);
  });

  it.each(routerNames)('%s.routes.js is mounted in app.js', (name) => {
    const mount = ROUTER_MOUNTS[name];

    if (mount === null) {
      // Root-mounted: `app.use(healthRoutes)`, no path argument.
      expect(appSource).toMatch(
        new RegExp(`app\\.use\\(\\s*${name}Routes\\s*\\)`),
      );
      return;
    }

    expect(appSource).toContain(`'${mount}'`);
  });

  it('reaches every mount prefix over HTTP', async () => {
    // The static checks above prove the lines are in the file. This proves
    // Express agrees — a mount whose path is shadowed by an earlier router, or
    // registered after the 404 handler, passes the grep and still 404s.
    const unreachable = [];

    for (const [prefix, method, probe] of MOUNTED_ROUTES) {
      const res =
        method === 'post'
          ? await request(app)[method](probe).send({ probe: true })
          : await request(app)[method](probe);

      if (res.status === 404)
        unreachable.push(`${method.toUpperCase()} ${probe} (${prefix})`);
    }

    expect(unreachable).toEqual([]);
  });

  it('has a probe in MOUNTED_ROUTES for every mount prefix', () => {
    // Keeps the two lists honest with each other: a router can be listed in
    // ROUTER_MOUNTS and still never be exercised over HTTP.
    const probed = new Set(MOUNTED_ROUTES.map(([prefix]) => prefix));

    // `health` is root-mounted (null) and covered by its own suite; `/api` and
    // `/api/reports` are shared prefixes already probed by their primary
    // router.
    const notProbed = Object.values(ROUTER_MOUNTS)
      .filter((prefix) => prefix !== null)
      .filter((prefix) => !probed.has(prefix))
      .filter((prefix) => !['/api', '/api/reports'].includes(prefix));

    expect(notProbed).toEqual([]);
  });
});

describe('GraphQL wiring (#792)', () => {
  const { isGraphQLAvailable, attachGraphQL } = require('../graphql');

  it('reports whether the optional packages are installed', () => {
    // #539 never added @apollo/server, @as-integrations/express or graphql to
    // backend/package.json, so on a clean checkout this is false. The point of
    // the assertion is that asking the question does not throw.
    expect(typeof isGraphQLAvailable()).toBe('boolean');
  });

  it('does not throw when the packages are missing', async () => {
    const express = require('express');
    const bare = express();

    await expect(attachGraphQL(bare)).resolves.toBe(isGraphQLAvailable());
  });

  it('is not mounted inside app.js', async () => {
    // Apollo's start() is async and cannot run during a module require. If
    // /graphql ever answers straight off `require('../app')` again, someone has
    // put a top-level await back.
    const res = await request(app)
      .post('/graphql')
      .send({ query: '{ __typename }' });

    expect(res.status).toBe(404);
  });
});
