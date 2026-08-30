import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  APP_ROUTES,
  NAV_GROUPS,
  ROUTABLE,
  UNROUTED_PAGES,
  navigationFor,
} from '../navigation';

/**
 * Every page is reachable, or is explicitly declared not to be (#1012).
 *
 * `pages/` held 31 components and `App.jsx` declared 13 routes. Seventeen
 * finished pages had no route at all — including four whose backends were live
 * the whole time — and nothing failed, because nothing was checking. A page is
 * added, reviewed and merged, and the one line that connects it to the router
 * is left out; the same habit that left eleven backend routers unmounted.
 *
 * These tests start from the filesystem so that stays impossible. A new file in
 * `pages/` has to be routed or listed in `UNROUTED_PAGES` with a reason, and
 * neither happens by accident.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const PAGES_DIR = path.resolve(here, '..', '..', 'pages');

const pageFiles = fs
  .readdirSync(PAGES_DIR)
  .filter((file) => file.endsWith('.jsx'))
  .sort();

/** The `../pages/Foo` specifier a registry entry lazy-imports, if any. */
const registrySource = fs.readFileSync(
  path.resolve(here, '..', 'navigation.js'),
  'utf8',
);

const referencedPages = new Set(
  [...registrySource.matchAll(/pages\/(\w+)['"]/g)].map(
    (match) => `${match[1]}.jsx`,
  ),
);

describe('the page registry covers the pages directory', () => {
  it('finds a plausible number of pages', () => {
    // A guard on the guard: an empty read makes everything below pass
    // vacuously.
    expect(pageFiles.length).toBeGreaterThan(25);
  });

  it.each(pageFiles)('%s is routed or explicitly excluded', (file) => {
    const routed = referencedPages.has(file);
    const excluded = Object.prototype.hasOwnProperty.call(UNROUTED_PAGES, file);

    expect(routed || excluded).toBe(true);
  });

  it('every exclusion states a reason', () => {
    // "Unreachable" should always be a sentence somebody wrote, not a blank.
    const unexplained = Object.entries(UNROUTED_PAGES)
      .filter(([, reason]) => !reason || !reason.trim())
      .map(([file]) => file);

    expect(unexplained).toEqual([]);
  });

  it('every exclusion refers to a page that exists', () => {
    // Stops the list rotting into a way of silencing this test.
    const stale = Object.keys(UNROUTED_PAGES).filter(
      (file) => !pageFiles.includes(file),
    );

    expect(stale).toEqual([]);
  });

  it('routes the seventeen pages that had none', () => {
    // Named individually rather than counted, because a count passes just as
    // happily when one page is swapped for another.
    const previouslyUnreachable = [
      'AccountingExport.jsx',
      'AppraisalDashboard.jsx',
      'Approvals.jsx',
      'Archive.jsx',
      'Assets.jsx',
      'BudgetPlanner.jsx',
      'ClientInvoices.jsx',
      'GrievancePortal.jsx',
      'Loans.jsx',
      'OfferLetterBuilder.jsx',
      'ProfileSettings.jsx',
      'Roster.jsx',
      'Settlements.jsx',
      'TaxProofPortal.jsx',
      'TaxVerificationQueue.jsx',
      'Vendors.jsx',
      'WorkflowBuilder.jsx',
    ];

    const stillMissing = previouslyUnreachable.filter(
      (file) => !referencedPages.has(file),
    );

    expect(stillMissing).toEqual([]);
  });
});

describe('the route table is well formed', () => {
  it('gives every routable entry a component', () => {
    const broken = ROUTABLE.filter((route) => !route.component).map(
      (route) => route.path,
    );

    expect(broken).toEqual([]);
  });

  it('declares no duplicate routable paths', () => {
    // Two entries for one path means React Router serves the first and the
    // second is dead — the frontend version of the duplicated route table that
    // caused #792 on the backend.
    const paths = ROUTABLE.map((route) => route.path);

    expect(paths.length).toBe(new Set(paths).size);
  });

  it('starts every path with a slash', () => {
    const malformed = ROUTABLE.filter(
      (route) => !route.path.startsWith('/'),
    ).map((route) => route.path);

    expect(malformed).toEqual([]);
  });

  it('protects everything that is not explicitly public', () => {
    // Only the landing page, the auth screen and the password-reset link are
    // reachable without a session. Everything else renders employee, payroll
    // or statutory data.
    const publicPaths = APP_ROUTES.filter(
      (route) => route.isProtected === false,
    ).map((route) => route.path);

    expect(publicPaths.sort()).toEqual([
      '/',
      '/auth',
      '/reset-password/:token',
    ]);
  });

  it('puts every navigable entry in a known group', () => {
    const groupIds = new Set(NAV_GROUPS.map((group) => group.id));
    const orphaned = APP_ROUTES.filter(
      (route) => route.label && !groupIds.has(route.group),
    ).map((route) => route.label);

    expect(orphaned).toEqual([]);
  });

  it('gives every navigable entry an icon', () => {
    const iconless = APP_ROUTES.filter(
      (route) => route.label && !route.icon,
    ).map((route) => route.label);

    expect(iconless).toEqual([]);
  });

  it('uses no duplicate labels within a group', () => {
    for (const group of NAV_GROUPS) {
      const labels = APP_ROUTES.filter(
        (route) => route.label && route.group === group.id,
      ).map((route) => route.label);

      expect(labels.length).toBe(new Set(labels).size);
    }
  });
});

describe('route-level code splitting', () => {
  const lazyType = Symbol.for('react.lazy');

  it('keeps only first-paint routes eager', () => {
    const publicFirstPaint = APP_ROUTES.filter(
      (route) => route.path === '/' || route.path === '/auth',
    );

    expect(publicFirstPaint).toHaveLength(2);
    expect(
      publicFirstPaint.every((route) => route.component?.$$typeof !== lazyType),
    ).toBe(true);

    const resetPassword = APP_ROUTES.find(
      (route) => route.path === '/reset-password/:token',
    );
    expect(resetPassword?.component?.$$typeof).toBe(lazyType);
  });

  it('lazy-loads every protected page route', () => {
    const protectedRoutes = APP_ROUTES.filter(
      (route) => route.isProtected !== false && route.component,
    );

    expect(protectedRoutes.length).toBeGreaterThan(20);

    const eagerProtectedRoutes = protectedRoutes.filter(
      (route) => route.component?.$$typeof !== lazyType,
    );

    expect(eagerProtectedRoutes).toEqual([]);
  });

  it('does not accidentally eager-import page modules in the registry', () => {
    const eagerPageImports = registrySource
      .split(/\r?\n/)
      .filter((line) => /^import .* from ['"]\.\.\/pages\//.test(line.trim()))
      .map((line) => line.trim());

    expect(eagerPageImports).toEqual([
      "import Landing from '../pages/Landing';",
      "import LoginSignUp from '../pages/LoginSignUp';",
      "import NotFound from '../pages/NotFound';",
    ]);
  });
});

describe('navigationFor', () => {
  const labelsIn = (sections) =>
    sections.flatMap((section) => section.items.map((item) => item.label));

  it('gives an admin the whole product', () => {
    const labels = labelsIn(navigationFor('ADMIN'));

    expect(labels).toContain('Approvals');
    expect(labels).toContain('Accounting export');
    expect(labels).toContain('Vendors');
    expect(labels.length).toBeGreaterThan(20);
  });

  it('gives an employee only their self-service pages', () => {
    const labels = labelsIn(navigationFor('EMPLOYEE'));

    expect(labels).toContain('My portal');
    expect(labels).toContain('My tax proofs');
    expect(labels).toContain('Shift roster');

    // An employee has a self-service portal, not a payroll console. Listing
    // these advertises a page the server will refuse.
    expect(labels).not.toContain('Approvals');
    expect(labels).not.toContain('Accounting export');
    expect(labels).not.toContain('Vendors');
    expect(labels).not.toContain('Add employee');
  });

  it('treats an unknown account type as an admin', () => {
    // Failing the other way hides the whole product from a user whose account
    // type did not load. This is a UI decision only; the authorization
    // decision is the server's either way.
    expect(labelsIn(navigationFor(undefined))).toEqual(
      labelsIn(navigationFor('ADMIN')),
    );
    expect(labelsIn(navigationFor(null)).length).toBeGreaterThan(20);
  });

  it('drops a group rather than rendering an empty heading', () => {
    const sections = navigationFor('EMPLOYEE');

    expect(sections.every((section) => section.items.length > 0)).toBe(true);
  });

  it('keeps the groups in declaration order', () => {
    const order = navigationFor('ADMIN').map((section) => section.group.id);
    const expected = NAV_GROUPS.map((group) => group.id).filter((id) =>
      order.includes(id),
    );

    expect(order).toEqual(expected);
  });
});
