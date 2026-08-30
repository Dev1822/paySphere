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

  // --- Section 89(1) relief on salary arrears (#1969) ---------------------
  //
  // Split on which name can move a relief figure without touching a claim.
  //
  // MANAGE_TAX_RATE_TABLE is the widest authority in the module by a distance.
  // Changing the 2022-23 slabs moves every relief ever computed against a
  // relation year in that year, for every employee, with no claim record
  // changing and nothing on any screen explaining why the number is different.
  // The employee's assessed total income for a past year sits with it, because
  // six lakh rather than nine moves the marginal rate the relation-year term is
  // priced at and does the same damage by a shorter route.
  //
  // MANAGE_RELIEF_CLAIM records the arrear, its year-wise spread and the Form
  // 10E furnishing, and gives the relief in the TDS computation once the form
  // is on file. Clerical against documents.
  //
  // Deliberately not the payroll permissions. Payroll answers what was paid;
  // this answers what the bunching of that payment cost in tax, and the section
  // 201(1A) interest for getting it wrong lands on the employer.
  READ_ARREAR_RELIEF: 'READ_ARREAR_RELIEF',
  MANAGE_RELIEF_CLAIM: 'MANAGE_RELIEF_CLAIM',
  MANAGE_TAX_RATE_TABLE: 'MANAGE_TAX_RATE_TABLE',
  WRITE_EMPLOYEE: 'WRITE_EMPLOYEE',
  DELETE_EMPLOYEE: 'DELETE_EMPLOYEE',
  // --- Section 10A, Standing Orders Act, 1946 (#1828) ----------------------
  //
  // Above the payroll names because a suspended workman is neither on payroll
  // nor off it: the employment subsists, no work is done, and the employer owes
  // a rising statutory scale.
  //
  // The middle name is the module's whole subject. The attributability finding
  // — whose conduct delayed the enquiry — decides fifty per cent against
  // seventy-five from day ninety-one, so it sits behind its own permission
  // rather than travelling with the suspension record. Whoever orders a
  // suspension should not also decide that the delay in enquiring into it was
  // nobody's fault.
  //
  // There is deliberately no permission for setting the *rate*. The rate is a
  // consequence of the finding, and an overridable rate would let the stored
  // number stop saying whether a finding was made.
  READ_SUSPENSION: 'READ_SUSPENSION',
  MANAGE_SUSPENSION: 'MANAGE_SUSPENSION',
  DETERMINE_SUSPENSION_DELAY: 'DETERMINE_SUSPENSION_DELAY',

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

  // --- Statutory bonus, Payment of Bonus Act 1965 (#1346) ------------------
  //
  // Deliberately not READ_PAYROLL and WRITE_PAYROLL, which every payroll
  // administrator holds. A statutory bonus computation reads the company's
  // gross profit and its section 6 prior charges — figures out of the audited
  // accounts that payroll staff have no other reason to see — and committing
  // one declares what the establishment owes under a statute, sets on or sets
  // off a balance that binds the next four years, and produces the Form C an
  // inspector asks for. That is MANAGE_COMPLIANCE's class of authority rather
  // than payroll admin's.
  READ_STATUTORY_BONUS: 'READ_STATUTORY_BONUS',
  MANAGE_STATUTORY_BONUS: 'MANAGE_STATUTORY_BONUS',

  // --- Minimum Wages Act, 1948 (#1698) -------------------------------------
  //
  // Three rather than two, because transcribing a gazetted rate and committing
  // the finding that measures the employer against it are different acts. The
  // rate is a fact about the world; the assessment is a statement about what
  // this employer owes, and it is the document an inspector is handed. Holding
  // both halves of that check in one pair of hands is how a shortfall gets
  // assessed away by editing the rate it was measured against.
  READ_MINIMUM_WAGE: 'READ_MINIMUM_WAGE',
  MANAGE_MINIMUM_WAGE_SCHEDULE: 'MANAGE_MINIMUM_WAGE_SCHEDULE',
  RUN_MINIMUM_WAGE_ASSESSMENT: 'RUN_MINIMUM_WAGE_ASSESSMENT',

  // --- Payment of Wages Act, 1936 (#1767) ----------------------------------
  //
  // Next to the minimum wage names because the two are the same shape of rule
  // — one sets the floor under what must be paid and this one sets the ceiling
  // on what may be taken back out — and split three ways for the same reason.
  // The rules decide what counts as a breach: raising the section 1(6)
  // applicability ceiling takes employees out of the Act entirely and every
  // finding against them disappears, with nothing in the register saying so.
  //
  // Deliberately not gated on the payroll permissions, though it is computed
  // from those rows. Payroll answers "what was this person paid"; this answers
  // "was the employer allowed to take that much", and the people who audit the
  // second are not the people who run the first.
  READ_WAGE_DEDUCTIONS: 'READ_WAGE_DEDUCTIONS',

  // --- National and Festival Holidays Acts (#1970) ------------------------
  //
  // Split on which name can take a paid day away from somebody.
  //
  // MANAGE_HOLIDAY_CALENDAR opens the year, declares the festival holidays and
  // settles the list with the Inspector. Clerical: the three national days are
  // seeded rather than typed, the festival count is measured against the
  // state's figure, and the settlement date is checkable against the Rules.
  //
  // MANAGE_HOLIDAY_SUBSTITUTION is separate because it is the only power in the
  // module that changes which day an employee gets off — and because the engine
  // refuses it outright against the three national days. Folding the two
  // together would make that refusal read as a setting somebody forgot to
  // switch on rather than as a limit on the employer's power.
  //
  // Deliberately not the leave permissions. Leave is applied for, approved and
  // deducted from a balance; a holiday is none of those, cannot be refused, and
  // one of the three cannot even be moved.
  READ_HOLIDAY_CALENDAR: 'READ_HOLIDAY_CALENDAR',
  MANAGE_HOLIDAY_CALENDAR: 'MANAGE_HOLIDAY_CALENDAR',
  MANAGE_HOLIDAY_SUBSTITUTION: 'MANAGE_HOLIDAY_SUBSTITUTION',
  MANAGE_WAGE_DEDUCTION_RULES: 'MANAGE_WAGE_DEDUCTION_RULES',
  COMMIT_WAGE_DEDUCTION_REGISTER: 'COMMIT_WAGE_DEDUCTION_REGISTER',
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

  // --- Code on Social Security, 2020, section 114 (#1829) ------------------
  //
  // Next to the compliance names because the turnover half has exactly
  // MANAGE_COMPLIANCE's shape of authority: the aggregator's turnover is the
  // base of the levy, nothing in this product produces it, and there is no
  // payroll figure anywhere to check a stated figure against.
  //
  // The split follows the two axes the module keeps apart. The levy is per
  // platform on its own turnover; the register is per *person*, because the
  // same gig worker may be engaged by three aggregators and is one beneficiary
  // against three contributions. Keeping the register a separate permission
  // keeps it a separate act.
  //
  // Deliberately not the employee names. A gig worker is not an employee under
  // section 2(35), and gating this on WRITE_EMPLOYEE is the first place that
  // would be lost — the failure #1771 spent a whole module avoiding.
  READ_AGGREGATOR_CONTRIBUTION: 'READ_AGGREGATOR_CONTRIBUTION',
  MANAGE_GIG_WORKER_REGISTER: 'MANAGE_GIG_WORKER_REGISTER',
  MANAGE_AGGREGATOR_TURNOVER: 'MANAGE_AGGREGATOR_TURNOVER',

  // --- Employees' State Insurance Act, 1948 (#1768) ------------------------
  //
  // Next to the compliance names because a monthly ESI return is a filing, and
  // split three ways because the wage ceiling is the same kind of lever the
  // minimum wage notification is — it decides who the scheme reaches.
  //
  // The middle name matters more here than anywhere else in the tree. Somebody
  // removed from the scheme keeps drawing benefit for three months, because the
  // benefit period lags the contribution period, so a ceiling lowered quietly
  // is a change nobody notices until a claim is rejected — and by then the
  // contribution that would have supported it was never remitted and cannot
  // retrospectively be.
  //
  // Deliberately not gated on the payroll permissions: the coverage register
  // carries a disability flag against named employees, which the payroll role
  // has no reason to hold.
  READ_ESI: 'READ_ESI',
  MANAGE_ESI_RULES: 'MANAGE_ESI_RULES',
  FILE_ESI_RETURN: 'FILE_ESI_RETURN',

  // --- Payment of Gratuity Act, 1972 (#2031) -------------------------------
  //
  // The split is on which name can reduce what an employee or their family is
  // paid.
  //
  // MANAGE_GRATUITY_CLAIM opens the obligation and records the two section 7(2)
  // notices. `payableFrom` sits here and it is the sharpest field in the
  // module: moving it forward makes an overdue gratuity look current and
  // reduces the section 7(3A) interest with nothing else on the record
  // changing.
  //
  // MANAGE_GRATUITY_NOMINATION holds the Form F. Editing a share moves money
  // between two named people on the day it is most contested, and the person it
  // was taken from is dead.
  //
  // FORFEIT_GRATUITY takes money away. The engine caps it at what section 4(6)
  // permits, but the sub-section chosen, the damage figure under (a) and
  // whether termination was for the act under (b) all move that cap.
  //
  // RECORD_GRATUITY_PAYMENT is narrowest: it carries the 7(3A) relief, and a
  // controlling-authority permission recorded that does not exist writes off a
  // statutory interest liability outright.
  //
  // Deliberately not the #1344 valuation names. Those measure the workforce's
  // obligation under Ind AS 19; these decide what one person is owed.
  READ_GRATUITY_CLAIM: 'READ_GRATUITY_CLAIM',
  MANAGE_GRATUITY_CLAIM: 'MANAGE_GRATUITY_CLAIM',
  MANAGE_GRATUITY_NOMINATION: 'MANAGE_GRATUITY_NOMINATION',
  FORFEIT_GRATUITY: 'FORFEIT_GRATUITY',
  RECORD_GRATUITY_PAYMENT: 'RECORD_GRATUITY_PAYMENT',

  IMPERSONATE_USER: 'IMPERSONATE_USER',

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

  // --- Gratuity actuarial valuation (#1344) --------------------------------
  //
  // Three names, because the three acts differ in kind.
  //
  // Reading a valuation is reading the company's balance sheet provision.
  // Running one commits the figure that goes into the accounts and becomes
  // next year's opening balance. Editing the assumptions is neither: the
  // discount rate is a judgement made with the auditor, and moving it 50 basis
  // points moves the reported liability by more than most payroll decisions
  // ever will — so it is separated for the same reason MANAGE_COMPLIANCE is
  // separated from READ_COMPLIANCE, and it stops at the owner.
  READ_GRATUITY_VALUATION: 'READ_GRATUITY_VALUATION',
  RUN_GRATUITY_VALUATION: 'RUN_GRATUITY_VALUATION',
  MANAGE_GRATUITY_ASSUMPTIONS: 'MANAGE_GRATUITY_ASSUMPTIONS',

  // --- Employees' Pension Scheme, 1995 (#1769) -----------------------------
  //
  // Directly under the gratuity names because the two are the same kind of
  // obligation valued the same way — a defined benefit on service and a final
  // salary — and split three ways for a sharper version of the same reason.
  //
  // The wage ceiling is the figure the whole capping question turns on: moving
  // it changes the pensionable salary of every member above the old one, and a
  // pension once fixed is not revisited, so the change is for life. That is a
  // larger consequence than the discount rate has and it is separated for the
  // same reason.
  //
  // MANAGE also gates the wage-history backfill. It produces no valuation, but
  // every future valuation is computed from what it writes, and a backfill that
  // resolved the ambiguous months the wrong way is harder to notice than a
  // wrong valuation and outlives it.
  READ_EPS_PENSION: 'READ_EPS_PENSION',
  MANAGE_EPS_ASSUMPTIONS: 'MANAGE_EPS_ASSUMPTIONS',
  COMMIT_EPS_VALUATION: 'COMMIT_EPS_VALUATION',

  // --- Employees' Compensation Act, 1923 (#1699) ---------------------------
  //
  // Next to the gratuity names because both measure what is owed when something
  // happens to the employment, and deliberately not a payroll permission: a
  // claim carries an employee's date of birth and the circumstances of an
  // injury — medical information about a named individual, which nothing else
  // in the product holds — and admitting one commits the company to a
  // non-discretionary payment accruing interest at twelve percent from the date
  // of the accident.
  READ_EC_CLAIM: 'READ_EC_CLAIM',

  // --- EPF International Workers, paragraph 83 (#1971) --------------------
  //
  // The split is on which name can take the ₹15,000 wage ceiling off — or put
  // it back on.
  //
  // MANAGE_IW_DETERMINATION records the paragraph 83 status and the Certificate
  // of Coverage. Both move a remittance by a factor of forty, in opposite
  // directions: the determination removes the ceiling and the certificate stops
  // the contribution altogether. Nothing else in the product moves that much
  // money on the strength of one field.
  //
  // MANAGE_IW_CONTRIBUTION computes a month's basis and files IW-1. Clerical
  // against the determination — the basis follows the status and the pay.
  //
  // Deliberately not the EPF permissions. Those cover the domestic ECR where
  // the ceiling always applies; these cover the members it never applies to.
  READ_INTERNATIONAL_WORKER: 'READ_INTERNATIONAL_WORKER',
  MANAGE_IW_CONTRIBUTION: 'MANAGE_IW_CONTRIBUTION',
  MANAGE_IW_DETERMINATION: 'MANAGE_IW_DETERMINATION',
  MANAGE_EC_CLAIM: 'MANAGE_EC_CLAIM',

  // --- Industrial Disputes Act, Chapters VA and VB (#1830) -----------------
  //
  // Next to the injury-compensation names because both are liabilities that
  // arise from an event rather than from a pay period, and split on
  // *lawfulness* rather than on money — which is unusual here and follows the
  // chapter.
  //
  // Recording a spell of lay-off is register-keeping. Recording where the
  // Chapter VB permission stands is not: that one field decides whether the
  // establishment owes half pay for forty-five days or full wages for the whole
  // period, and the second is several times the first. The threshold sits in
  // the same bracket, because raising it from one hundred to three hundred
  // turns an illegal act into a compensable one on paper without anything
  // changing on the ground.
  //
  // Section 25G's selection is there too. A departure from last-in-first-out is
  // lawful with recorded reasons and unlawful without, so who is proposed is
  // part of the same question.
  READ_LAYOFF: 'READ_LAYOFF',
  MANAGE_LAYOFF_SPELL: 'MANAGE_LAYOFF_SPELL',
  MANAGE_CHAPTER_VB_ACTION: 'MANAGE_CHAPTER_VB_ACTION',

  // --- Sections 7Q and 14B, EPF & MP Act, 1952 (#1875) ---------------------
  //
  // The split is on what a name can make disappear rather than on what it
  // touches. Keeping the remittance ledger is administration:
  // MANAGE_EPF_REMITTANCE records what a wage month owed and what was paid
  // against it, and every figure it writes is checkable against a challan.
  //
  // MANAGE_EPF_WAIVER is not that. A paragraph 32B order can take a period's
  // damages to nil, and the resulting figure is indistinguishable from a
  // liability that never arose. The rules are in the same bracket because
  // `graceDays` does the same thing by a different route — the five days that
  // followed the fifteenth were withdrawn in 2016, and restoring them turns a
  // five-day default into a compliant remittance without a rupee moving.
  READ_EPF_REMITTANCE: 'READ_EPF_REMITTANCE',
  MANAGE_EPF_REMITTANCE: 'MANAGE_EPF_REMITTANCE',
  MANAGE_EPF_WAIVER: 'MANAGE_EPF_WAIVER',

  READ_VENDOR: 'READ_VENDOR',
  // Recording a vendor invoice sets the 194C/194J TDS withheld, and therefore
  // what the company remits on that contractor's behalf. Same class of
  // authority as MANAGE_COMPLIANCE.
  MANAGE_VENDOR: 'MANAGE_VENDOR',

  // --- BOCW Welfare Cess Act, 1996 (#1827) ---------------------------------
  //
  // Next to the vendor names because every bill the cess is deducted from is a
  // vendor bill, and split from them because the deduction is not the company's
  // money to withhold or release: rule 4 takes one per cent at source and it
  // goes to a welfare board.
  //
  // The split inside is on the *base*. This is the only levy in the product
  // whose base is not a wage — it is one per cent of the cost of construction —
  // so there is no payroll figure anywhere to check it against, and moving the
  // section 3 land exclusion by a crore moves the cess by a lakh with nothing
  // objecting. The project cost, the rate and the section 7 registration
  // therefore sit together behind MANAGE_CESS_BASE, and whoever holds it does
  // not also certify the establishment against the result.
  READ_CONSTRUCTION_CESS: 'READ_CONSTRUCTION_CESS',
  MANAGE_CESS_REGISTER: 'MANAGE_CESS_REGISTER',
  MANAGE_CESS_BASE: 'MANAGE_CESS_BASE',

  // --- Contract Labour (Regulation and Abolition) Act, 1970 (#1700) --------
  //
  // Next to the vendor names, and deliberately not the same as them. The vendor
  // permission is about who the company pays; these are about the company's
  // liability for people it does not employ — the section 21 exposure is a
  // contingent liability an auditor asks about. The read is also wider than the
  // vendor ledger: it includes the establishment's own median wage per
  // designation, which is the rule 25(2)(v)(a) comparator.
  READ_CONTRACT_LABOUR: 'READ_CONTRACT_LABOUR',
  MANAGE_CONTRACT_LABOUR: 'MANAGE_CONTRACT_LABOUR',

  // --- Apprentices Act, 1961 (#1771) ---------------------------------------
  //
  // Next to the contract labour names because both are about people on the site
  // who are not on the payroll, and split three ways on the denominator.
  //
  // The band's rules and the establishment's recorded strength are the same kind
  // of lever: reducing total strength by ten lowers the floor and can make a
  // shortfall disappear without a single apprentice being engaged. So both sit
  // behind MANAGE_APPRENTICESHIP_RULES, and whoever holds it does not also
  // certify the establishment against the result.
  //
  // Deliberately not the employee permissions. An apprentice is not an employee
  // — that is the whole subject — and putting the roll behind WRITE_EMPLOYEE is
  // the first place the distinction would get lost.
  READ_APPRENTICESHIP: 'READ_APPRENTICESHIP',
  MANAGE_APPRENTICE: 'MANAGE_APPRENTICE',
  MANAGE_APPRENTICESHIP_RULES: 'MANAGE_APPRENTICESHIP_RULES',

  // --- Inter-State Migrant Workmen Act, 1979 (#1826) ------------------------
  //
  // Split on the denominators of the comparison rather than on read against
  // write. The section 13(1)(b) comparator — what a local workman doing similar
  // work is said to earn — is the sharpest lever here: lowering it makes a
  // parity breach disappear without a rupee changing hands, and unlike a wage
  // floor there is no notification anywhere to check it against. So the
  // comparator sits with the thresholds and the section 4 registration flag
  // behind MANAGE_MIGRANT_WAGE_BASIS, and whoever holds it does not also
  // certify the establishment against the result.
  //
  // Recording an allowance that was actually paid is ordinary register-keeping,
  // and sits with the roll under MANAGE_MIGRANT_WORKMAN.
  //
  // Deliberately not the contract-labour names, though a migrant workman is
  // very often also a contract workman: #1700 answers what the principal
  // employer owes for a contractor's workmen, and this answers what the workman
  // is owed for having been recruited in another state.
  // --- Article 276 and the state professional tax enactments (#1876) -------
  //
  // The split is on which name can change what a payslip already issued says.
  // MANAGE_PROFESSIONAL_TAX records a work state, a certificate and a
  // remittance, and every figure it writes is checkable against a document.
  //
  // MANAGE_PT_RULE writes the slab table, and a slab table carries an effective
  // date. Backdating one silently rewrites the deduction on payslips already
  // issued — the employee's copy and ours then disagree with nothing having
  // failed. Committing the year is in the same bracket because it fixes the
  // section 16(iii) figure the salary computation deducts, and therefore the
  // TDS in Form 24Q.
  READ_PROFESSIONAL_TAX: 'READ_PROFESSIONAL_TAX',
  MANAGE_PROFESSIONAL_TAX: 'MANAGE_PROFESSIONAL_TAX',
  MANAGE_PT_RULE: 'MANAGE_PT_RULE',

  READ_MIGRANT_WORKMEN: 'READ_MIGRANT_WORKMEN',
  MANAGE_MIGRANT_WORKMAN: 'MANAGE_MIGRANT_WORKMAN',
  MANAGE_MIGRANT_WAGE_BASIS: 'MANAGE_MIGRANT_WAGE_BASIS',

  READ_ROSTER: 'READ_ROSTER',
  MANAGE_ROSTER: 'MANAGE_ROSTER',

  // --- Working hours compliance (#1702) ------------------------------------
  //
  // Next to the roster names, because the fix for a spread-over breach is a
  // different rota. The middle name is the reason there are three: the limits
  // decide what counts as a breach, so an establishment that raises its
  // spread-over to thirteen hours makes every existing finding disappear and
  // nothing in the assessment would say it had. Whoever sets them should not
  // also be certifying the establishment against them.
  //
  // Deliberately not gated on the attendance permissions either, though it is
  // computed from that ledger. Attendance answers "was this person here"; this
  // answers "is this shift pattern lawful", which is about the employer.
  READ_WORKING_HOURS: 'READ_WORKING_HOURS',
  MANAGE_WORKING_HOURS_LIMITS: 'MANAGE_WORKING_HOURS_LIMITS',
  RUN_WORKING_HOURS_ASSESSMENT: 'RUN_WORKING_HOURS_ASSESSMENT',

  // --- Pay equity (#1347) --------------------------------------------------
  //
  // Its own pair rather than READ_EMPLOYEE, because the gap analysis reads
  // declared gender — sensitive personal data, and the only place in the
  // product that holds any. The population that should be running a pay gap
  // analysis is much smaller than the population that can look up a colleague's
  // phone number, and the access decision should say so rather than being
  // inherited from the directory.
  //
  // Note what is deliberately *not* behind these: the compa-ratio analysis
  // reads salary and salary bands and no protected characteristic at all, so it
  // sits behind READ_PAYROLL. Hiding the most useful and least sensitive query
  // in the module behind the demographic permission would stop the people who
  // should run it weekly from running it.
  READ_PAY_EQUITY: 'READ_PAY_EQUITY',
  // Committing a report publishes a figure that is a statutory filing in a
  // growing number of jurisdictions, and setting a salary band decides what
  // everybody at that grade is checked against.
  MANAGE_PAY_EQUITY: 'MANAGE_PAY_EQUITY',

  // --- Child and Adolescent Labour Act, 1986 (#1877) -----------------------
  //
  // The split is on which field can turn a prohibited engagement into a
  // permitted one. MANAGE_YOUNG_PERSON_REGISTER keeps the section 11 register —
  // who is engaged, in what work, for which hours — and every entry in it is
  // checkable against the person standing in the establishment.
  //
  // MANAGE_AGE_RECORD writes the date of birth, and that one date decides
  // whether section 3's total bar applies at all: moving it by a year moves
  // somebody across the fourteen or the eighteen boundary. Resolving a finding
  // is in the same bracket, so that no single account can both create the
  // appearance of lawfulness and close the finding that would have said
  // otherwise.
  READ_YOUNG_PERSON: 'READ_YOUNG_PERSON',
  MANAGE_YOUNG_PERSON_REGISTER: 'MANAGE_YOUNG_PERSON_REGISTER',
  MANAGE_AGE_RECORD: 'MANAGE_AGE_RECORD',

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

  // --- Perquisite valuation under Rule 3 (#1770) ---------------------------
  //
  // Next to the tax-proof names because both decide what a Form 16 says, and
  // split three ways on a line that is not the usual read/write one.
  //
  // Recording a grant is HR work: somebody is given a flat, a car, a loan.
  // Setting the rules is not, and the State Bank of India rate is why — it is
  // frozen for the whole year and applied to every concessional loan in the
  // establishment, so a figure recorded a point too low understates the
  // perquisite for every borrower and nothing in a payslip would show it.
  //
  // Reading is separated from both because a perquisite statement is one
  // person's complete tax position, in the same class as the Form 16 that
  // READ_COMPLIANCE guards.
  // --- EDLI paragraph 22, the assurance benefit (#1878) --------------------
  //
  // The split is on what each name decides for a family. MANAGE_EPF_NOMINATION
  // decides *who* receives the assurance, and it is the one thing here a member
  // states for themselves — so it sits apart from everything that decides how
  // much.
  //
  // MANAGE_EDLI_CLAIM commits the figure a family is quoted and holds the two
  // inputs that move it most: the section 17(2A) exemption, which decides
  // whether the group policy or the scheme is the measure, and prior service at
  // another establishment, which decides whether the ₹2,50,000 floor applies at
  // all. They are together on purpose — an account that could record fourteen
  // months of unverified prior service and then commit the resulting claim is
  // the whole risk in this feature.
  READ_EDLI: 'READ_EDLI',
  MANAGE_EPF_NOMINATION: 'MANAGE_EPF_NOMINATION',
  MANAGE_EDLI_CLAIM: 'MANAGE_EDLI_CLAIM',

  READ_PERQUISITE: 'READ_PERQUISITE',
  MANAGE_PERQUISITE_GRANT: 'MANAGE_PERQUISITE_GRANT',
  MANAGE_PERQUISITE_RULES: 'MANAGE_PERQUISITE_RULES',

  // --- Labour Welfare Fund (#1701) -----------------------------------------
  //
  // Next to the tax-proof names because both decide a deduction from somebody's
  // pay. The deduction here is the smallest in Indian payroll; the authority is
  // not. A state rule with the wrong periodicity silently under-remits for an
  // entire workforce in that state, for years, and nothing in the payroll run
  // objects. Split three ways so that whoever maintains the amounts is not also
  // certifying the remittance measured against them.
  READ_LWF: 'READ_LWF',
  MANAGE_LWF_RULES: 'MANAGE_LWF_RULES',
  MANAGE_LWF_CONTRIBUTION: 'MANAGE_LWF_CONTRIBUTION',

  // --- Leave Travel Allowance (#1345) --------------------------------------
  //
  // The same pair as the tax proof permissions above, and deliberately not the
  // same permissions. LTA is not an annual proof: the entitlement is a
  // four-year statutory block, approving a journey consumes one of two, and the
  // decision is about the section 10(5) rules rather than about a receipt.
  // Somebody trusted to verify a rent receipt is not automatically the person
  // who should be adjudicating a carry-forward.
  SUBMIT_LTA_CLAIM: 'SUBMIT_LTA_CLAIM',
  VERIFY_LTA_CLAIM: 'VERIFY_LTA_CLAIM',

  READ_PYQ: 'READ_PYQ',
  // `pyq.routes.js` applied `auth` and nothing else, so any authenticated
  // account in any tenant could bulk-upload questions and trigger forecast
  // generation.
  MANAGE_PYQ: 'MANAGE_PYQ',

  // --- Business travel (#1077) ---------------------------------------------
  READ_TRAVEL: 'READ_TRAVEL',
  // Filing a trip you are about to take. Held by employees — that is the point
  // of the feature.
  SUBMIT_TRAVEL_REQUEST: 'SUBMIT_TRAVEL_REQUEST',
  // Approving a trip, releasing an advance and settling it. Kept apart from
  // submission for the same reason APPROVE_EXPENSE is kept apart from
  // WRITE_EXPENSE: whoever asks for the money should not be the only person
  // standing between it and a bank transfer.
  APPROVE_TRAVEL: 'APPROVE_TRAVEL',
  // The grade x city-class rate table decides what everybody in the company is
  // entitled to, so editing it is not a per-trip decision. Same class of
  // authority as MANAGE_EXPENSE_CATEGORY.
  MANAGE_TRAVEL_POLICY: 'MANAGE_TRAVEL_POLICY',

  // --- International assignments (#1348) -----------------------------------
  //
  // Next to the travel permissions and deliberately not the same ones. An
  // assignment is not a long trip: it changes where the employee is tax
  // resident, commits the employer to bearing somebody's foreign tax bill for
  // years, and can create a filing obligation in a second country. Approving a
  // per-diem and approving that are not the same act and are not the same
  // people.
  // --- Employment Exchanges (CNV) Act, 1959 (#1879) ------------------------
  //
  // The split is on which name can take a vacancy out of the Act.
  // MANAGE_VACANCY_NOTIFICATION records that the exchange was told and files
  // ER-I and ER-II; every row it writes is checkable against an
  // acknowledgement.
  //
  // MANAGE_CNV_DETERMINATION records the section 3 ground, and marking a
  // vacancy "to be filled by promotion" removes it from the Act entirely. The
  // headcount is in the same bracket because it does the same thing by a
  // different route: twenty-four as at the date a requisition opened takes
  // every requisition that month below the threshold.
  READ_VACANCY_NOTIFICATION: 'READ_VACANCY_NOTIFICATION',
  MANAGE_VACANCY_NOTIFICATION: 'MANAGE_VACANCY_NOTIFICATION',
  MANAGE_CNV_DETERMINATION: 'MANAGE_CNV_DETERMINATION',

  READ_ASSIGNMENT: 'READ_ASSIGNMENT',
  MANAGE_ASSIGNMENT: 'MANAGE_ASSIGNMENT',
  // Kept apart from MANAGE_ASSIGNMENT for the same maker-checker reason as
  // APPROVE_PAYROLL: a year-end equalization settlement moves money between the
  // employee and the company in one direction or the other, and whoever built
  // the package should not be the only person standing between it and that
  // transfer.
  SETTLE_ASSIGNMENT_TAX: 'SETTLE_ASSIGNMENT_TAX',

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
};

