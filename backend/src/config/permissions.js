/**
 * Canonical RBAC vocabulary for PaySphere.
 *
 * Both the seeder and the route definitions read from this file so the set of
 * permission names can never drift between "what gets written to the database"
 * and "what the routes ask for" — a mismatch there is invisible until a user
 * hits a 403 they should not have hit.
 */

// --- Permissions -----------------------------------------------------------

const PERMISSIONS = {
  READ_EMPLOYEE: 'READ_EMPLOYEE',
  WRITE_EMPLOYEE: 'WRITE_EMPLOYEE',
  DELETE_EMPLOYEE: 'DELETE_EMPLOYEE',
  READ_PAYROLL: 'READ_PAYROLL',
  WRITE_PAYROLL: 'WRITE_PAYROLL',
  // Maker–checker: the account that submits a payroll run should not be the
  // only thing standing between a figure and a bank transfer. Kept separate
  // from WRITE_PAYROLL so the two can be held by different people (#458).
  APPROVE_PAYROLL: 'APPROVE_PAYROLL',
  READ_REPORT: 'READ_REPORT',
  // Kept apart from READ_REPORT because they are not the same act. Viewing a
  // report is a read; standing up a recurring job that mails a payroll register
  // to an address of your choosing is a write, and a fairly serious one. Both
  // scheduler write routes were gated on READ_REPORT, which every role holds
  // including Employee — so anyone who could view a report could also schedule
  // an export of company salary data to an external mailbox, or delete another
  // admin's schedule (#666).
  MANAGE_REPORT_SCHEDULE: 'MANAGE_REPORT_SCHEDULE',
  // A webhook endpoint is a standing instruction to POST company payroll and
  // employee data to an external URL, signed with a secret this account owns.
  // Creating, editing, rotating the secret for or deleting one is a write that
  // can point data anywhere, so it is its own permission and it stays with the
  // owner role — deliberately not something every admin of the workspace can do
  // (#474).
  MANAGE_WEBHOOKS: 'MANAGE_WEBHOOKS',
  // Connecting an HRMS (#954) points an external system at the whole employee
  // directory and lets it write into it, under credentials this account
  // installs. Same class of authority as MANAGE_WEBHOOKS above, and kept with
  // the owner for the same reason.
  MANAGE_INTEGRATIONS: 'MANAGE_INTEGRATIONS',
  // Expense claims (#719). routes/expense.routes.js has asked for these since
  // it was written and none of them existed here, so the seeder never created
  // them, no role held them, and every expense endpoint answered 403 for every
  // account in the product — the owner included, because SUPER_ADMIN below is a
  // fixed list and not a wildcard (#794).
  READ_EXPENSE: 'READ_EXPENSE',
  WRITE_EXPENSE: 'WRITE_EXPENSE',
  // Kept apart from WRITE_EXPENSE for the same reason APPROVE_PAYROLL is kept
  // apart from WRITE_PAYROLL: whoever submits a claim for payment should not be
  // the only person standing between it and a bank transfer.
  APPROVE_EXPENSE: 'APPROVE_EXPENSE',
  // A category carries the `isTaxable` flag, which decides whether a claim is
  // paid as taxable earnings or as a tax-free reimbursement. That is a tax
  // decision rather than day-to-day expense admin, so it stays with the owner.
  MANAGE_EXPENSE_CATEGORY: 'MANAGE_EXPENSE_CATEGORY',
  // Statutory compliance (#933, reachable since #951). Deliberately not
  // READ_REPORT: a Form 16 is one person's complete tax position and a Form 24Q
  // export is every employee's PAN, salary and tax in one file, while
  // READ_REPORT is held by every role including Employee.
  // Declared here because `routes/role.routes.js` gates all four of its routes
  // on it and `PERMISSION_DEFINITIONS` below already has an entry for it — but
  // the name itself was never added to this object, so every one of those
  // routes called `requirePermission(undefined)` and the definition was written
  // to the database with `name: undefined`. Found while adding the compliance
  // permissions below, because the invariant tests in `permissions.expense.test`
  // and `rbac.seed.test` fail on it.
  MANAGE_ROLES: 'MANAGE_ROLES',
  READ_COMPLIANCE: 'READ_COMPLIANCE',
  // Writing the company's TAN, or marking a tax declaration verified, decides
  // what gets filed with the tax department under the employer's name. Kept
  // with the owner for the same reason MANAGE_EXPENSE_CATEGORY is.
  MANAGE_COMPLIANCE: 'MANAGE_COMPLIANCE',

  // --- Feature areas that had no vocabulary of their own (#1011) -----------
  //
  // Eight areas shipped between #955 and #993 and every one reused
  // WRITE_EMPLOYEE and READ_EMPLOYEE as a catch-all, so those two guarded 36
  // of the 52 gated routes in the product. WRITE_EMPLOYEE is what you give an
  // HR coordinator so they can add a joiner; it also authorised running
  // depreciation across the fixed-asset register, setting the TDS withheld on
  // a vendor invoice, issuing employment contracts and writing anybody's
  // performance rating.
  //
  // That matters more than tidiness because #475's custom-role feature is
  // live. An owner composing a least-privilege role at /api/roles is shown
  // WRITE_EMPLOYEE described as employee-record editing, and the description
  // was false.

  READ_ASSET: 'READ_ASSET',
  MANAGE_ASSET: 'MANAGE_ASSET',
  // Separate from MANAGE_ASSET, and deliberately not held by HR. Depreciation
  // writes book values across the whole register in one call — an accounting
  // period action, closer to MANAGE_COMPLIANCE than to assigning a laptop.
  RUN_DEPRECIATION: 'RUN_DEPRECIATION',

  READ_VENDOR: 'READ_VENDOR',
  // Recording a vendor invoice sets the 194C/194J TDS withheld, and therefore
  // what the company remits on that contractor's behalf. Same class of
  // authority as MANAGE_COMPLIANCE.
  MANAGE_VENDOR: 'MANAGE_VENDOR',

  READ_ROSTER: 'READ_ROSTER',
  MANAGE_ROSTER: 'MANAGE_ROSTER',

  READ_CONTRACT: 'READ_CONTRACT',
  // Issuing an offer letter commits the company to a salary. Kept apart from
  // WRITE_EMPLOYEE for the same reason APPROVE_PAYROLL is kept apart from
  // WRITE_PAYROLL.
  MANAGE_CONTRACT: 'MANAGE_CONTRACT',

  READ_APPRAISAL: 'READ_APPRAISAL',
  MANAGE_APPRAISAL: 'MANAGE_APPRAISAL',
  // Self-service. An employee reading their own review is not the same act as
  // an HR manager reading everyone's, and gating the first on READ_EMPLOYEE —
  // which the Employee role does hold — happened to work while describing the
  // wrong thing.
  READ_OWN_APPRAISAL: 'READ_OWN_APPRAISAL',

  READ_INVOICE: 'READ_INVOICE',
  MANAGE_INVOICE: 'MANAGE_INVOICE',

  // Self-service, and the reverse mistake: `POST /api/tax-proofs` is an
  // employee uploading their own investment proof, and it was gated on
  // WRITE_EMPLOYEE — which a rank-and-file employee does not hold and should
  // not. TaxProofPortal.jsx therefore 403s for every user it was built for.
  SUBMIT_TAX_PROOF: 'SUBMIT_TAX_PROOF',
  // The HR side of the same feature: approving a proof changes the TDS
  // deducted from somebody's salary.
  VERIFY_TAX_PROOF: 'VERIFY_TAX_PROOF',

  READ_PYQ: 'READ_PYQ',
  // `pyq.routes.js` applied `auth` and nothing else, so any authenticated
  // account in any tenant could bulk-upload questions and trigger forecast
  // generation.
  MANAGE_PYQ: 'MANAGE_PYQ',

  // --- Salary disbursement (#1075) -----------------------------------------
  READ_DISBURSEMENT: 'READ_DISBURSEMENT',
  // Building a batch, validating it and downloading the bank file. The download
  // is the only response in the product that carries full bank account numbers,
  // which is why it is not covered by the read permission.
  MANAGE_DISBURSEMENT: 'MANAGE_DISBURSEMENT',
  // The point of no return, and kept apart for the same maker-checker reason as
  // APPROVE_PAYROLL (#458): whoever assembles a payment file should not be the
  // only person standing between it and a bank transfer. This is the highest
  // consequence write in the product — everything else changes a record, this
  // one moves money out of the company account into several hundred others.
  RELEASE_DISBURSEMENT: 'RELEASE_DISBURSEMENT',

  // --- Training and certification (#1076) ----------------------------------
  READ_TRAINING: 'READ_TRAINING',
  // Creating courses, assigning them, recording completions and waiving
  // obligations. Stays with HR rather than moving to the owner: assigning
  // fire-safety training commits no budget and moves no money. The one action
  // with real weight is the waiver, and that is bounded by the endpoint
  // requiring a written reason.
  MANAGE_TRAINING: 'MANAGE_TRAINING',
  // Self-service. `getMyTraining` resolves the employee from `req.userId`.
  COMPLETE_OWN_TRAINING: 'COMPLETE_OWN_TRAINING',

  // --- Equity (#1073) ------------------------------------------------------
  //
  // Three names rather than the usual read/write pair, because the acts differ
  // in kind and not just in direction.
  READ_ESOP: 'READ_ESOP',
  // Issuing a grant dilutes the cap table, and recording an exercise creates a
  // perquisite filed under the employer's TAN. Neither is HR admin. This is
  // MANAGE_CONTRACT's reasoning — an offer letter commits the company to a
  // salary — one notch further along, so it stops at the owner.
  MANAGE_ESOP: 'MANAGE_ESOP',
  // Self-service. `getMyGrants` resolves the employee from `req.userId`, so
  // holding this does not let one employee read a colleague's holding.
  READ_OWN_ESOP: 'READ_OWN_ESOP',

  // --- Recruitment (#1074) -------------------------------------------------
  READ_REQUISITION: 'READ_REQUISITION',
  // Opening a role commits headcount budget, and the approved CTC band is what
  // every offer is checked against — so being able to widen a band is being
  // able to approve any offer. Owner only, for the same reason MANAGE_CONTRACT
  // is.
  MANAGE_REQUISITION: 'MANAGE_REQUISITION',
  // Running the pipeline: adding applicants and moving them between stages.
  // HR's day job, and deliberately not the same authority as setting the band
  // those candidates are offered against.
  MANAGE_CANDIDATE: 'MANAGE_CANDIDATE',
  // Interviewers are not recruiters. This is held by whoever sits on a panel,
  // which is a different and much larger population than HR.
  SUBMIT_INTERVIEW_FEEDBACK: 'SUBMIT_INTERVIEW_FEEDBACK',
};

