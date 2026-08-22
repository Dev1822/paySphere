import { lazy } from 'react';

/**
 * Every page the application can reach, in one place (#1012).
 *
 * `frontend/src/pages/` held 31 page components and `App.jsx` declared 13
 * routes. Seventeen finished pages — Assets, Vendors, GrievancePortal,
 * TaxProofPortal, AppraisalDashboard, OfferLetterBuilder, BudgetPlanner,
 * AccountingExport, ClientInvoices, Roster, Approvals, Archive, Loans,
 * Settlements, ProfileSettings, TaxVerificationQueue and WorkflowBuilder — had
 * no route, no link, and no way for a user to open them. Four of those
 * (Loans, Settlements, Archive, WorkflowBuilder) talk to endpoints that were
 * live the whole time.
 *
 * The reason this is a registry rather than seventeen more `<Route>` elements
 * is that the router was never the only thing out of date. `Sidebar.jsx` kept
 * its own list of five destinations, `CommandPalette.jsx` keeps another, and
 * each of the fifteen pages that render the Sidebar re-implemented navigation
 * from the id it emits — inconsistently, and in two cases pointing at paths
 * that do not exist. Three lists that have to agree and no mechanism making
 * them agree is how a page ends up unreachable without anyone noticing.
 *
 * So: one list. `App.jsx` builds its routes from it, `Sidebar.jsx` builds its
 * navigation from it, and `navigation.test.js` fails if a file appears under
 * `pages/` that is in neither this registry nor the small exclusion list at the
 * bottom.
 *
 * Pages are loaded with `React.lazy`. Going from 13 eagerly-imported routes to
 * 30 without splitting would put every screen in the product — the payroll
 * wizard, the org chart, three charting libraries, the rich-text editor — into
 * the chunk a user downloads before the login form paints. The handful that
 * are genuinely needed for first paint stay eager, below.
 */

// Eager: these three are the first paint. A suspense fallback on the landing
// page or the login form would be a regression, not a saving.
import Landing from '../pages/Landing';
import LoginSignUp from '../pages/LoginSignUp';
import NotFound from '../pages/NotFound';

/**
 * Sidebar groupings, in display order.
 *
 * Grouped rather than flat because a flat list of 25 destinations is not
 * navigation, it is a directory. The groups follow how the product is
 * organised rather than how the code is: an HR manager thinks "I need to run
 * payroll", not "I need the payroll controller".
 */
export const NAV_GROUPS = [
  { id: 'overview', label: 'Overview' },
  { id: 'people', label: 'People' },
  { id: 'payroll', label: 'Payroll' },
  { id: 'finance', label: 'Finance' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'workplace', label: 'Workplace' },
  { id: 'learning', label: 'Learning' },
];

/**
 * @typedef {object} AppRoute
 * @property {string} path              router path
 * @property {React.ComponentType} component
 * @property {boolean} [isProtected]    wrapped in ProtectedRoute (default true)
 * @property {string} [label]           sidebar label; omitted means "routed but not in the nav"
 * @property {string} [group]           NAV_GROUPS id
 * @property {string} [icon]            key into the Sidebar's icon map
 * @property {boolean} [employee]       visible to EMPLOYEE accounts as well as ADMIN
 * @property {string} [navPath]         where the sidebar link points, if not `path`
 */

