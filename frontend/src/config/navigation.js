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
  {
    path: '/verify-payslip',
    component: lazy(() => import('../pages/payroll/PayslipVerificationPage')),
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
  {
    path: '/compensation-timeline',
    component: lazy(() => import('../pages/EmployeeCompensationTimeline')),
    label: 'Compensation timeline',
    group: 'overview',
    icon: 'chart',
    employee: true,
    appShell: true,
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
    // In People rather than in Payroll, and deliberately not beside Leave. A
    // holiday is not leave — it is not applied for, cannot be refused, is not
    // deducted from a balance, and three of them cannot be moved at all.
    // Filing it under Leave would put a substitute control next to days that
    // have none (#1970).
    path: '/holiday-calendar',
    component: lazy(() => import('../pages/HolidayCalendarRegister')),
    appShell: true,
    label: 'Holiday calendar',
    group: 'people',
    icon: 'calendar',
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
    path: '/archive',
    component: lazy(() => import('../pages/Archive')),
    label: 'Archive',
    group: 'people',
    icon: 'archive',
  },
  {
    path: '/bulk-operations',
    component: lazy(() => import('../pages/BulkOperationsCenter')),
    label: 'Bulk operations',
    group: 'people',
    icon: 'briefcase',
    appShell: true,
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
    path: '/templates',
    component: lazy(() => import('../pages/LetterTemplateManager')),
    label: 'Letter templates',
    group: 'people',
    icon: 'document',
  },
  {
    // In People rather than Compliance: the subject is a colleague who was
    // hurt at work, and the register is opened by whoever is looking after
    // them. That it produces a statutory figure is true of half of People
    // already (#1699).
    //
    // No `employee: true`. A claim carries a named individual's date of birth
    // and the circumstances of their injury, which is the most sensitive data
    // in the product after declared gender.
    path: '/injury-compensation',
    component: lazy(() => import('../pages/InjuryCompensationClaims')),
    appShell: true,
    label: 'Injury compensation',
    group: 'people',
    icon: 'shield',
  },
  {
    // In Compliance rather than Payroll. The contribution itself is a payroll
    // figure and the ECR already owns it; what this page holds is the liability
    // that arises from the *date* the contribution was remitted, which is not a
    // payroll number and is not owed to the employee (#1875).
    path: '/epf-remittance',
    component: lazy(() => import('../pages/EpfRemittanceLedger')),
    appShell: true,
    label: 'EPF remittance & 7Q/14B',
    group: 'compliance',
    icon: 'shield',
  },

  {
    // In Compliance rather than Payroll, and not beside Settlements. A lay-off
    // is not a separation — the employment subsists — and the largest thing on
    // the page is not a payment at all: above the Chapter VB threshold the
    // question is whether the employer was entitled to act (#1830).
    path: '/layoffs',
    component: lazy(() => import('../pages/LayoffRegister')),
    appShell: true,
    label: 'Lay-off & Chapter VB',
    group: 'compliance',
    icon: 'shield',
  },

  {
    path: '/compensation',
    component: lazy(() => import('../pages/CompensationBenchmarkingDashboard')),
    label: 'Compensation & equity',
    group: 'people',
    icon: 'money',
  },

  {
    path: '/onboarding',
    component: lazy(() => import('../pages/OnboardingLifecycleTracker')),
    label: 'Onboarding tracker',
    group: 'people',
    icon: 'rocket',
  },
  {
    // Offboarding is the lifecycle counterpart to onboarding — the natural
    // companion for an HR manager reviewing the People section.
    path: '/offboarding',
    component: lazy(() => import('../components/EmployeeOffboardingTracker')),
    label: 'Offboarding tracker',
    group: 'people',
    icon: 'exit',
  },
  {
    // In People rather than Compliance: engaging an apprentice and keeping the
    // roll is HR work, and it sits next to onboarding because that is what it
    // is. That an unregistered contract also produces a statutory exposure is
    // true, and it is not what the page is used for day to day (#1771).
    path: '/apprenticeships',
    component: lazy(() => import('../pages/ApprenticeshipCompliance')),
    appShell: true,
    label: 'Apprentices',
    group: 'people',
    icon: 'rocket',
  },
  {
    // In People beside the apprentice roll for the same reason: recruiting
    // somebody and keeping their register is HR work. It is not filed under
    // Compliance even though the section 13(1)(b) comparison is the sharpest
    // statutory finding on the page — the people who use it daily are the ones
    // recording a recruitment, not the ones certifying the site (#1826).
    path: '/migrant-workmen',
    component: lazy(() => import('../pages/MigrantWorkmenCompliance')),
    appShell: true,
    label: 'Migrant workmen',
    group: 'people',
    icon: 'users',
  },

  // ── Payroll ──────────────────────────────────────────────────────────────
  {
    path: '/payslip-templates',
    component: lazy(
      () => import('../components/payroll/PayslipTemplateDesigner'),
    ),
    label: 'Payslip Templates',
    group: 'payroll',
    icon: 'document',
    appShell: true,
  },
  {
    path: '/approvals',
    component: lazy(() => import('../pages/Approvals')),
    appShell: true,
    label: 'Approvals',
    group: 'payroll',
    icon: 'check',
  },
  {
    // In Payroll rather than in Compliance. The relief is a figure that changes
    // what is deducted this month, and the people who act on it are the ones
    // running the deduction — putting it under Compliance would file it beside
    // things nobody touches until an audit (#1969).
    path: '/section-89-relief',
    component: lazy(() => import('../pages/SectionEightyNineReliefRegister')),
    appShell: true,
    label: 'Section 89(1) relief',
    group: 'payroll',
    icon: 'calculator',
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
    // In Payroll and directly above Settlements, because the two are adjacent
    // and are not the same: a settlement ends an employment, and a suspension
    // is an employment that subsists while producing no work and owing a rising
    // statutory scale. Filing it with leave would be worse — leave pays nothing
    // and this pays fifty per cent rising to a hundred (#1828).
    path: '/suspensions',
    component: lazy(() => import('../pages/SuspensionRegister')),
    appShell: true,
    label: 'Suspensions',
    group: 'payroll',
    icon: 'clock',
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
    // Directly above Gratuity: the two are the same kind of obligation and a
    // reader comparing them is the intended case. Kept apart in the tree
    // because gratuity is the company's own liability and this is a funded
    // scheme where the employer's obligation ends at the remittance (#1769).
    path: '/eps-pension',
    component: lazy(() => import('../pages/EpsPension')),
    appShell: true,
    label: 'Pension scheme',
    group: 'payroll',
    icon: 'shield',
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
    // In Compliance rather than Payroll, though the deduction lands on a
    // payslip. The page is organised by registration certificate rather than by
    // employee, because the state that applies is the state of the place of
    // work and a company with two offices remits to two authorities (#1876).
    path: '/professional-tax',
    component: lazy(() => import('../pages/ProfessionalTaxRegister')),
    appShell: true,
    label: 'Professional tax',
    group: 'compliance',
    icon: 'shield',
  },

  {
    path: '/budget',
    component: lazy(() => import('../pages/BudgetPlanner')),
    label: 'Budget planner',
    group: 'payroll',
    icon: 'target',
  },
  {
    path: '/wellness',
    component: lazy(() => import('../components/EmployeeWellnessDashboard')),
    label: 'Employee Wellness',
    group: 'payroll',
    icon: 'health',
  },
  {
    path: '/pulse-survey',
    component: lazy(() => import('../components/EmployeePulseSurvey')),
    label: 'Pulse Survey',
    group: 'payroll',
    icon: 'clipboard',
  },
  {
    path: '/recognition',
    component: lazy(() => import('../components/EmployeeRecognitionWall')),
    label: 'Recognition Wall',
    group: 'payroll',
    icon: 'trophy',
  },
  {
    path: '/team-performance',
    component: lazy(() => import('../components/TeamPerformanceDashboard')),
    label: 'Team Performance',
    group: 'payroll',
    icon: 'chart',
  },
  {
    path: '/learning',
    component: lazy(() => import('../components/EmployeeLearningTracker')),
    label: 'Learning Tracker',
    group: 'payroll',
    icon: 'book',
  },
  {
    // In Payroll rather than Compliance: it is a deduction that has to be in
    // the run, and it is missed because nobody schedules it rather than because
    // anybody computes it wrongly. Putting it where the run is planned is the
    // whole point (#1701).
    path: '/labour-welfare-fund',
    component: lazy(() => import('../pages/LabourWelfareFundRegister')),
    appShell: true,
    label: 'Labour welfare fund',
    group: 'payroll',
    icon: 'book',
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
    // Next to Statutory bonus for the same reason that one is in Payroll: both
    // are floors the statute sets on what an employee is paid, rather than
    // figures the company chooses. Section 12 of the Payment of Bonus Act even
    // computes on the higher of ₹7,000 and the applicable minimum wage, so the
    // two pages answer halves of one question (#1698).
    //
    // No `employee: true`. The register is every colleague's wage against the
    // notified rate in one table, and advertising it to everyone would be
    // advertising a 403.
    path: '/minimum-wages',
    component: lazy(() => import('../pages/MinimumWageCompliance')),
    appShell: true,
    label: 'Minimum wages',
    group: 'payroll',
    icon: 'shield',
  },
  {
    // Directly under Minimum wages, and in Payroll rather than Compliance: the
    // fix for a deduction total over the section 7(3) ceiling is to reschedule
    // a loan recovery, which is a payroll action. The two are the floor and the
    // ceiling of the same question (#1767).
    path: '/wage-deductions',
    component: lazy(() => import('../pages/WageDeductionRegister')),
    appShell: true,
    label: 'Wage deductions',
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
    path: '/adjudication-workspace',
    component: lazy(() => import('../pages/AdjudicationWorkspace')),
    appShell: true,
    label: 'Expense Adjudication',
    group: 'finance',
    icon: 'checkShield',
  },
  {
    path: '/accounting',
    component: lazy(() => import('../pages/AccountingExport')),
    label: 'Accounting export',
    group: 'finance',
    icon: 'book',
  },

  // ── Compliance ───────────────────────────────────────────────────────────
  {
    // In Compliance rather than in Payroll. The figures are payroll figures,
    // but the thing that has to be watched is a certificate lapsing on a date
    // nobody is looking at — and that belongs beside the other obligations with
    // deadlines rather than beside the run (#1971).
    path: '/international-workers',
    component: lazy(() => import('../pages/InternationalWorkerRegister')),
    appShell: true,
    label: 'International workers',
    group: 'compliance',
    icon: 'globe',
  },
  {
    // In Compliance rather than Payroll: the register's subject is who the
    // scheme covers, and the fact people come to it for — that somebody above
    // the ceiling is still covered until the period ends — is a compliance
    // answer rather than a pay one (#1768).
    path: '/esi',
    component: lazy(() => import('../pages/EsiContribution')),
    appShell: true,
    label: 'ESI',
    group: 'compliance',
    icon: 'shield',
  },
  {
    // In Compliance rather than Finance, even though the numbers are project
    // costs and contractor bills. Everything on the page is answerable to a
    // welfare board rather than to a counterparty — the one per cent deducted
    // at source was never the company's money — and the beneficiary register
    // is a statutory roll rather than a ledger (#1827).
    path: '/construction-cess',
    component: lazy(() => import('../pages/ConstructionCessRegister')),
    appShell: true,
    label: 'Construction cess',
    group: 'compliance',
    icon: 'shield',
  },
  {
    // In Compliance, and deliberately not beside the working-hours page even
    // though section 7 is about hours. That page answers an excess hour with a
    // rate; this one has no currency on it at all, because an underage
    // engagement has no compensable amount (#1877).
    path: '/young-persons',
    component: lazy(() => import('../pages/YoungPersonsRegister')),
    appShell: true,
    label: 'Children & adolescents',
    group: 'compliance',
    icon: 'shield',
  },

  {
    // In Compliance rather than Finance, even though a contractor is a vendor.
    // The vendor ledger's question is "what do we owe this counterparty"; this
    // one's is "what are we liable for on account of people we do not employ",
    // and the answer is a contingent liability rather than an invoice (#1700).
    path: '/contract-labour',
    component: lazy(() => import('../pages/ContractLabourRegister')),
    appShell: true,
    label: 'Contract labour',
    group: 'compliance',
    icon: 'shield',
  },
  {
    // Directly under Contract labour, which is its nearest neighbour: both are
    // about people the establishment does not employ. They part company on
    // what is owed — there, a contingent liability for a contractor's workmen;
    // here, a share of the platform's own turnover, on account of workers
    // section 2(35) puts outside the employment relationship entirely (#1829).
    path: '/aggregator-contribution',
    component: lazy(() => import('../pages/AggregatorContribution')),
    appShell: true,
    label: 'Aggregator contribution',
    group: 'compliance',
    icon: 'shield',
  },
  {
    // Next to the tax-proof portal: both decide what a Form 16 says — that one
    // by what the employee declares, this one by what the employer provided
    // (#1770).
    path: '/perquisites',
    component: lazy(() => import('../pages/PerquisiteValuation')),
    appShell: true,
    label: 'Perquisites',
    group: 'compliance',
    icon: 'shield',
  },
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
    // In Workplace rather than Compliance: the fix for a spread-over breach is
    // a different rota, and rostering lives here. That it also produces a
    // statutory finding is true of most of what this group does (#1702).
    path: '/working-hours',
    component: lazy(() => import('../pages/WorkingHoursCompliance')),
    appShell: true,
    label: 'Working hours',
    group: 'workplace',
    icon: 'calendar',
  },
  {
    path: '/predictive-overtime',
    component: lazy(() => import('../pages/PredictiveOvertimeDashboard')),
    label: 'Predictive Overtime',
    group: 'workplace',
    icon: 'chart',
  },
  {
    path: '/roster',
    component: lazy(() => import('../pages/Roster')),
    label: 'Shift roster',
    group: 'workplace',
    icon: 'calendar',
    employee: true,
  },
  {
    path: '/shift-marketplace',
    component: lazy(() => import('../pages/DynamicShiftBidding')),
    label: 'Shift Marketplace',
    group: 'workplace',
    icon: 'briefcase',
    employee: true,
  },
  {
    // In Compliance rather than beside Settlements, though a death in service
    // triggers both. A settlement is what the employer owes; this is what the
    // scheme pays out of contributions already remitted, and the employer only
    // files the claim (#1878).
    path: '/edli',
    component: lazy(() => import('../pages/EdliAssuranceRegister')),
    appShell: true,
    label: 'EDLI assurance',
    group: 'compliance',
    icon: 'shield',
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
    path: '/team-health',
    component: lazy(() => import('../pages/TeamHealthScoreDashboard')),
    label: 'Team health',
    group: 'workplace',
    icon: 'heart',
    employee: true,
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
    component: lazy(
      () => import('../pages/vendor/EnterpriseVendorDashboardPage'),
    ),
  },
  {
    path: '/enterprise/benefits-compensation',
    component: lazy(
      () => import('../pages/benefits/EnterpriseBenefitsDashboardPage'),
    ),
  },
  {
    path: '/enterprise/travel-expense',
    component: lazy(
      () => import('../pages/travel/EnterpriseTravelDashboardPage'),
    ),
  },
  {
    path: '/enterprise/asset-inventory',
    component: lazy(
      () => import('../pages/assets/EnterpriseAssetDashboardPage'),
    ),
  },
  {
    // In Compliance rather than in Recruitment. The page owns nothing in the
    // hiring pipeline and section 5 means notifying a vacancy creates no
    // obligation about who is hired — putting it beside the requisitions would
    // imply the opposite (#1879).
    path: '/vacancy-notification',
    component: lazy(() => import('../pages/VacancyNotificationRegister')),
    appShell: true,
    label: 'Vacancy notification',
    group: 'compliance',
    icon: 'shield',
  },

  {
    path: '/enterprise/compliance-audit',
    component: lazy(
      () => import('../pages/compliance/EnterpriseComplianceDashboardPage'),
    ),
  },
  {
    path: '/enterprise/cybersecurity-soc',
    component: lazy(
      () => import('../pages/security/EnterpriseCybersecuritySOCPage'),
    ),
  },
  {
    path: '/enterprise/ecmo-critical-care',
    component: lazy(() => import('../pages/ecmo/ECMOVentilationTelemetryPage')),
  },
  {
    path: '/enterprise/engagement-sentiment',
    component: lazy(
      () => import('../pages/engagement/EnterpriseEngagementSentimentPage'),
    ),
  },
  {
    path: '/enterprise/clinical-telemetry',
    component: lazy(
      () => import('../pages/clinical/ICUHemodynamicsTelemetryPage'),
    ),
  },
  {
    path: '/enterprise/emergency-triage',
    component: lazy(
      () => import('../pages/emergency/EmergencyTriageCommandStationPage'),
    ),
  },
  {
    path: '/enterprise/cardiology-stemi',
    component: lazy(
      () => import('../pages/cardiology/CardiologySTEMICathLabPage'),
    ),
  },
  {
    path: '/enterprise/mechanical-circulatory-support',
    component: lazy(
      () => import('../pages/circulatory/MechanicalCirculatorySupportPage'),
    ),
  },

  // ── Routed, but reached from elsewhere rather than from the sidebar ───────
  //
  // No `label`, so they get a route and no nav entry. Settings and the profile
  // page live in the sidebar footer; system health is a link inside settings.
  // ── Enterprise (routed but sidebar entry managed separately) ─────────────
  {
    path: '/enterprise/time-attendance',
    component: lazy(
      () =>
        import('../pages/timeattendance/EnterpriseTimeAttendanceDashboardPage'),
    ),
  },
  {
    path: '/enterprise/learning-development',
    component: lazy(
      () => import('../pages/learning/EnterpriseLearningDevelopmentPage'),
    ),
  },
  {
    path: '/enterprise/onboarding-lifecycle',
    component: lazy(
      () => import('../pages/onboarding/EnterpriseOnboardingLifecyclePage'),
    ),
  },
  {
    path: '/enterprise/employee-relations',
    component: lazy(
      () => import('../pages/enterprise/EmployeeRelationsHubPage'),
    ),
    appShell: false,
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
    path: '/developer',
    component: lazy(() => import('../pages/DeveloperCenter')),
    label: 'Developer Center',
    group: 'workplace',
    icon: 'code',
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
  'AllowanceAuditDashboard.jsx': 'Work in progress',
  'BiometricSyncDashboard.jsx': 'Work in progress',
  'BoomerangRehireWizard.jsx': 'Work in progress',
  'CommissionDashboard.jsx': 'Work in progress',
  'ComplianceDashboard.jsx': 'Work in progress',
  'ComplianceVault.jsx': 'Work in progress',
  'EntityHierarchy.jsx': 'Work in progress',
  'EquitySettlementDashboard.jsx': 'Work in progress',
  'EscrowAdmin.jsx': 'Work in progress',
  'EthicsReviewBoard.jsx': 'Work in progress',
  'EWAPortal.jsx': 'Work in progress',
  'ExpenseSubmission.jsx': 'Work in progress',
  'FleetDashboard.jsx': 'Work in progress',
  'FXPayrollDashboard.jsx': 'Work in progress',
  'GarnishmentAdmin.jsx': 'Work in progress',
  'GlobalMobilityDashboard.jsx': 'Work in progress',
  'HandoverDashboard.jsx': 'Work in progress',
  'InternalHiringPipeline.jsx': 'Work in progress',
  'InternalJobBoard.jsx': 'Work in progress',
  'InviteAcceptPage.jsx': 'Work in progress',
  'KudosFeed.jsx': 'Work in progress',
  'LoanPortal.jsx': 'Work in progress',
  'ManagerClearance.jsx': 'Work in progress',
  'MatrixOrgChart.jsx': 'Work in progress',
  'OkrDashboard.jsx': 'Work in progress',
  'OnboardingDashboard.jsx': 'Work in progress',
  'OpenShifts.jsx': 'Work in progress',
  'PayrollComparisonDashboard.jsx': 'Work in progress',
  'PolicySettings.jsx': 'Work in progress',
  'RecognitionSettings.jsx': 'Work in progress',
  'ReconciliationDashboard.jsx': 'Work in progress',
  'ReferralAdminDashboard.jsx': 'Work in progress',
  'ReferralPortal.jsx': 'Work in progress',
  'RelocationTracker.jsx': 'Work in progress',
  'RemoteWorkerTaxReport.jsx': 'Work in progress',
  'ReversalDashboard.jsx': 'Work in progress',
  'RosterGenerator.jsx': 'Work in progress',
  'ShiftMarketplace.jsx': 'Work in progress',
  'TaxJurisdictionSettings.jsx': 'Work in progress',
  'TimesheetTracker.jsx': 'Work in progress',
  'TipPoolDashboard.jsx': 'Work in progress',
  'ToilDashboard.jsx': 'Work in progress',
  'ToilPolicySettings.jsx': 'Work in progress',
  'TrainingCatalog.jsx': 'Work in progress',
  'TravelDesk.jsx': 'Work in progress',
  'TravelSettlement.jsx': 'Work in progress',
  'TripLogger.jsx': 'Work in progress',
  'UnionAdminDashboard.jsx': 'Work in progress',
  'VendorComplianceVault.jsx': 'Work in progress',
  'WCAuditDashboard.jsx': 'Work in progress',
  'WellnessDashboard.jsx': 'Work in progress',
  'WhistleblowerPortal.jsx': 'Work in progress',
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
