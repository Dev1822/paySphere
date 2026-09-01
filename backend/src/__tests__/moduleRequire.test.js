/**
 * Every router must actually load, not merely parse.
 *
 * `moduleLoad.test.js` compiles every file under `backend/src` in a `vm` and
 * asserts it is syntactically valid. That check is deliberately cheap — it
 * executes nothing, so it cannot be tripped up by a missing database or a
 * missing Redis — and it is exactly why it could not see #2027:
 *
 *     status: { type: String, enum: PAYROLL_STATUSES, default: 'draft' },
 *
 * That line parses perfectly. `PAYROLL_STATUSES` is simply not defined
 * anywhere, and the `ReferenceError` only exists at the moment the module body
 * runs. `app.js` reaches `payroll.model.js` through `user.routes.js`, so the
 * entire API failed to load and `npm start` was down — while a suite named
 * "does the product start" passed.
 *
 * The same shape recurs across the tree, and always in the same three ways:
 *
 *   - an identifier that was never imported (`authMiddleware`, `rbacMiddleware`,
 *     `payrollController`) left behind by an edit that dropped the import;
 *   - a destructured name the module does not export (`{ protect }` from
 *     `auth.middleware`, which exports the function itself), which yields
 *     `undefined` and then dies inside express as "argument handler must be a
 *     function";
 *   - two `module.exports =` assignments in one file, the second silently
 *     discarding the first.
 *
 * None of the three is a syntax error. All three are caught by the one thing
 * this file does: `require()` the router and see what happens.
 *
 * `app.routeMounting.test.js` would also have caught #2027, and did — as
 * "Test suite failed to run", which in a CI log reads as an infrastructure
 * problem rather than as an application that does not load. This suite reports
 * it per file, by name, with the error attached.
 */

const fs = require('fs');
const path = require('path');

const ROUTES_DIR = path.join(__dirname, '..', 'routes');

/**
 * Routers known not to load, with the reason.
 *
 * A quarantine list, not an exemption list. The assertion below is that the set
 * of unloadable routers is a **subset** of this one, so the list can shrink
 * without anybody editing this file and cannot grow without somebody choosing
 * to. Deleting an entry as it is fixed is the point.
 *
 * They fall into three groups, and the distinction matters when picking one up:
 *
 *   1. **A wrong path or a missing file.** Mechanical. `compensationCycle`
 *      requires `../middleware/auth.middleware` — singular, and the directory is
 *      `middlewares`. `flashcard` and `reports` require controllers that are not
 *      there; in `reports`' case a `.ts` beside a stale `.js.map`, which is the
 *      recurrence of #1008 (`backend` is CommonJS started with `node
 *      src/index.js` and has no build step, so a `.ts` controller is invisible
 *      to `require`).
 *
 *   2. **A missing dependency.** `date-fns` and `express-validator` are required
 *      by committed source and appear in no `package.json`. `handlebars` is
 *      declared but may be absent from a given install. These fail on the
 *      environment rather than on the code, which is why the assertion is a
 *      subset check — an install that has them makes the suite report fewer
 *      failures, not more.
 *
 *   3. **A router written against an API its controller does not have.**
 *      `payEquity.routes.js` destructures `previewReport`, `commitReport`,
 *      `listReports`, `getReport`, `getCompaRatios`, `listBands` and
 *      `upsertBand`; `payEquity.controller.js` exports a class instance with
 *      `runAudit`, `getScatterData`, `calculateRemediation`, `getHistory` and
 *      `seed`. `succession` is the same mismatch. These are not typos and there
 *      is no mechanical fix — somebody has to decide which of the two APIs is
 *      the real one.
 */
const QUARANTINE = {
  'compensationCycle.routes.js':
    "requires '../middleware/auth.middleware' — the directory is 'middlewares'",
  'flashcard.routes.js':
    "requires '../controllers/flashcard.controller', which does not exist",
  'headcountPlanning.routes.js':
    'destructures { requireAuth, requireRoles } from auth.middleware, which exports neither',
  'letterTemplate.routes.js': "requires 'handlebars'",
  'offboarding.routes.js':
    'offboarding.model.js declares a schema path with an undefined type',
  'onboarding.routes.js': "requires 'date-fns', which is in no package.json",
  'payEquity.routes.js':
    'router destructures seven names the controller does not export (see group 3 above)',
  'peerNomination.routes.js':
    "requires 'express-validator', which is in no package.json",
  'probation.routes.js': "requires 'date-fns', which is in no package.json",
  'reports.routes.js':
    "requires '../controllers/reports.controller', which exists only as .ts (#1008 again)",
  'skillInventory.routes.js': "requires '../utils/dates', which does not exist",
  'succession.routes.js':
    'router calls six controller methods the controller does not have (see group 3 above)',
  'timeline.routes.js':
    'destructures { requireAuth } from auth.middleware, which does not export it',
  'treasury.routes.js':
    "treasury.controller.js uses an ESM import of '../utils/asyncHandler.js', which does not exist",

  // Group 4, and the only member: broken under jest and not under node.
  //
  //     node -e "require('./src/routes/user.routes.js')"   // loads
  //     jest                                              // Unexpected token 'export'
  //
  // `user.controller.js` requires `otplib`, which ships ESM. `jest.config.js`
  // lists it in `transformIgnorePatterns` as something to transform — but the
  // repository has no babel config, so babel-jest applies only
  // `babel-preset-current-node-syntax`, which parses ESM without rewriting it.
  // The require therefore reaches an untransformed `export` and dies.
  //
  // Nothing about the router is wrong, and plain `node` is the ground truth for
  // whether the product starts. Listed here so the suite reports the real state
  // rather than being weakened to hide it; the fix is a babel config or a
  // `transform` entry, which is a build change and not this one.
  'user.routes.js':
    'loads under node; fails under jest because otplib is ESM and no babel config exists to transform it',
};