/** @type {AppRoute[]} */
export const APP_ROUTES = [
  // ── Public ───────────────────────────────────────────────────────────────
  { path: '/', component: Landing, isProtected: false },
  { path: '/auth', component: LoginSignUp, isProtected: false },
  {
    path: '/reset-password/:token',
    component: lazy(() => import('../pages/ResetPassword')),
    isProtected: false,
  },

  // ── Overview ─────────────────────────────────────────────────────────────
  {
    path: '/dashboard',
    component: lazy(() => import('../pages/Dashboard')),
    label: 'Dashboard',
    group: 'overview',
    icon: 'grid',
    employee: true,
  },
  {
    path: '/employee-portal',
    component: lazy(() => import('../pages/EmployeePortal')),
    label: 'My portal',
    group: 'overview',
    icon: 'user',
    employee: true,
  },

  // ── People ───────────────────────────────────────────────────────────────
  {
    // The employee directory is a tab on the dashboard rather than a route of
    // its own. It is in the nav because users look for it by name, and the
    // dashboard already reads `?tab=` on mount — which is why `Reports.jsx`
    // sending them to `/employees` produced a NotFound.
    path: '/dashboard',
    navPath: '/dashboard?tab=employees',
    component: null,
    label: 'Employees',
    group: 'people',
    icon: 'people',
  },
  {
    path: '/add-employee',
    component: lazy(() => import('../pages/AddEmployee')),
    label: 'Add employee',
    group: 'people',
    icon: 'userPlus',
  },
  {
    path: '/org-chart',
    component: lazy(() => import('../pages/OrgChartBuilder')),
    label: 'Org chart',
    group: 'people',
    icon: 'people',
  },
  {
    path: '/archive',    component: lazy(() => import('../pages/Archive')),
    label: 'Archive',
    group: 'people',
    icon: 'archive',
  },
  {
    path: '/appraisals',
    component: lazy(() => import('../pages/AppraisalDashboard')),
    label: 'Appraisals',
    group: 'people',
    icon: 'star',
    employee: true,
  },
  {
    // In People rather than Payroll: the question is about how the workforce is
    // paid relative to itself, which is a people decision that happens to be
    // denominated in money (#1347).
    //
    // No `employee: true`. The gap analysis is computed from declared gender
    // and the page is for the small population that holds READ_PAY_EQUITY;
    // advertising it to everyone would be advertising a 403.
    path: '/pay-equity',
    component: lazy(() => import('../pages/PayEquityDashboard')),
    appShell: true,
    label: 'Pay equity',
    group: 'people',
    icon: 'chart',
  },
  {
    path: '/offer-letters',
    component: lazy(() => import('../pages/OfferLetterBuilder')),
    label: 'Offer letters',
    group: 'people',
    icon: 'document',
  },

  {
    path: '/internal-jobs',
    component: lazy(() => import('../pages/InternalJobBoard')),
    label: 'Internal job board',
    group: 'people',
    icon: 'briefcase',
  },
  {
    path: '/referrals',
    component: lazy(() => import('../pages/ReferralPortal')),
    label: 'Referral portal',
    group: 'people',
    icon: 'userPlus',
  },
  {
    path: '/handover',
    component: lazy(() => import('../pages/HandoverDashboard')),
    label: 'Handover dashboard',
    group: 'people',
    icon: 'archive',
  },

  // ── Payroll ──────────────────────────────────────────────────────────────
  {
    path: '/approvals',
    component: lazy(() => import('../pages/Approvals')),
    appShell: true,
    label: 'Approvals',
    group: 'payroll',
    icon: 'check',
  },
  {
    path: '/loans',
    component: lazy(() => import('../pages/Loans')),
    appShell: true,
    label: 'Loans & advances',
    group: 'payroll',
    icon: 'wallet',
  },
  {
    path: '/settlements',
    component: lazy(() => import('../pages/Settlements')),
    appShell: true,
    label: 'Settlements',
    group: 'payroll',
    icon: 'exit',
  },
  {
    // Next to Settlements, because the two are the same statute from opposite
    // ends: Settlements pays gratuity to a leaver, this measures what is still
    // owed to everybody who has not left (#1344).
    path: '/gratuity',
    component: lazy(() => import('../pages/GratuityProvisioning')),
    appShell: true,
    label: 'Gratuity provision',
    group: 'payroll',
    icon: 'shield',
  },
  {
    path: '/reports',
    component: lazy(() => import('../pages/Reports')),
    label: 'Reports',
    group: 'payroll',
    icon: 'chart',
  },
  {
    path: '/budget',
    component: lazy(() => import('../pages/BudgetPlanner')),
    label: 'Budget planner',
    group: 'payroll',
    icon: 'target',
  },
  {
    // In Payroll rather than Compliance because it is money paid to employees,
    // and separate from the payroll run because the amount is fixed by the
    // Payment of Bonus Act rather than by the company (#1346).
    path: '/statutory-bonus',
    component: lazy(() => import('../pages/StatutoryBonusRegister')),
    appShell: true,
    label: 'Statutory bonus',
    group: 'payroll',
    icon: 'book',
  },

  {
    path: '/garnishments',
    component: lazy(() => import('../pages/GarnishmentAdmin')),
    label: 'Garnishment admin',
    group: 'payroll',
    icon: 'shield',
  },

  // ── Finance ──────────────────────────────────────────────────────────────
  {
    path: '/assets',
    component: lazy(() => import('../pages/Assets')),
    label: 'Assets',
    group: 'finance',
    icon: 'box',
  },
  {
    path: '/vendors',
    component: lazy(() => import('../pages/Vendors')),
    label: 'Vendors',
    group: 'finance',
    icon: 'truck',
  },
  {
    path: '/client-invoices',
    component: lazy(() => import('../pages/ClientInvoices')),
    label: 'Client invoices',
    group: 'finance',
    icon: 'receipt',
  },
  {
    path: '/expense-reports',
    component: lazy(() => import('../pages/CustomExpenseReports')),
    label: 'Expense reports',
    group: 'finance',
    icon: 'wallet',
    employee: true,
  },
  {
    path: '/accounting',
    component: lazy(() => import('../pages/AccountingExport')),
    label: 'Accounting export',
    group: 'finance',
    icon: 'book',
  },

  {
    path: '/expense-submission',
    component: lazy(() => import('../pages/ExpenseSubmission')),
    label: 'Submit expense',
    group: 'finance',
    icon: 'receipt',
  },

  // ── Compliance ───────────────────────────────────────────────────────────
  {
    path: '/tax-proofs',
    component: lazy(() => import('../pages/TaxProofPortal')),
    label: 'My tax proofs',
    group: 'compliance',
    icon: 'shield',
    employee: true,
  },
  {
    path: '/tax-verification',
    component: lazy(() => import('../pages/TaxVerificationQueue')),
    label: 'Tax verification',
    group: 'compliance',
    icon: 'checkShield',
  },
  {
    // Sits with the tax proofs because it is the same act from the employee's
    // side — file a document, get an exemption — and a four-year statutory
    // block rather than a financial year behind it (#1345).
    path: '/lta',
    component: lazy(() => import('../pages/LtaClaimPortal')),
    appShell: true,
    label: 'Travel allowance',
    group: 'compliance',
    icon: 'document',
    employee: true,
  },
  {
    path: '/grievances',
    component: lazy(() => import('../pages/GrievancePortal')),
    appShell: true,
    label: 'Grievances',
    group: 'compliance',
    icon: 'alert',
    employee: true,
  },
  {
    path: '/audit-logs',
    component: lazy(() => import('../pages/AuditLogs')),
    label: 'Audit logs',
    group: 'compliance',
    icon: 'shield',
  },

  // ── Workplace ────────────────────────────────────────────────────────────
  {
    path: '/roster',
    component: lazy(() => import('../pages/Roster')),
    label: 'Shift roster',
    group: 'workplace',
    icon: 'calendar',
    employee: true,
  },
  {
    // In Workplace rather than Payroll: the desk is about where people are
    // working and under what arrangement, and the money follows from that
    // rather than the other way round (#1348).
    path: '/mobility',
    component: lazy(() => import('../pages/GlobalMobilityDesk')),
    appShell: true,
    label: 'Global mobility',
    group: 'workplace',
    icon: 'truck',
  },
  {
    path: '/monthly-updates',
    component: lazy(() => import('../pages/MonthlyUpdates')),
    label: 'Monthly updates',
    group: 'workplace',
    icon: 'megaphone',
    employee: true,
  },
  {
    path: '/workflows',
    component: lazy(() => import('../pages/WorkflowBuilder')),
    appShell: true,
    label: 'Workflows',
    group: 'workplace',
    icon: 'flow',
  },
  {
    path: '/announcements',
    component: lazy(() => import('../pages/CompanyAnnouncements')),
    label: 'Announcements',
    group: 'workplace',
    icon: 'megaphone',
    employee: true,
  },

  {
    path: '/timesheet',
    component: lazy(() => import('../pages/TimesheetTracker')),
    label: 'Timesheet tracker',
    group: 'workplace',
    icon: 'clock',
  },

  // ── Learning ─────────────────────────────────────────────────────────────
  {
    path: '/flashcards',
    component: lazy(() => import('../pages/Flashcards')),
    label: 'Flashcards',
    group: 'learning',
    icon: 'cards',
    employee: true,
  },
  {
    path: '/pyqs',
    component: lazy(() => import('../pages/PyqDashboard')),
    label: 'Question bank',
    group: 'learning',
    icon: 'school',
    employee: true,
  },
  {
    path: '/quiz-battle',
    component: lazy(() => import('../pages/QuizBattle')),
    label: 'Quiz battle',
    group: 'learning',
    icon: 'game',
    employee: true,
  },

  // ── Enterprise Suites (routed, sidebar-hidden) ──────────────────────────────
  {
    path: '/enterprise/vendor-management',
    component: lazy(() => import('../pages/vendor/EnterpriseVendorDashboardPage')),
  },
  {
    path: '/enterprise/benefits-compensation',
    component: lazy(() => import('../pages/benefits/EnterpriseBenefitsDashboardPage')),
  },
  {
    path: '/enterprise/travel-expense',
    component: lazy(() => import('../pages/travel/EnterpriseTravelDashboardPage')),
  },
  {
    path: '/enterprise/asset-inventory',
    component: lazy(() => import('../pages/assets/EnterpriseAssetDashboardPage')),
  },
  {
    path: '/enterprise/compliance-audit',
    component: lazy(() => import('../pages/compliance/EnterpriseComplianceDashboardPage')),
  },
  {
    path: '/enterprise/cybersecurity-soc',
    component: lazy(() => import('../pages/security/EnterpriseCybersecuritySOCPage')),
  },
  {
    path: '/enterprise/ecmo-critical-care',
    component: lazy(() => import('../pages/ecmo/ECMOVentilationTelemetryPage')),
  },
  {
    path: '/enterprise/engagement-sentiment',
    component: lazy(() => import('../pages/engagement/EnterpriseEngagementSentimentPage')),
  },
  {
    path: '/enterprise/clinical-telemetry',
    component: lazy(() => import('../pages/clinical/ICUHemodynamicsTelemetryPage')),
  },

  // ── Routed, but reached from elsewhere rather than from the sidebar ───────
  //
  // No `label`, so they get a route and no nav entry. Settings and the profile
  // page live in the sidebar footer; system health is a link inside settings.
  // ── Enterprise (routed but sidebar entry managed separately) ─────────────
  {
    path: '/enterprise/time-attendance',
    component: lazy(() => import('../pages/timeattendance/EnterpriseTimeAttendanceDashboardPage')),
  },
  {
    path: '/enterprise/learning-development',
    component: lazy(() => import('../pages/learning/EnterpriseLearningDevelopmentPage')),
  },
  {
    path: '/enterprise/onboarding-lifecycle',
    component: lazy(() => import('../pages/onboarding/EnterpriseOnboardingLifecyclePage')),
  },

  {
    path: '/settings',
    component: lazy(() => import('../pages/Settings')),
  },
  {
    path: '/settings/system-health',
    component: lazy(() => import('../pages/SystemHealth')),
    appShell: true,
  },
  {
    path: '/profile',
    component: lazy(() => import('../pages/ProfileSettings')),
  },
];