const PERMISSION_DEFINITIONS = [
  {
    name: PERMISSIONS.READ_EMPLOYEE,
    description: 'View the employee directory and individual employee records',
  },
  {
    name: PERMISSIONS.WRITE_EMPLOYEE,
    description: 'Create and update employees, and import them from CSV',
  },
  {
    name: PERMISSIONS.DELETE_EMPLOYEE,
    description: 'Permanently delete an employee and their payroll history',
  },
  {
    name: PERMISSIONS.READ_PAYROLL,
    description: 'View payroll summaries and export payroll data',
  },
  {
    name: PERMISSIONS.WRITE_PAYROLL,
    description: 'Finalize payroll runs and dispatch payslip emails',
  },
  {
    name: PERMISSIONS.APPROVE_PAYROLL,
    description:
      'Approve or reject a submitted payroll run before it can be paid',
  },
  {
    name: PERMISSIONS.READ_REPORT,
    description: 'View analytics and download generated reports',
  },
  {
    name: PERMISSIONS.MANAGE_REPORT_SCHEDULE,
    description:
      'Create and delete recurring report schedules, which mail company data to their recipients',
  },
  {
    name: PERMISSIONS.MANAGE_WEBHOOKS,
    description:
      'Create, update and delete webhook endpoints, which receive company data when payroll or employee events fire',
  },
  {
    name: PERMISSIONS.MANAGE_INTEGRATIONS,
    description:
      'Connect, configure and sync an external HRMS, which can read and write the employee directory',
  },
  {
    name: PERMISSIONS.READ_EXPENSE,
    description: 'View expense claims and the categories they are filed under',
  },
  {
    name: PERMISSIONS.WRITE_EXPENSE,
    description: 'Submit expense claims with receipts',
  },
  {
    name: PERMISSIONS.APPROVE_EXPENSE,
    description:
      'Approve or reject a submitted expense claim, which schedules it for reimbursement in the next payroll run',
  },
  {
    name: PERMISSIONS.MANAGE_EXPENSE_CATEGORY,
    description:
      'Create and edit expense categories, including whether a category is taxable',
  },
  {
    name: PERMISSIONS.READ_COMPLIANCE,
    description:
      'View compliance settings and download Form 16 certificates and Form 24Q returns',
  },
  {
    name: PERMISSIONS.MANAGE_COMPLIANCE,
    description:
      "Set the company's TAN and PAN and record or verify employee tax declarations",
  },
  {
    name: PERMISSIONS.MANAGE_ROLES,
    description:
      'Create, update and delete custom roles and their permission sets',
  },

  // #1011.
  {
    name: PERMISSIONS.READ_ASSET,
    description:
      'View the fixed-asset register and who is currently holding each asset',
  },
  {
    name: PERMISSIONS.MANAGE_ASSET,
    description:
      'Register assets, and check them out to and back in from employees',
  },
  {
    name: PERMISSIONS.RUN_DEPRECIATION,
    description:
      'Run the monthly depreciation schedule, which rewrites the book value of every asset',
  },
  {
    name: PERMISSIONS.READ_VENDOR,
    description: 'View contractors, their invoices and their payment ledger',
  },
  {
    name: PERMISSIONS.MANAGE_VENDOR,
    description:
      'Register contractors and record invoices, which sets the 194C/194J TDS withheld on their behalf',
  },
  {
    name: PERMISSIONS.READ_ROSTER,
    description: 'View published shift rosters',
  },
  {
    name: PERMISSIONS.MANAGE_ROSTER,
    description:
      'Create shift templates, assign shifts, and approve shift swaps',
  },
  {
    name: PERMISSIONS.READ_CONTRACT,
    description: 'View issued offer letters and employment contracts',
  },
  {
    name: PERMISSIONS.MANAGE_CONTRACT,
    description:
      'Issue offer letters and employment contracts, which commit the company to a salary',
  },
  {
    name: PERMISSIONS.READ_APPRAISAL,
    description: "View appraisal cycles, goals and any employee's review",
  },
  {
    name: PERMISSIONS.MANAGE_APPRAISAL,
    description:
      'Open appraisal cycles, set goals, and record manager ratings and increment recommendations',
  },
  {
    name: PERMISSIONS.READ_OWN_APPRAISAL,
    description: 'View and self-rate your own performance review',
  },
  {
    name: PERMISSIONS.READ_INVOICE,
    description: 'View client invoices, the receivables dashboard and ageing',
  },
  {
    name: PERMISSIONS.MANAGE_INVOICE,
    description: 'Raise client invoices and record payments against them',
  },
  {
    name: PERMISSIONS.SUBMIT_TAX_PROOF,
    description:
      'Submit your own investment proofs and view the ones you have submitted',
  },
  {
    name: PERMISSIONS.VERIFY_TAX_PROOF,
    description:
      'Approve or reject submitted investment proofs, which changes the TDS deducted from that salary',
  },
  {
    name: PERMISSIONS.READ_PYQ,
    description: 'View the previous-year question bank and trend forecasts',
  },
  {
    name: PERMISSIONS.MANAGE_PYQ,
    description:
      'Add and bulk-upload previous-year questions, and generate trend forecasts',
  },

  // #1074.
  {
    name: PERMISSIONS.READ_REQUISITION,
    description:
      'View job requisitions, candidates, interview scorecards and hiring funnel analytics',
  },
  {
    name: PERMISSIONS.MANAGE_REQUISITION,
    description:
      'Open, hold and close job requisitions, and set the approved CTC band every offer is checked against',
  },
  {
    name: PERMISSIONS.MANAGE_CANDIDATE,
    description:
      'Add candidates and move them through the hiring pipeline, including making offers and recording hires',
  },
  {
    name: PERMISSIONS.SUBMIT_INTERVIEW_FEEDBACK,
    description:
      'Submit an interview scorecard for a candidate you interviewed',
  },

  // #1076.
  {
    name: PERMISSIONS.READ_TRAINING,
    description:
      'View the training catalogue and the certification compliance and expiry reports',
  },
  {
    name: PERMISSIONS.MANAGE_TRAINING,
    description:
      'Create training courses, assign them, record completions, and waive a mandatory training obligation',
  },
  {
    name: PERMISSIONS.COMPLETE_OWN_TRAINING,
    description:
      'View your own assigned training, certifications and renewal dates',
  },

  // #1073.
  {
    name: PERMISSIONS.READ_ESOP,
    description:
      'View stock option schemes, every employee grant and its vesting position',
  },
  {
    name: PERMISSIONS.MANAGE_ESOP,
    description:
      'Open option schemes, issue grants against the authorised pool, and record exercises and forfeitures',
  },
  {
    name: PERMISSIONS.READ_OWN_ESOP,
    description: 'View your own option grants, vesting schedule and exercises',
  },

  // #1074.
  {
    name: PERMISSIONS.READ_DISBURSEMENT,
    description:
      'View salary disbursement batches, their control totals and which credits the bank returned',
  },
  {
    name: PERMISSIONS.MANAGE_DISBURSEMENT,
    description:
      'Build and validate a disbursement batch, download the bank payment file, and record returns',
  },
  {
    name: PERMISSIONS.RELEASE_DISBURSEMENT,
    description:
      'Release a validated disbursement batch for payment — the irreversible step that moves the money',
  },
];