/**
 * Errors that say nothing about the router under test.
 *
 * Mongoose refuses to compile a model name twice in one process, and jest runs
 * every file in this suite in a single module registry — so a router that loads
 * perfectly well on its own reports `OverwriteModelError` purely because an
 * earlier router in the alphabet already registered the same model. That is a
 * fact about the test runner, not about the file.
 */
function isRunnerArtefact(error) {
  return error && error.name === 'OverwriteModelError';
}

const routerFiles = fs
  .readdirSync(ROUTES_DIR)
  .filter((file) => file.endsWith('.routes.js'))
  .sort();

describe('every router loads', () => {
  /** @type {Map<string, Error>} */
  const failures = new Map();

  beforeAll(() => {
    for (const file of routerFiles) {
      try {
        require(path.join(ROUTES_DIR, file));
      } catch (error) {
        if (isRunnerArtefact(error)) continue;
        failures.set(file, error);
      }
    }
  });

  it('finds routers to check', () => {
    expect(routerFiles.length).toBeGreaterThan(100);
  });

  it.each(routerFiles.filter((file) => !QUARANTINE[file]))('%s', (file) => {
    const error = failures.get(file);
    if (error) {
      throw new Error(
        `${file} could not be required: ${error.name}: ${error.message.split('\n')[0]}\n` +
          'If this is a new failure, fix the router. If the router is knowingly ' +
          'broken and cannot be fixed in this change, add it to QUARANTINE with ' +
          'the reason — do not delete this test.',
      );
    }
    expect(error).toBeUndefined();
  });

  it('quarantines nothing that already loads', () => {
    // The other direction. A quarantine entry for a router that loads fine is
    // stale, and stale entries are how a list like this stops meaning anything.
    const stale = Object.keys(QUARANTINE).filter(
      (file) => routerFiles.includes(file) && !failures.has(file),
    );
    expect(stale).toEqual([]);
  });

  it('names no router that no longer exists', () => {
    const missing = Object.keys(QUARANTINE).filter(
      (file) => !routerFiles.includes(file),
    );
    expect(missing).toEqual([]);
  });
});

describe('the payroll model', () => {
  /**
   * The specific regression. Kept as its own assertion rather than left to the
   * sweep above, because the sweep proves the file loads and this proves the
   * field is the one the approval flow needs.
   */
  const { PAYROLL_STATUS, ALL_STATUSES } = require('../config/payrollStatus');

  it('loads at all', () => {
    expect(() => require('../models/payroll.model')).not.toThrow();
  });

  it('takes its enum from the shared vocabulary', () => {
    const PayrollUpdate = require('../models/payroll.model');
    const status = PayrollUpdate.schema.path('status');
    expect(status).toBeDefined();
    expect(status.options.enum).toEqual(ALL_STATUSES);
  });

  it('defaults a new row into the maker–checker flow, not past it', () => {
    // `draft` is documented in config/payrollStatus.js as reserved for a
    // save-as-draft that does not exist yet, and it is in neither
    // PAYABLE_STATUSES nor EMAILABLE_STATUSES. A row created through save()
    // has been submitted, so it belongs at the start of the flow.
    const PayrollUpdate = require('../models/payroll.model');
    expect(PayrollUpdate.schema.path('status').options.default).toBe(
      PAYROLL_STATUS.PENDING_APPROVAL,
    );
  });

  it('still folds a legacy status onto the canonical vocabulary', () => {
    // The setter #458 added. Without it every pre-approval document fails enum
    // validation on any save() path, which is the bug #458 was opened to fix —
    // and `finalized` maps to `approved` rather than `pending_approval` because
    // demoting those rows would make historical payroll vanish from every total.
    const PayrollUpdate = require('../models/payroll.model');
    const doc = new PayrollUpdate({});
    doc.status = 'finalized';
    expect(doc.status).toBe(PAYROLL_STATUS.APPROVED);

    doc.status = 'PENDING_APPROVAL';
    expect(doc.status).toBe(PAYROLL_STATUS.PENDING_APPROVAL);
  });

  it('leaves an unrecognised status alone for the enum to reject', () => {
    // `normalizeStatus(value) || value` — the fallback matters. Coercing an
    // unknown string to a valid one would let a typo through validation as
    // whatever the fallback happened to be.
    const PayrollUpdate = require('../models/payroll.model');
    const doc = new PayrollUpdate({});
    doc.status = 'half_paid';
    expect(doc.status).toBe('half_paid');
  });
});

describe('single export assignment', () => {
  /**
   * `employeeImport.controller.js` carried two `module.exports =` assignments,
   * the second dropping `getImportProgress` from the first. The router asked for
   * it by a name it had never imported, so the bug surfaced as
   * `ReferenceError: authMiddleware is not defined` — three files away from the
   * cause.
   *
   * A file with two top-level `module.exports =` assignments is always a
   * mistake: the first is dead code. Cheap to check, and it catches the
   * conflict-resolution slip that produces it.
   */
  const CONTROLLERS_DIR = path.join(__dirname, '..', 'controllers');

  const controllerFiles = fs
    .readdirSync(CONTROLLERS_DIR)
    .filter((file) => file.endsWith('.js') && !file.endsWith('.test.js'))
    .sort();

  it.each(controllerFiles)('%s assigns module.exports at most once', (file) => {
    const source = fs.readFileSync(path.join(CONTROLLERS_DIR, file), 'utf8');
    const assignments = source.match(/^module\.exports\s*=/gm) || [];
    expect(assignments.length).toBeLessThanOrEqual(1);
  });
});