const PERMISSION_DEFINITIONS = [
  {
    name: PERMISSIONS.READ_ARREAR_RELIEF,
    description:
      'View the relief each salary arrear earns under section 89(1), the year-wise spread behind it, and the Form 10E position',
  },
  {
    name: PERMISSIONS.MANAGE_RELIEF_CLAIM,
    description:
      'Record an arrear and its year-wise spread, record the employee’s Form 10E furnishing, and give the relief in the TDS computation',
  },
  {
    name: PERMISSIONS.MANAGE_TAX_RATE_TABLE,
    description:
      'Maintain the dated slab, surcharge and rebate tables and the employee’s assessed income for past years — the figures every section 89(1) relief is computed against',
  },
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
    name: PERMISSIONS.READ_SUSPENSION,
    description:
      'View suspensions pending enquiry, the section 10A tier each is in and what has been paid against what was due',
  },
  {
    name: PERMISSIONS.MANAGE_SUSPENSION,
    description:
      'Order a suspension, record the monthly subsistence allowance paid, and record the enquiry’s outcome',
  },
  {
    name: PERMISSIONS.DETERMINE_SUSPENSION_DELAY,
    description:
      'Record whether the delay in completing an enquiry is attributable to the workman, which decides the 50/75/100 tier, and set the scale',
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
    name: PERMISSIONS.MANAGE_EPF_REMITTANCE,
    description:
      'Record what a wage month owed to each EPF account and the payments made against it, including a section 7A determination for a past period',
  },
  {
    name: PERMISSIONS.MANAGE_EPF_WAIVER,
    description:
      'Record a paragraph 32B damages waiver, set the interest rate, the paragraph 32A slabs and the grace period, and commit an assessment',
  },

  {
    name: PERMISSIONS.READ_EPF_REMITTANCE,
    description:
      'View the EPF remittance ledger, the section 7Q interest and section 14B damages on each default, and the member share deducted and not remitted',
  },

  {
    name: PERMISSIONS.READ_STATUTORY_BONUS,
    description:
      'View the statutory bonus computation, the set-on/set-off ledger and the Form C register',
  },
  {
    name: PERMISSIONS.MANAGE_STATUTORY_BONUS,
    description:
      'Commit a statutory bonus computation for an accounting year and record its payment',
  },
  {
    name: PERMISSIONS.READ_MINIMUM_WAGE,
    description:
      'View notified minimum wage rates, the shortfall register and what a retrospective revision would cost',
  },
  {
    name: PERMISSIONS.MANAGE_MINIMUM_WAGE_SCHEDULE,
    description:
      'Record a gazetted minimum wage notification, which is the rate every assessment is measured against',
  },
  {
    name: PERMISSIONS.RUN_MINIMUM_WAGE_ASSESSMENT,
    description:
      'Commit a minimum wage assessment for a wage period, which states what the establishment owes',
  },
  {
    name: PERMISSIONS.READ_WAGE_DEDUCTIONS,
    description:
      'View the wage deduction register — the section 7(3) aggregate ceiling, the fines realised against the section 8 three per cent, and the balances the ceiling deferred',
  },
  {
    name: PERMISSIONS.MANAGE_WAGE_DEDUCTION_RULES,
    description:
      'Set the establishment’s deduction ceilings, its approved list of acts under section 8(1) and the section 1(6) wage above which the Act does not apply',
  },
  {
    name: PERMISSIONS.COMMIT_WAGE_DEDUCTION_REGISTER,
    description:
      'Commit the section 13A register for a wage period, and write off a deferred balance that will not be recovered',
  },
  {
    name: PERMISSIONS.READ_AGGREGATOR_CONTRIBUTION,
    description:
      'View the section 114 contribution — the turnover limb against the payout ceiling, which one binds, and the gig worker register',
  },
  {
    name: PERMISSIONS.MANAGE_GIG_WORKER_REGISTER,
    description:
      'Record a gig or platform worker and their engagements across aggregators, including platforms this tenant does not operate',
  },
  {
    name: PERMISSIONS.READ_HOLIDAY_CALENDAR,
    description:
      'View the year’s national and festival holidays, the list’s settlement position with the Inspector, and what each holiday worked is owed',
  },
  {
    name: PERMISSIONS.MANAGE_HOLIDAY_CALENDAR,
    description:
      'Open a year’s holiday calendar, declare the state’s festival holidays, settle the list with the Inspector, and record a holiday worked',
  },
  {
    name: PERMISSIONS.MANAGE_HOLIDAY_SUBSTITUTION,
    description:
      'Substitute a festival holiday for another day against the employee’s recorded agreement — the three national holidays cannot be substituted at all',
  },
  {
    name: PERMISSIONS.MANAGE_AGGREGATOR_TURNOVER,
    description:
      'State the aggregator’s turnover and its Seventh Schedule split, set the rate band and the payout ceiling, finalise a year and commit the assessment',
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
    name: PERMISSIONS.READ_ESI,
    description:
      'View the ESI coverage register for the contribution period — who is in the scheme, who is being carried above the ceiling by the Rule 50 proviso, and the 78-day counts that decide benefit',
  },
  {
    name: PERMISSIONS.MANAGE_ESI_RULES,
    description:
      'Set the ESI wage ceiling, the two contribution rates and the section 42(1) daily floor, which together decide who the scheme reaches',
  },
  {
    name: PERMISSIONS.FILE_ESI_RETURN,
    description:
      'File the monthly ESI return and record its remittance, which fixes the coverage each employee carries into the next month',
  },
  {
    name: PERMISSIONS.READ_GRATUITY_CLAIM,
    description:
      'View the gratuity queue — who is payable and on what ground, the thirty days running against each claim, the section 7(3A) interest already accrued, and the Form F nomination that decides who is paid on death',
  },
  {
    name: PERMISSIONS.MANAGE_GRATUITY_CLAIM,
    description:
      'Open a gratuity claim from the last working day and record the two section 7(2) notices — to the payee and to the controlling authority',
  },
  {
    name: PERMISSIONS.MANAGE_GRATUITY_NOMINATION,
    description:
      'Record a Form F nomination and its shares — the instrument that decides who receives the amount on the death of an employee',
  },
  {
    name: PERMISSIONS.FORFEIT_GRATUITY,
    description:
      'Forfeit gratuity under section 4(6) — the sub-section relied on, the damage quantified under (a), and whether services were terminated for the act under (b)',
  },
  {
    name: PERMISSIONS.RECORD_GRATUITY_PAYMENT,
    description:
      'Record payment of gratuity and the section 7(3A) relief — the employee-fault ground together with the controlling authority’s written permission that alone stops the interest',
  },
  {
    name: PERMISSIONS.MANAGE_ROLES,
    description:
      'Create, update and delete custom roles and their permission sets',
  },
  {
    name: PERMISSIONS.MANAGE_PROFESSIONAL_TAX,
    description:
      'Record an employee’s work state and exemptions, the enrolment and registration certificates, and the remittances made under them',
  },
  {
    name: PERMISSIONS.MANAGE_PT_RULE,
    description:
      'Write a state professional tax slab table with its effective date, and commit the year’s assessment that fixes the section 16(iii) deduction',
  },
  {
    name: PERMISSIONS.READ_PROFESSIONAL_TAX,
    description:
      'View the professional tax slab rules in force, the per-employee work state and deduction, and the remittances against each registration certificate',
  },

  {
    name: PERMISSIONS.IMPERSONATE_USER,
    description:
      'Impersonate any user account to troubleshoot issues with a strict audit log',
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
    name: PERMISSIONS.READ_GRATUITY_VALUATION,
    description:
      'View the gratuity actuarial valuation, its roll-forward and the per-employee schedule behind it',
  },
  {
    name: PERMISSIONS.RUN_GRATUITY_VALUATION,
    description:
      'Commit a gratuity valuation as at a reporting date, producing the provision carried in the accounts',
  },
  {
    name: PERMISSIONS.MANAGE_GRATUITY_ASSUMPTIONS,
    description:
      'Set the discount rate, salary escalation and attrition assumptions the gratuity provision is measured on',
  },
  {
    name: PERMISSIONS.READ_EPS_PENSION,
    description:
      'View the EPS-95 valuation, a member’s pension statement and the sixty contributory months the pensionable salary was averaged over',
  },
  {
    name: PERMISSIONS.MANAGE_EPS_ASSUMPTIONS,
    description:
      'Set the EPS wage ceiling, the averaging span and the early-pension factors, and backfill the wage history every valuation is computed from',
  },
  {
    name: PERMISSIONS.COMMIT_EPS_VALUATION,
    description:
      'Commit an EPS-95 valuation as at a date, fixing the pension figure each member is quoted',
  },
  {
    name: PERMISSIONS.READ_LAYOFF,
    description:
      'View lay-off spells, the section 25B service behind each, the rolling 45-day ceiling and the Chapter VB position',
  },
  {
    name: PERMISSIONS.MANAGE_LAYOFF_SPELL,
    description:
      'Record a spell of lay-off, its section 25B service days and section 25E disentitlements, and the section 25H re-employment register',
  },
  {
    name: PERMISSIONS.MANAGE_CHAPTER_VB_ACTION,
    description:
      'Record a Chapter VB act and where its prior permission stands, set the threshold and the ceiling, propose a section 25G selection, and commit the assessment',
  },

  {
    name: PERMISSIONS.READ_EC_CLAIM,
    description:
      'View workplace injury compensation claims, including the injured employee’s age and the circumstances of the accident',
  },
  {
    name: PERMISSIONS.MANAGE_EC_CLAIM,
    description:
      'Compute a workplace injury compensation claim and record its deposit with the Commissioner or its payment',
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
    name: PERMISSIONS.MANAGE_YOUNG_PERSON_REGISTER,
    description:
      'Keep the section 11 register — the engagement, the nature of the work, the daily spells and intervals, and the notified weekly day off',
  },
  {
    name: PERMISSIONS.MANAGE_AGE_RECORD,
    description:
      'Record a person’s date of birth and what it rests on, resolve a finding, and commit the assessment',
  },
  {
    name: PERMISSIONS.READ_YOUNG_PERSON,
    description:
      'View the register of children and adolescents engaged, the section 7 hours against each, and the prohibited engagements',
  },

  {
    name: PERMISSIONS.READ_INTERNATIONAL_WORKER,
    description:
      'View the paragraph 83 register, each Certificate of Coverage as a countdown, the full-pay contribution against what the ceiling would have given, and the withdrawal position',
  },
  {
    name: PERMISSIONS.MANAGE_IW_CONTRIBUTION,
    description:
      'Compute an international worker’s monthly contribution on full pay and file the IW-1 return',
  },
  {
    name: PERMISSIONS.MANAGE_IW_DETERMINATION,
    description:
      'Record the paragraph 83 status and the Certificate of Coverage — the two determinations that take the statutory wage ceiling off a member, or stop their contribution entirely',
  },
  {
    name: PERMISSIONS.READ_CONSTRUCTION_CESS,
    description:
      'View the construction cess position per project, the advance deducted against the section 5 assessment and the beneficiary register',
  },
  {
    name: PERMISSIONS.MANAGE_CESS_REGISTER,
    description:
      'Record contractor bills with the cess withheld at source, and the building workers’ days per employer for the section 12 register',
  },
  {
    name: PERMISSIONS.MANAGE_CESS_BASE,
    description:
      'Set the cost of construction and its section 3 exclusions, the notified rate and the section 7 registration, record an assessment order, and commit the assessment',
  },
  {
    name: PERMISSIONS.READ_CONTRACT_LABOUR,
    description:
      'View the contract labour registers, the principal employer’s section 21 exposure and the wage parity comparison against directly employed staff',
  },
  {
    name: PERMISSIONS.MANAGE_CONTRACT_LABOUR,
    description:
      'Register contractors, record their licences and monthly deployments, and file the Form XXV annual return',
  },
  {
    name: PERMISSIONS.READ_APPRENTICESHIP,
    description:
      'View the apprentice roll, the section 8 engagement band and the exposure created by an unregistered contract',
  },
  {
    name: PERMISSIONS.MANAGE_APPRENTICE,
    description:
      'Engage an apprentice, record the portal registration and the monthly attendance and stipend',
  },
  {
    name: PERMISSIONS.MANAGE_APPRENTICESHIP_RULES,
    description:
      'Set the engagement band and the Rule 11 stipends, record the establishment’s total strength, and commit the assessment',
  },
  {
    name: PERMISSIONS.READ_MIGRANT_WORKMEN,
    description:
      'View the inter-state migrant register, the section 13(1)(b) parity comparison and the displacement and journey allowances owed',
  },
  {
    name: PERMISSIONS.MANAGE_MIGRANT_WORKMAN,
    description:
      'Record a migrant recruitment, the allowances actually paid, the return-journey accrual and the section 16 facilities',
  },
  {
    name: PERMISSIONS.MANAGE_MIGRANT_WAGE_BASIS,
    description:
      'Set the comparable local rate a migrant workman is measured against, the section 4 and 8 thresholds and the section 4 registration, and commit the assessment',
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
    name: PERMISSIONS.READ_WORKING_HOURS,
    description:
      'View working hours findings — daily and weekly limits, spread-over, rest intervals, weekly holidays and the quarterly overtime ceiling',
  },
  {
    name: PERMISSIONS.MANAGE_WORKING_HOURS_LIMITS,
    description:
      'Set the establishment’s working hours limits and week start, which decide what counts as a breach',
  },
  {
    name: PERMISSIONS.RUN_WORKING_HOURS_ASSESSMENT,
    description:
      'Commit a working hours assessment for a period, which states what the establishment was found to be doing',
  },
  {
    name: PERMISSIONS.READ_PAY_EQUITY,
    description:
      'View the pay gap analysis, which is computed from employees’ declared gender',
  },
  {
    name: PERMISSIONS.MANAGE_EPF_NOMINATION,
    description:
      'Record a member’s EPF Form 2 nomination, the family and the legal heirs — who the assurance is paid to',
  },
  {
    name: PERMISSIONS.MANAGE_EDLI_CLAIM,
    description:
      'Record the section 17(2A) exemption and its policy, record prior service at another establishment, and commit the assurance claim',
  },
  {
    name: PERMISSIONS.READ_EDLI,
    description:
      'View EDLI nominations, the twelve-month averaging window behind a claim, the computed assurance benefit and the section 17(2A) comparison',
  },

  {
    name: PERMISSIONS.MANAGE_PAY_EQUITY,
    description:
      'Commit a pay equity report and set the salary bands every compa-ratio is measured against',
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
    name: PERMISSIONS.READ_PERQUISITE,
    description:
      'View perquisite valuations and Form 12BA lines with the Rule 3 basis behind each',
  },
  {
    name: PERMISSIONS.MANAGE_PERQUISITE_GRANT,
    description:
      'Record what an employee has been provided — accommodation, a car, a concessional loan, an exercised option — and over what period',
  },
  {
    name: PERMISSIONS.MANAGE_PERQUISITE_RULES,
    description:
      'Set the Rule 3 accommodation bands and the frozen 1 April State Bank of India rates, and commit the year’s Form 12BA position',
  },
  {
    name: PERMISSIONS.READ_LWF,
    description:
      'View labour welfare fund rules, the contribution register and the collection calendar',
  },
  {
    name: PERMISSIONS.MANAGE_LWF_RULES,
    description:
      'Record a state’s labour welfare fund amounts, periodicity and exclusions, which every contribution in that state is computed from',
  },
  {
    name: PERMISSIONS.MANAGE_LWF_CONTRIBUTION,
    description:
      'Commit a labour welfare fund contribution for a state and period, and record its remittance challan',
  },
  {
    name: PERMISSIONS.SUBMIT_LTA_CLAIM,
    description:
      'File a Leave Travel Allowance journey and see the exemption it earns under section 10(5)',
  },
  {
    name: PERMISSIONS.MANAGE_VACANCY_NOTIFICATION,
    description:
      'Record that a vacancy was notified to the employment exchange, record how it turned out, and file ER-I and ER-II',
  },
  {
    name: PERMISSIONS.MANAGE_CNV_DETERMINATION,
    description:
      'Record a section 3 exclusion against a requisition and the establishment’s headcount as at a date — the two things that take a vacancy outside the Act',
  },
  {
    name: PERMISSIONS.READ_VACANCY_NOTIFICATION,
    description:
      'View the notification window on each open requisition, the section 3 determinations, and the ER-I and ER-II return schedule',
  },

  {
    name: PERMISSIONS.VERIFY_LTA_CLAIM,
    description:
      'Approve or reject an LTA journey, which decides how much of the allowance escapes tax',
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

  // #1077.
  {
    name: PERMISSIONS.READ_TRAVEL,
    description:
      'View travel policies, trips, settlements and the outstanding travel-advance ledger',
  },
  {
    name: PERMISSIONS.SUBMIT_TRAVEL_REQUEST,
    description: 'Submit your own business travel requests and view your trips',
  },
  {
    name: PERMISSIONS.APPROVE_TRAVEL,
    description:
      'Approve or reject a travel request, release a travel advance, and settle a trip against actuals',
  },
  {
    name: PERMISSIONS.MANAGE_TRAVEL_POLICY,
    description:
      'Set the per-diem rates, lodging caps and travel-class entitlements every grade is paid under',
  },
  {
    name: PERMISSIONS.READ_ASSIGNMENT,
    description:
      'View international assignments, their cost projections and their treaty day counts',
  },
  {
    name: PERMISSIONS.MANAGE_ASSIGNMENT,
    description:
      'Open and amend an international assignment, log host-country presence and approve its cost',
  },
  {
    name: PERMISSIONS.SETTLE_ASSIGNMENT_TAX,
    description:
      'Record a year-end tax equalization settlement, which moves money between the employee and the company',
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

  // #1075.
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
      // #1969. All three. Maintaining the rate table a relief is computed
      // against and giving that relief in the TDS computation are two halves of
      // the same check, and the owner is the one account allowed to be both.
      PERMISSIONS.READ_ARREAR_RELIEF,
      PERMISSIONS.MANAGE_RELIEF_CLAIM,
      PERMISSIONS.MANAGE_TAX_RATE_TABLE,
      // #1828. All three. Deciding whose conduct delayed an enquiry and
      // certifying the establishment against the result are the two halves of
      // one check, and the owner is the one account allowed to be both.
      PERMISSIONS.READ_SUSPENSION,
      PERMISSIONS.MANAGE_SUSPENSION,
      PERMISSIONS.DETERMINE_SUSPENSION_DELAY,

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

      // #1346.
      // #1875. All three. A paragraph 32B waiver reduces a liability the same
      // account will later be asked to certify, and the owner is the one
      // account allowed to be on both sides of that.
      PERMISSIONS.READ_EPF_REMITTANCE,
      PERMISSIONS.MANAGE_EPF_REMITTANCE,
      PERMISSIONS.MANAGE_EPF_WAIVER,

      PERMISSIONS.READ_STATUTORY_BONUS,
      PERMISSIONS.MANAGE_STATUTORY_BONUS,

      // #1698. All three, including the two that are kept apart from each other
      // below — the owner is the one account that is allowed to be both halves
      // of a check, because there is nobody above it to be the other half.
      PERMISSIONS.READ_MINIMUM_WAGE,
      PERMISSIONS.MANAGE_MINIMUM_WAGE_SCHEDULE,
      PERMISSIONS.RUN_MINIMUM_WAGE_ASSESSMENT,
      // #1970. All three. Declaring the list and moving a day off it are two
      // halves of the same check, and the owner is the one account allowed to
      // be both.
      PERMISSIONS.READ_HOLIDAY_CALENDAR,
      PERMISSIONS.MANAGE_HOLIDAY_CALENDAR,
      PERMISSIONS.MANAGE_HOLIDAY_SUBSTITUTION,

      // #1767. All three, for the reason immediately above: the owner is the
      // one account allowed to be both halves of a check. Writing off a
      // deferred balance is forgiving a debt, which is the same class of
      // authority as APPROVE_PAYROLL and stops here for that reason too.
      PERMISSIONS.READ_WAGE_DEDUCTIONS,
      PERMISSIONS.MANAGE_WAGE_DEDUCTION_RULES,
      PERMISSIONS.COMMIT_WAGE_DEDUCTION_REGISTER,

      // #1829. All three. Stating the platform's turnover and certifying the
      // contribution computed from it are the two halves of one check, and the
      // owner is the one account allowed to be both — there is nobody above it.
      PERMISSIONS.READ_AGGREGATOR_CONTRIBUTION,
      PERMISSIONS.MANAGE_GIG_WORKER_REGISTER,
      PERMISSIONS.MANAGE_AGGREGATOR_TURNOVER,

      PERMISSIONS.READ_COMPLIANCE,
      PERMISSIONS.MANAGE_COMPLIANCE,

      // #1768. All three. Filing the return is a remittance to a statutory
      // body and the ceiling decides who it covers, so both halves of that
      // check stop at the one account allowed to be both.
      PERMISSIONS.READ_ESI,
      PERMISSIONS.MANAGE_ESI_RULES,
      PERMISSIONS.FILE_ESI_RETURN,

      // #2031. All five. Forfeiting gratuity and then certifying that it was
      // lawfully forfeited are two halves of the same check, and the owner is
      // the one account allowed to be both. RECORD_GRATUITY_PAYMENT stops here
      // for the reason APPROVE_PAYROLL does: writing off accrued statutory
      // interest is forgiving a debt.
      PERMISSIONS.READ_GRATUITY_CLAIM,
      PERMISSIONS.MANAGE_GRATUITY_CLAIM,
      PERMISSIONS.MANAGE_GRATUITY_NOMINATION,
      PERMISSIONS.FORFEIT_GRATUITY,
      PERMISSIONS.RECORD_GRATUITY_PAYMENT,

      // Held by the owner alone: a role edit changes what every other account
      // in the company can do.
      PERMISSIONS.MANAGE_ROLES,
      // #1876. All three. Backdating a slab table rewrites a payslip already
      // issued, and the owner is the one account allowed to do that and to
      // certify the result.
      PERMISSIONS.READ_PROFESSIONAL_TAX,
      PERMISSIONS.MANAGE_PROFESSIONAL_TAX,
      PERMISSIONS.MANAGE_PT_RULE,

      PERMISSIONS.IMPERSONATE_USER,

      // #1011. The owner holds everything, including the three that stop at
      // the owner on purpose — RUN_DEPRECIATION, MANAGE_VENDOR and
      // MANAGE_CONTRACT all move money or commit the company.
      PERMISSIONS.READ_ASSET,
      PERMISSIONS.MANAGE_ASSET,
      PERMISSIONS.RUN_DEPRECIATION,

      // #1827. All three. The cost of construction is the entire base of the
      // levy and there is no payroll figure to check it against, so the owner
      // is the one account allowed to be both halves of that check.
      PERMISSIONS.READ_CONSTRUCTION_CESS,
      PERMISSIONS.MANAGE_CESS_REGISTER,
      PERMISSIONS.MANAGE_CESS_BASE,
      // #1971. All three. Determining that a member is outside the wage ceiling
      // and computing the contribution that follows are two halves of the same
      // check, and the owner is the one account allowed to be both.
      PERMISSIONS.READ_INTERNATIONAL_WORKER,
      PERMISSIONS.MANAGE_IW_CONTRIBUTION,
      PERMISSIONS.MANAGE_IW_DETERMINATION,

      // #1344. All three. MANAGE_GRATUITY_ASSUMPTIONS stops here for the same
      // reason MANAGE_COMPLIANCE does — it decides what gets reported, not who
      // gets paid.
      PERMISSIONS.READ_GRATUITY_VALUATION,
      PERMISSIONS.RUN_GRATUITY_VALUATION,
      PERMISSIONS.MANAGE_GRATUITY_ASSUMPTIONS,

      // #1769. All three, for the reason immediately above and one more: the
      // backfill decides how an ambiguous month is read, and reading it wrong
      // understates or overstates a pension for the rest of somebody's life.
      PERMISSIONS.READ_EPS_PENSION,
      PERMISSIONS.MANAGE_EPS_ASSUMPTIONS,
      PERMISSIONS.COMMIT_EPS_VALUATION,

      // #1699. Both. Admitting a claim commits the company and depositing one
      // with the Commissioner discharges a statutory liability, which is the
      // same class of authority as APPROVE_PAYROLL.
      // #1830. All three. Whether a Chapter VB act was lawful decides which of
      // two liabilities applies, and certifying the establishment against the
      // answer is the other half of the same check — the owner is the one
      // account allowed to be both.
      PERMISSIONS.READ_LAYOFF,
      PERMISSIONS.MANAGE_LAYOFF_SPELL,
      PERMISSIONS.MANAGE_CHAPTER_VB_ACTION,

      PERMISSIONS.READ_EC_CLAIM,
      // #1877. All three. Writing an age and closing the finding that age
      // produced are the two halves of the same check, and the owner is the one
      // account allowed to be on both sides of it.
      PERMISSIONS.READ_YOUNG_PERSON,
      PERMISSIONS.MANAGE_YOUNG_PERSON_REGISTER,
      PERMISSIONS.MANAGE_AGE_RECORD,

      PERMISSIONS.MANAGE_EC_CLAIM,
      PERMISSIONS.READ_VENDOR,
      PERMISSIONS.MANAGE_VENDOR,

      // #1700. Both. Filing the Form XXV return is a statement to the labour
      // department about the establishment, and the section 21 exposure is a
      // contingent liability an auditor asks about.
      PERMISSIONS.READ_CONTRACT_LABOUR,
      PERMISSIONS.MANAGE_CONTRACT_LABOUR,

      // #1771. All three. The recorded strength is the denominator of the whole
      // obligation, and the owner is the one account allowed to be both halves
      // of that check.
      PERMISSIONS.READ_APPRENTICESHIP,
      PERMISSIONS.MANAGE_APPRENTICE,
      PERMISSIONS.MANAGE_APPRENTICESHIP_RULES,

      // #1826. All three. The comparable local rate is the denominator of the
      // parity comparison, and the owner is the one account allowed to be both
      // halves of that check — there is nobody above it to be the other half.
      PERMISSIONS.READ_MIGRANT_WORKMEN,
      PERMISSIONS.MANAGE_MIGRANT_WORKMAN,
      PERMISSIONS.MANAGE_MIGRANT_WAGE_BASIS,

      PERMISSIONS.READ_ROSTER,
      PERMISSIONS.MANAGE_ROSTER,

      // #1702. All three. Setting the limits and certifying against them are
      // the two halves of one check, and the owner is the one account allowed
      // to be both — there is nobody above it to be the other half.
      PERMISSIONS.READ_WORKING_HOURS,
      PERMISSIONS.MANAGE_WORKING_HOURS_LIMITS,
      PERMISSIONS.RUN_WORKING_HOURS_ASSESSMENT,

      // #1347. Both stop here. The gap analysis reads declared gender, which is
      // the only sensitive personal data in the product, and a committed report
      // is a published figure — neither is HR admin.
      PERMISSIONS.READ_PAY_EQUITY,
      // #1878. All three. Recording prior service and committing the claim it
      // qualifies for are the two halves of the same check, and the owner is
      // the one account allowed to be on both sides of it.
      PERMISSIONS.READ_EDLI,
      PERMISSIONS.MANAGE_EPF_NOMINATION,
      PERMISSIONS.MANAGE_EDLI_CLAIM,

      PERMISSIONS.MANAGE_PAY_EQUITY,
      PERMISSIONS.READ_CONTRACT,
      PERMISSIONS.MANAGE_CONTRACT,
      PERMISSIONS.READ_APPRAISAL,
      PERMISSIONS.MANAGE_APPRAISAL,
      PERMISSIONS.READ_OWN_APPRAISAL,
      PERMISSIONS.READ_INVOICE,
      PERMISSIONS.MANAGE_INVOICE,
      PERMISSIONS.SUBMIT_TAX_PROOF,
      PERMISSIONS.VERIFY_TAX_PROOF,

      // #1770. All three. The rates decide what is reported under the
      // employer's TAN, which is where MANAGE_COMPLIANCE already stops.
      PERMISSIONS.READ_PERQUISITE,
      PERMISSIONS.MANAGE_PERQUISITE_GRANT,
      PERMISSIONS.MANAGE_PERQUISITE_RULES,

      // #1701. All three. The owner is the one account allowed to be both
      // halves of a check, because there is nobody above it to be the other.
      PERMISSIONS.READ_LWF,
      PERMISSIONS.MANAGE_LWF_RULES,
      PERMISSIONS.MANAGE_LWF_CONTRIBUTION,

      // #1345.
      PERMISSIONS.SUBMIT_LTA_CLAIM,
      // #1879. All three. Recording the ground that takes a vacancy out of the
      // Act and filing the return that would have reported it are two halves of
      // the same check, and the owner is the one account allowed to be both.
      PERMISSIONS.READ_VACANCY_NOTIFICATION,
      PERMISSIONS.MANAGE_VACANCY_NOTIFICATION,
      PERMISSIONS.MANAGE_CNV_DETERMINATION,

      PERMISSIONS.VERIFY_LTA_CLAIM,

      PERMISSIONS.READ_PYQ,
      PERMISSIONS.MANAGE_PYQ,

      // #1077.
      PERMISSIONS.READ_TRAVEL,
      PERMISSIONS.SUBMIT_TRAVEL_REQUEST,
      PERMISSIONS.APPROVE_TRAVEL,
      PERMISSIONS.MANAGE_TRAVEL_POLICY,

      // #1348. All three. SETTLE_ASSIGNMENT_TAX stops here for the same reason
      // APPROVE_PAYROLL does.
      PERMISSIONS.READ_ASSIGNMENT,
      PERMISSIONS.MANAGE_ASSIGNMENT,
      PERMISSIONS.SETTLE_ASSIGNMENT_TAX,

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

      // #1075.
      PERMISSIONS.READ_DISBURSEMENT,
      PERMISSIONS.MANAGE_DISBURSEMENT,
      PERMISSIONS.RELEASE_DISBURSEMENT,
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

      // #1828. Read and manage. Ordering a suspension, paying the monthly
      // allowance and recording the enquiry's result is HR administration in
      // the ordinary sense. It does not make the attributability finding, which
      // is a judgement about whose conduct delayed the enquiry and is worth the
      // difference between fifty per cent and seventy-five — HR is frequently
      // the party whose delay is in question, which is exactly why the finding
      // sits with the owner.
      PERMISSIONS.READ_SUSPENSION,
      // #1969. Read and the claims, not the rate tables. Recording an arrear
      // and an employee's Form 10E is clerical against documents; the dated
      // slabs and a past year's assessed income are the figures every relief
      // is computed against, and moving one of those silently moves every
      // relief for every employee.
      PERMISSIONS.READ_ARREAR_RELIEF,
      PERMISSIONS.MANAGE_RELIEF_CLAIM,
      PERMISSIONS.MANAGE_SUSPENSION,

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
      // #1829. Read and the register. Recording a gig worker and the days they
      // worked across platforms is register-keeping of the ordinary kind. It
      // does not state the aggregator's turnover, which is the base of the levy
      // and has no cross-check anywhere in this product, and it does not commit
      // the assessment.
      // #1875. Read and the ledger. Recording what a wage month owed and what
      // was remitted against it is administration and every figure is
      // checkable against a challan. It does not record a paragraph 32B
      // waiver, which can take a period's damages to nil, and it does not move
      // the grace period, which does the same thing by making the default
      // disappear instead.
      PERMISSIONS.READ_EPF_REMITTANCE,
      PERMISSIONS.MANAGE_EPF_REMITTANCE,

      PERMISSIONS.READ_AGGREGATOR_CONTRIBUTION,
      PERMISSIONS.MANAGE_GIG_WORKER_REGISTER,

      PERMISSIONS.READ_COMPLIANCE,

      // #1768. HR reads the coverage register — the 78-day count is what an
      // employee asks HR about when a claim is refused, and the answer is a
      // fact about their attendance. It does not move the ceiling and it does
      // not file the return, which is a remittance.
      PERMISSIONS.READ_ESI,

      // #1346. HR reads the bonus register — "what is this employee getting and
      // why" is HR's question and Form C answers it. It does not commit the
      // computation: that reads the company's gross profit and binds the next
      // four years through the set-on/set-off ledger, so it stays with the
      // owner alongside MANAGE_COMPLIANCE, which HR also does not hold.
      PERMISSIONS.READ_STATUTORY_BONUS,

      // #1698. HR reads the shortfall register and transcribes the gazetted
      // rate — "is this offer above the notified minimum for that state" is an
      // HR question and both halves of it are HR work. It does not commit the
      // assessment, for the reason the three names were split in the first
      // place: whoever maintains the rate should not also be the one certifying
      // the establishment against it.
      PERMISSIONS.READ_MINIMUM_WAGE,
      PERMISSIONS.MANAGE_MINIMUM_WAGE_SCHEDULE,

      // #1767. HR reads the register — a deduction total over the ceiling is
      // fixed by rescheduling a loan recovery, and the loans are HR's. It does
      // not set the applicability ceiling, which decides who the Act reaches at
      // all, and it does not commit the register or write off a balance.
      PERMISSIONS.READ_WAGE_DEDUCTIONS,

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

      // #1344. HR reads the valuation — "what is this leaver's gratuity going
      // to cost us" is an HR question and the per-employee schedule answers it.
      // It does not run one and it does not set the assumptions: both decide
      // what the company reports, which is the owner's call and the auditor's.
      // #1876. Read and the administration. Recording where somebody works and
      // what was remitted is ordinary HR work. It does not write a slab table
      // with an effective date, which can rewrite a payslip already issued, and
      // it does not commit the year that fixes the section 16(iii) deduction.
      PERMISSIONS.READ_PROFESSIONAL_TAX,
      PERMISSIONS.MANAGE_PROFESSIONAL_TAX,

      PERMISSIONS.READ_GRATUITY_VALUATION,
      // #1970. Read and the calendar, not the substitutions. Declaring the
      // festival list and settling it with the Inspector is clerical work
      // measured against the state's own figure; moving a day an employee has
      // already been told they are getting off is not, and the same permission
      // holding both would let one person do it end to end.
      PERMISSIONS.READ_HOLIDAY_CALENDAR,
      PERMISSIONS.MANAGE_HOLIDAY_CALENDAR,

      // #1769. HR reads the pension statements — "why is my pensionable salary
      // ₹14,500 when I earned ₹40,000" is a question an employee asks HR, and
      // the sixty-month window is the answer. It does not move the ceiling and
      // it does not commit a valuation.
      PERMISSIONS.READ_EPS_PENSION,

      // #1699. HR reads the injury register — it reports the accident, it
      // handles the employee, and "what is this going to cost" is a question it
      // is asked. It does not admit the claim: that commits the company to a
      // payment and starts a section 4A clock, which is the owner's call for
      // the same reason APPROVE_PAYROLL is.
      // #1830. Read and the spell. Recording a lay-off, the section 25B days
      // behind it and the section 25H register is HR administration in the
      // ordinary sense. It does not record where the Chapter VB permission
      // stands, which decides whether the act was lawful at all, and it does
      // not move the threshold or propose the section 25G selection.
      PERMISSIONS.READ_LAYOFF,
      PERMISSIONS.MANAGE_LAYOFF_SPELL,

      PERMISSIONS.READ_EC_CLAIM,
      // #1971. Read and the contribution, not the determination. Computing a
      // month's basis follows mechanically from the status and the pay; the
      // status itself takes the ₹15,000 ceiling off a member, and a certificate
      // stops their contribution altogether. One person should not be able to
      // decide that and then compute against it.
      PERMISSIONS.READ_INTERNATIONAL_WORKER,
      PERMISSIONS.MANAGE_IW_CONTRIBUTION,

      PERMISSIONS.READ_VENDOR,

      // #1827. Read and the register. Recording a contractor bill with the cess
      // withheld, and keeping the building workers' days per employer for the
      // section 12 roll, is register-keeping of the same kind as the contract
      // labour deployments below. It does not move the cost of construction,
      // which is the entire base of the levy, and it does not commit the
      // assessment.
      PERMISSIONS.READ_CONSTRUCTION_CESS,
      PERMISSIONS.MANAGE_CESS_REGISTER,

      // #1700. Both. Registering a contractor and recording who is on site each
      // month is HR administration in the ordinary sense — somebody has to walk
      // the site and count — and the return it feeds is a headcount statement
      // rather than a payment. Unlike the other new areas, the write half here
      // moves no money.
      PERMISSIONS.READ_CONTRACT_LABOUR,
      PERMISSIONS.MANAGE_CONTRACT_LABOUR,

      // #1771. HR engages apprentices and keeps the roll — recruiting them and
      // recording their attendance is HR administration in the ordinary sense.
      // It does not move the band or the recorded strength, both of which are
      // the denominator the establishment is judged against, and it does not
      // commit the assessment.
      // #1877. Read and the register. Recording who is engaged, in what work
      // and for which hours is ordinary establishment administration. It does
      // not write the date of birth, which decides whether the total bar under
      // section 3 applies at all, and it does not close a finding.
      PERMISSIONS.READ_YOUNG_PERSON,
      PERMISSIONS.MANAGE_YOUNG_PERSON_REGISTER,

      PERMISSIONS.READ_APPRENTICESHIP,
      PERMISSIONS.MANAGE_APPRENTICE,

      // #1826. HR keeps the migrant register — recording a recruitment, the
      // allowances that were paid and the return-journey accrual is HR
      // administration in the ordinary sense. It does not set the comparable
      // local rate, which is what the establishment is judged against, and it
      // does not commit the assessment.
      PERMISSIONS.READ_MIGRANT_WORKMEN,
      PERMISSIONS.MANAGE_MIGRANT_WORKMAN,

      // #2031. Read, the claim and the nomination — not the forfeiture and not
      // the payment. Opening the claim and collecting the Form F is
      // record-keeping HR does, and the claim has to be opened on the last
      // working day rather than when somebody senior gets to it, because that
      // is when the thirty days start. Forfeiting takes money away, and
      // recording the 7(3A) relief writes off interest that has already
      // accrued.
      PERMISSIONS.READ_GRATUITY_CLAIM,
      PERMISSIONS.MANAGE_GRATUITY_CLAIM,
      PERMISSIONS.MANAGE_GRATUITY_NOMINATION,

      PERMISSIONS.READ_ROSTER,
      PERMISSIONS.MANAGE_ROSTER,

      // #1702. HR reads the findings — a spread-over breach is a rostering
      // problem and rostering is HR's, which is why this sits directly under
      // MANAGE_ROSTER. It does not set the limits, which decide what counts as
      // a breach in the first place, and it does not commit the assessment.
      PERMISSIONS.READ_WORKING_HOURS,

      PERMISSIONS.READ_CONTRACT,
      PERMISSIONS.READ_APPRAISAL,
      PERMISSIONS.MANAGE_APPRAISAL,
      // #1878. Read and the nomination. Recording who a member has nominated is
      // ordinary HR administration and the member states it themselves. It does
      // not record prior service at another establishment, which decides whether
      // the ₹2,50,000 floor applies, and it does not commit the claim.
      PERMISSIONS.READ_EDLI,
      PERMISSIONS.MANAGE_EPF_NOMINATION,

      PERMISSIONS.READ_OWN_APPRAISAL,
      PERMISSIONS.READ_INVOICE,
      PERMISSIONS.SUBMIT_TAX_PROOF,
      PERMISSIONS.VERIFY_TAX_PROOF,

      // #1770. HR records what somebody was given and reads the valuation —
      // allocating a flat or a car is HR's, and so is answering "why did my
      // taxable income go up by more than the allowance". It does not set the
      // rates or commit the year's position: both decide what is filed under
      // the employer's TAN, which HR does not hold for the same reason it does
      // not hold MANAGE_COMPLIANCE.
      PERMISSIONS.READ_PERQUISITE,
      PERMISSIONS.MANAGE_PERQUISITE_GRANT,

      // #1701. HR reads the register and maintains the state rules — knowing
      // that Karnataka collects in December and Kerala every month is HR's
      // business, and somebody has to transcribe the notification. It does not
      // commit the contribution, which is a remittance to a welfare board.
      PERMISSIONS.READ_LWF,
      PERMISSIONS.MANAGE_LWF_RULES,

      // #1345. HR verifies LTA journeys for the same reason it verifies
      // investment proofs: approving one changes the TDS deducted from that
      // employee's salary for the rest of the year.
      PERMISSIONS.SUBMIT_LTA_CLAIM,
      PERMISSIONS.VERIFY_LTA_CLAIM,

      // #1879. Read and the notifications. Telling the exchange about a vacancy
      // and filing the quarterly return is clerical work checkable against an
      // acknowledgement. It does not record the section 3 ground that takes a
      // vacancy out of the Act, and it does not set the headcount the threshold
      // is tested against.
      PERMISSIONS.READ_VACANCY_NOTIFICATION,
      PERMISSIONS.MANAGE_VACANCY_NOTIFICATION,

      PERMISSIONS.READ_PYQ,

      // #1073. HR can see the cap table — it answers "what is this person's
      // total compensation", which is HR's question — and cannot issue against
      // it.
      PERMISSIONS.READ_ESOP,
      PERMISSIONS.READ_OWN_ESOP,

      // #1077. HR approves trips, releases advances and settles them — the same
      // shape as APPROVE_EXPENSE, which it also holds. Not
      // MANAGE_TRAVEL_POLICY: the rate table decides what everybody is entitled
      // to, and that stays with the owner for the same reason
      // MANAGE_EXPENSE_CATEGORY does.
      PERMISSIONS.READ_TRAVEL,
      PERMISSIONS.SUBMIT_TRAVEL_REQUEST,
      PERMISSIONS.APPROVE_TRAVEL,

      // #1348. HR runs the assignment — opening it, logging where the employee
      // has been, costing the package — because that is mobility administration
      // and it is HR's job. It does not settle the year: that moves money
      // between the employee and the company, and it is the same maker-checker
      // split that keeps APPROVE_PAYROLL away from the person who submits the
      // run.
      PERMISSIONS.READ_ASSIGNMENT,
      PERMISSIONS.MANAGE_ASSIGNMENT,

      // #1074. HR runs the pipeline and sits on panels. It does not open
      // requisitions or move the CTC band — that is headcount budget, and
      // widening a band is equivalent to approving any offer against it.
      PERMISSIONS.READ_REQUISITION,
      PERMISSIONS.MANAGE_CANDIDATE,
      PERMISSIONS.SUBMIT_INTERVIEW_FEEDBACK,

      // #1075. HR assembles the payment file; it does not release it. Same
      // maker-checker split as APPROVE_PAYROLL, which HR also does not hold.
      PERMISSIONS.READ_DISBURSEMENT,
      PERMISSIONS.MANAGE_DISBURSEMENT,
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

      // #1345. Filing their own journeys and seeing their own entitlement.
      // `submitClaim` files against the caller's own employee record when no
      // id is sent, and `getEntitlement` and `getMyClaims` both resolve from
      // `req.userId` — so this does not let one employee claim in another's
      // name or read a colleague's block position. Deliberately not
      // VERIFY_LTA_CLAIM, which reads any employee's four-year history.
      PERMISSIONS.SUBMIT_LTA_CLAIM,

      PERMISSIONS.READ_OWN_APPRAISAL,
      // Employees see the roster they are on.
      PERMISSIONS.READ_ROSTER,
      PERMISSIONS.READ_PYQ,

      // #1077. Filing a trip and seeing your own. `createRequest` falls back to
      // the caller's own employee record when no id is sent, and `getMyTrips`
      // resolves from `req.userId`, so holding this does not let one employee
      // file against a colleague.
      PERMISSIONS.SUBMIT_TRAVEL_REQUEST,

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