// --- Roles -----------------------------------------------------------------

const ROLES = {
  SUPER_ADMIN: 'SuperAdmin',
  HR_MANAGER: 'HRManager',
  EMPLOYEE: 'Employee',
};

/**
 * The role granted to an account at registration.
 *
 * In PaySphere the person who signs up *is* the business owner: there is no
 * invitation flow, and every query in every controller is already scoped by
 * `createdBy: req.userId`. An account therefore only ever reaches its own
 * company's data, so granting the owner role at signup is the correct default
 * rather than a privilege escalation.
 */
const DEFAULT_ROLE = ROLES.SUPER_ADMIN;

const ROLE_DEFINITIONS = [
  {
    name: ROLES.SUPER_ADMIN,
    permissions: [
      PERMISSIONS.READ_EMPLOYEE,
      PERMISSIONS.WRITE_EMPLOYEE,
      PERMISSIONS.DELETE_EMPLOYEE,
      PERMISSIONS.READ_PAYROLL,
      PERMISSIONS.WRITE_PAYROLL,
      PERMISSIONS.APPROVE_PAYROLL,
      PERMISSIONS.READ_REPORT,
      PERMISSIONS.MANAGE_REPORT_SCHEDULE,
      PERMISSIONS.MANAGE_WEBHOOKS,
      PERMISSIONS.MANAGE_INTEGRATIONS,
      PERMISSIONS.READ_EXPENSE,
      PERMISSIONS.WRITE_EXPENSE,
      PERMISSIONS.APPROVE_EXPENSE,
      PERMISSIONS.MANAGE_EXPENSE_CATEGORY,
      PERMISSIONS.READ_COMPLIANCE,
      PERMISSIONS.MANAGE_COMPLIANCE,
      // Held by the owner alone: a role edit changes what every other account
      // in the company can do.
      PERMISSIONS.MANAGE_ROLES,

      // #1011. The owner holds everything, including the three that stop at
      // the owner on purpose — RUN_DEPRECIATION, MANAGE_VENDOR and
      // MANAGE_CONTRACT all move money or commit the company.
      PERMISSIONS.READ_ASSET,
      PERMISSIONS.MANAGE_ASSET,
      PERMISSIONS.RUN_DEPRECIATION,
      PERMISSIONS.READ_VENDOR,
      PERMISSIONS.MANAGE_VENDOR,
      PERMISSIONS.READ_ROSTER,
      PERMISSIONS.MANAGE_ROSTER,
      PERMISSIONS.READ_CONTRACT,
      PERMISSIONS.MANAGE_CONTRACT,
      PERMISSIONS.READ_APPRAISAL,
      PERMISSIONS.MANAGE_APPRAISAL,
      PERMISSIONS.READ_OWN_APPRAISAL,
      PERMISSIONS.READ_INVOICE,
      PERMISSIONS.MANAGE_INVOICE,
      PERMISSIONS.SUBMIT_TAX_PROOF,
      PERMISSIONS.VERIFY_TAX_PROOF,
      PERMISSIONS.READ_PYQ,
      PERMISSIONS.MANAGE_PYQ,

      // #1075.
      PERMISSIONS.READ_DISBURSEMENT,
      PERMISSIONS.MANAGE_DISBURSEMENT,
      PERMISSIONS.RELEASE_DISBURSEMENT,

      // #1076.
      PERMISSIONS.READ_TRAINING,
      PERMISSIONS.MANAGE_TRAINING,
      PERMISSIONS.COMPLETE_OWN_TRAINING,

      // #1073. MANAGE_ESOP stops here — it is the only permission in the
      // product that changes who owns the company.
      PERMISSIONS.READ_ESOP,
      PERMISSIONS.MANAGE_ESOP,
      PERMISSIONS.READ_OWN_ESOP,

      // #1074.
      PERMISSIONS.READ_REQUISITION,
      PERMISSIONS.MANAGE_REQUISITION,
      PERMISSIONS.MANAGE_CANDIDATE,
      PERMISSIONS.SUBMIT_INTERVIEW_FEEDBACK,
    ],
  },
  {
    name: ROLES.HR_MANAGER,
    // Can run payroll day to day, but cannot destroy an employee's history —
    // and deliberately cannot approve its own submissions. The HR manager is
    // the maker; the owner is the checker (#458).
    permissions: [
      PERMISSIONS.READ_EMPLOYEE,
      PERMISSIONS.WRITE_EMPLOYEE,
      PERMISSIONS.READ_PAYROLL,
      PERMISSIONS.WRITE_PAYROLL,
      PERMISSIONS.READ_REPORT,
      // Expenses are HR's day job: file them on an employee's behalf, and sign
      // off the ones that come in. Not MANAGE_EXPENSE_CATEGORY — `isTaxable`
      // decides how a claim is taxed, and that stays with the owner.
      PERMISSIONS.READ_EXPENSE,
      PERMISSIONS.WRITE_EXPENSE,
      PERMISSIONS.APPROVE_EXPENSE,
      // Issuing Form 16 at year end is HR's job. Setting the TAN the return is
      // filed under is not — that stays with the owner.
      PERMISSIONS.READ_COMPLIANCE,

      // #1011. The day-to-day half of each new area, and not the half that
      // moves money.
      //
      // HR issues laptops and takes them back; it does not run the
      // depreciation schedule, which rewrites book values across the whole
      // register in a single call. It reads the contractor ledger but does not
      // set the TDS withheld on an invoice. It publishes rosters, runs
      // appraisals and verifies investment proofs — all squarely HR — but
      // MANAGE_CONTRACT stays with the owner because issuing an offer letter
      // commits the company to a salary, which is the same reason
      // APPROVE_PAYROLL is not here either.
      PERMISSIONS.READ_ASSET,
      PERMISSIONS.MANAGE_ASSET,
      PERMISSIONS.READ_VENDOR,
      PERMISSIONS.READ_ROSTER,
      PERMISSIONS.MANAGE_ROSTER,
      PERMISSIONS.READ_CONTRACT,
      PERMISSIONS.READ_APPRAISAL,
      PERMISSIONS.MANAGE_APPRAISAL,
      PERMISSIONS.READ_OWN_APPRAISAL,
      PERMISSIONS.READ_INVOICE,
      PERMISSIONS.SUBMIT_TAX_PROOF,
      PERMISSIONS.VERIFY_TAX_PROOF,
      PERMISSIONS.READ_PYQ,

      // #1073. HR can see the cap table — it answers "what is this person's
      // total compensation", which is HR's question — and cannot issue against
      // it.
      PERMISSIONS.READ_ESOP,
      PERMISSIONS.READ_OWN_ESOP,

      // #1075. HR assembles the payment file; it does not release it. Same
      // maker-checker split as APPROVE_PAYROLL, which HR also does not hold.
      PERMISSIONS.READ_DISBURSEMENT,
      PERMISSIONS.MANAGE_DISBURSEMENT,

      // #1076. Squarely HR: it is HR that has to produce "who was trained,
      // when, and is it still current" during an audit.
      PERMISSIONS.READ_TRAINING,
      PERMISSIONS.MANAGE_TRAINING,
      PERMISSIONS.COMPLETE_OWN_TRAINING,

      // #1074. HR runs the pipeline and sits on panels. It does not open
      // requisitions or move the CTC band — that is headcount budget, and
      // widening a band is equivalent to approving any offer against it.
      PERMISSIONS.READ_REQUISITION,
      PERMISSIONS.MANAGE_CANDIDATE,
      PERMISSIONS.SUBMIT_INTERVIEW_FEEDBACK,
    ],
  },
  {
    name: ROLES.EMPLOYEE,
    // Read-only, plus the one thing #719 exists for: an employee filing their
    // own receipts. `submitExpense` restricts an EMPLOYEE account to its own
    // linked employee record, so holding WRITE_EXPENSE does not let someone
    // file a claim against a colleague.
    permissions: [
      PERMISSIONS.READ_EMPLOYEE,
      PERMISSIONS.READ_PAYROLL,
      PERMISSIONS.READ_EXPENSE,
      PERMISSIONS.WRITE_EXPENSE,

      // #1011. The self-service half, and the reason this role needed any new
      // permissions at all.
      //
      // Three pages were built for exactly this population and were gated on
      // permissions it does not hold: TaxProofPortal.jsx posts to
      // `/api/tax-proofs`, which asked for WRITE_EMPLOYEE, and
      // AppraisalDashboard.jsx reads `/api/appraisals/my-review`. Both would
      // have 403'd for every employee in the company.
      //
      // Each of these is bounded by the handler as well as by the permission:
      // `getMyReview` resolves the review from `req.userId`, and `submitProof`
      // files against the caller's own employee record, so holding them does
      // not let one employee read a colleague's review or file a proof in
      // their name.
      PERMISSIONS.SUBMIT_TAX_PROOF,
      PERMISSIONS.READ_OWN_APPRAISAL,
      // Employees see the roster they are on.
      PERMISSIONS.READ_ROSTER,
      PERMISSIONS.READ_PYQ,

      // #1076. Their own training record and renewal dates. Deliberately not
      // READ_TRAINING, which carries the company-wide compliance reports and
      // names every colleague who is missing a mandatory certification.
      PERMISSIONS.COMPLETE_OWN_TRAINING,

      // #1073. Their own grants only. Deliberately not READ_ESOP, which is the
      // whole company's cap table.
      PERMISSIONS.READ_OWN_ESOP,

      // #1074. An employee who interviews files a scorecard; the interviewer is
      // taken from `req.userId`, so this does not let one person file feedback
      // under another's name. Deliberately not READ_REQUISITION, which exposes
      // every candidate's expected and offered CTC.
      PERMISSIONS.SUBMIT_INTERVIEW_FEEDBACK,
    ],
  },
];

module.exports = {
  PERMISSIONS,
  PERMISSION_DEFINITIONS,
  ROLES,
  ROLE_DEFINITIONS,
  DEFAULT_ROLE,
};