/**
 * Pages that deliberately have no route of their own.
 *
 * `navigation.test.js` reads `pages/` and requires every component to be either
 * routed above or listed here, so "this page is unreachable" is a decision
 * someone made rather than something that happened.
 */
export const UNROUTED_PAGES = {
  // Rendered by App.jsx as the catch-all `*` route, not from the registry.
  'NotFound.jsx': 'the catch-all route',
};

/**
 * The sidebar entries an account should see.
 *
 * `accountType` is what the login response calls `role` — `resolveAccountType`
 * on the server returns 'ADMIN' or 'EMPLOYEE'. An employee has a self-service
 * portal, not a payroll console, so showing them "Approvals" or "Accounting
 * export" advertises a page that will 403.
 *
 * Anything unrecognised is treated as an admin, because the alternative is
 * hiding the whole product from a user whose account type failed to load.
 * Getting this wrong is a UI inconvenience; the actual authorization decision
 * is the server's and is unaffected either way.
 *
 * @param {string|null|undefined} accountType
 * @returns {Array<{group: object, items: AppRoute[]}>}
 */
export function navigationFor(accountType) {
  const isEmployee = accountType === 'EMPLOYEE';

  return NAV_GROUPS.map((group) => ({
    group,
    items: APP_ROUTES.filter(
      (route) =>
        route.label &&
        route.group === group.id &&
        (!isEmployee || route.employee === true),
    ),
  })).filter((section) => section.items.length > 0);
}

/** Routes that App.jsx should render. Excludes nav-only entries. */
export const ROUTABLE = APP_ROUTES.filter((route) => route.component !== null);

export { NotFound };
