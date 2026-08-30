/**
 * @fileoverview Audit Log Schema and Actions Enumeration
 * @description Defines the schema, compound indexes, and event taxonomy for system audits.
 * Issue: #1845
 */
const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');

/**
 * Every action a controller emits an `AUDIT_LOG` event for.
 *
 * Exported, and asserted against the emit sites by
 * `listeners/__tests__/auditActions.coverage.test.js`. Eight of these were
 * missing when #664 was filed — `EMPLOYEE_STATUS_TOGGLE`, `EMPLOYEE_RESTORE`,
 * the three `SALARY_HISTORY_*` and the three `WORKFLOW_*` — because the
 * features that emit them were added without touching this enum. Since
 * `createAuditLog` swallows its own errors, those writes would have failed
 * validation and been dropped with a log line nobody reads, which is a subtler
 * version of the same bug the listener had.
 */
const AUDIT_ACTIONS = [
  'PAYROLL_FINALIZE',
  // Section 89(1) relief on salary arrears (#1969). The rate table is audited
  // because it is the widest change in the module: moving the 2022-23 slabs
  // moves every relief ever computed against a relation year in that year, for
  // every employee, with no claim record changing and nothing on any screen
  // saying why the figure is different.
  //
  // The Form 10E furnishing is audited for the neighbouring reason. Its *date*
  // is what decides whether the relief stands — furnished after the return was
  // filed the relief is disallowed — and giving the relief in the TDS
  // computation without it is a short deduction the employer carries.
  'RELIEF_RATE_TABLE_RECORDED',
  'RELIEF_ASSESSED_YEAR_RECORDED',
  'RELIEF_CLAIM_RECORDED',
  'RELIEF_FORM_10E_FURNISHED',
  'RELIEF_APPLIED_TO_TDS',
  // #438 shipped approve/reject handlers that emitted no audit event at
  // all, so the one action a maker–checker flow exists to record was the
  // one action left untracked (#458).
  'PAYROLL_APPROVE',
  'PAYROLL_REJECT',
  // Section 10A of the Standing Orders Act, 1946 (#1828). Next to the payroll
  // actions because a suspension is the one state in which somebody is paid
  // without working and without being on leave.
  //
  // The attributability finding is audited because it is not a rate change: it
  // is a judgement about whose conduct delayed an enquiry, it decides fifty per
  // cent against seventy-five from day ninety-one, and the party whose delay is
  // in question is frequently the one recording it. The outcome is audited
  // because it converts what has already been drawn — a set-off against back
  // wages on reinstatement, an unrecoverable payment on dismissal — so the same
  // ledger rows change meaning at that moment.
  'SUBSISTENCE_RULES_UPDATED',
  'SUSPENSION_ORDERED',
  'SUSPENSION_ATTRIBUTABILITY_RECORDED',
  'SUSPENSION_CONCLUDED',
  'SUBSISTENCE_ASSESSMENT_COMMITTED',
  // Statutory bonus under the Payment of Bonus Act (#1346). Committing a year
  // declares what the establishment owes under a statute and writes a
  // set-on/set-off balance that binds the next four years; the Form C export is
  // every eligible employee's wage and bonus in one file; and the payment date
  // is what the section 19 eight-month window is measured against. All three
  // are inspection questions.
  'STATUTORY_BONUS_COMMITTED',
  'STATUTORY_BONUS_FORM_C_EXPORTED',
  'STATUTORY_BONUS_PAID',
  // Code on Social Security, 2020, section 114 (#1829). Next to the bonus
  // actions because both start from a figure the payroll cannot produce — an
  // allocable surplus there, an aggregator's turnover here — with the
  // difference that a turnover figure has no cross-check anywhere in this
  // product at all.
  //
  // Finalising is audited separately from recording, because everything
  // computed before it is provisional and everything after it is the assessed
  // contribution. And the worker registration is audited because it is the
  // worker's own entitlement, assembled from engagements across platforms this
  // tenant does not operate and does not otherwise see.
  'AGGREGATOR_RULES_UPDATED',
  'AGGREGATOR_TURNOVER_RECORDED',
  'AGGREGATOR_TURNOVER_FINALISED',
  'GIG_WORKER_REGISTERED',
  'AGGREGATOR_ASSESSMENT_COMMITTED',
  // Minimum Wages Act, 1948 (#1698). A notification is the rate every
  // assessment in that state is measured against, so adding one silently
  // changes findings that have already been made; a committed assessment is
  // the establishment's own statement of what it owes; and the register is
  // every employee's wage against the notified rate in one file. All three are
  // questions an inspection asks by name.
  'MINIMUM_WAGE_NOTIFICATION_ADDED',
  'MINIMUM_WAGE_ASSESSMENT_COMMITTED',
  'MINIMUM_WAGE_REGISTER_EXPORTED',
  // BOCW Welfare Cess Act, 1996 (#1827). Next to the minimum wage actions
  // because both are levers on a base an assessment is measured against, and
  // unlike those the base here is not a wage — it is the cost of construction,
  // so there is no payroll figure anywhere to check a revision against.
  //
  // The cost revision is audited for that reason: moving the section 3 land
  // exclusion by a crore moves the cess by a lakh and nothing else in the
  // product would object. The assessment order is audited because recording it
  // starts the rule 5 payment window and therefore the section 8 interest
  // clock, so a back-dated order makes accrued interest disappear. And the
  // beneficiary registration is audited because it is the worker's entitlement
  // to the Board's benefits, which outlives their employment here.
  'CESS_RULES_UPDATED',
  'CESS_PROJECT_REGISTERED',
  'CESS_PROJECT_COST_REVISED',
  'CESS_ASSESSMENT_ORDER_RECORDED',
  'CESS_BENEFICIARY_REGISTERED',
  'CESS_ASSESSMENT_COMMITTED',
  // Payment of Wages Act, 1936 (#1767). Next to the minimum wage actions
  // because the rules move findings the same way a notification does: raising
  // the section 1(6) applicability ceiling takes employees out of the Act and
  // every finding against them disappears. A committed register is the
  // establishment's own statement of what it deducted, and writing off a
  // deferred balance is the employer forgiving a debt it created by deferring.
  'WAGE_DEDUCTION_RULES_UPDATED',
  'WAGE_DEDUCTION_REGISTER_COMMITTED',
  'WAGE_DEDUCTION_DEFERRAL_WRITTEN_OFF',
  'EMPLOYEE_CREATE',
  'EMPLOYEE_UPDATE',
  'EMPLOYEE_DELETE',
  'EMPLOYEE_IMPORT',
  'RETENTION_EMPLOYEE_ANONYMIZED',
  'RETENTION_ATTENDANCE_PURGED',
  'RETENTION_PAYROLL_RETAINED',
  'RETENTION_AUDIT_RETAINED',
  'RETENTION_POLICY_UPDATED', // Deactivating someone stops their payroll, and restoring a soft-deleted
  // record brings their history back. Both are emitted by
  // employee.controller.js and neither was accepted here (#664).
  'EMPLOYEE_STATUS_TOGGLE',
  'EMPLOYEE_RESTORE',
  // Attendance drives leaveDays and overtimeHours into the salary
  // calculation, so editing it is a financial mutation and is audited
  // like one (#459).
  'ATTENDANCE_UPDATE',
  'ATTENDANCE_BULK_UPDATE',
  // Working hours compliance (#1702). Next to the attendance actions because it
  // is that ledger these are computed from. Raising a limit makes existing
  // findings disappear without anything else recording that it happened, and a
  // committed assessment is the establishment's own statement of what its shift
  // patterns were doing.
  'WORKING_HOURS_LIMITS_UPDATED',
  // Sections 7Q and 14B, EPF & MP Act, 1952 (#1875). The waiver is audited
  // because a paragraph 32B order takes a period's damages to nil and the
  // resulting figure is indistinguishable from a liability that never arose —
  // the audit line is the only place the difference survives.
  //
  // The rules are audited for the neighbouring reason. `graceDays` was five
  // until 2016 and is zero now; restoring it turns a five-day default into a
  // compliant remittance on paper with nothing moving on the ground.
  //
  // And the remittance is audited because it is the discharge: the date on that
  // row decides which paragraph 32A slab the arrear falls in, and the slabs run
  // from five per cent to twenty-five.
  'EPF_REMITTANCE_RULES_UPDATED',
  'EPF_REMITTANCE_MONTH_RECORDED',
  'EPF_REMITTANCE_RECORDED',
  'EPF_DAMAGES_WAIVER_RECORDED',
  'EPF_REMITTANCE_ASSESSMENT_COMMITTED',

  'WORKING_HOURS_ASSESSMENT_COMMITTED',
  // Offboarding is a financial event: it produces a final payout and
  // removes someone from the headcount (#462).
  'EMPLOYEE_EXIT_INITIATED',
  'SETTLEMENT_CREATE',
  'SETTLEMENT_STATUS_CHANGE',
  // Employees' Compensation Act, 1923 (#1699). Next to the settlement actions
  // because both record what is owed when an employment event happens.
  // Computing a claim fixes the figure a dependant is offered; depositing it
  // with the Commissioner is the section 8 discharge, without which a death
  // claim is not settled however much was paid; and every other transition
  // decides whether interest is still running.
  'INJURY_CLAIM_COMPUTED',
  'INJURY_CLAIM_DEPOSITED',
  'INJURY_CLAIM_STATUS_CHANGED',
  // Employees' State Insurance Act, 1948 (#1768). Placed next to the injury
  // claim actions because section 53 bars a claim under the Employees'
  // Compensation Act where ESI covers the same injury — so which of these two
  // sets applies to an employee is decided by the coverage the first of these
  // actions moves. Lowering the wage ceiling removes people from the scheme
  // while they are still drawing benefit three months later, and filing the
  // return is both a remittance and the thing that fixes each employee's
  // coverage for the following month.
  'ESI_RULES_UPDATED',
  'ESI_RETURN_FILED',
  // Gratuity actuarial valuation (#1344). The assumptions decide the reported
  // provision — moving the discount rate 50 basis points moves the balance
  // sheet — and committing a valuation produces the figure carried in the
  // accounts and every subsequent opening balance. Both are exactly what an
  // auditor asks "who changed this, and when" about.
  'GRATUITY_ASSUMPTIONS_UPDATED',
  'GRATUITY_VALUATION_COMMITTED',
  // Employees' Pension Scheme, 1995 (#1769). Directly under the gratuity
  // actions because the two are the same kind of obligation valued the same
  // way. The assumptions decide the answer — moving the wage ceiling changes
  // the pensionable salary of every member above the old one, for life, since a
  // pension once fixed is not revisited. The backfill is audited although it
  // produces no valuation: it writes the wage history every future valuation
  // rests on, and how it resolved a month with no payroll row is the fact
  // somebody will need years later.
  'EPS_ASSUMPTIONS_UPDATED',
  'EPS_WAGE_HISTORY_BACKFILLED',
  'EPS_VALUATION_COMMITTED',
  // Industrial Employment (Standing Orders) Act, 1946 (#2029). The
  // applicability determination is audited with the crossing date on it, not
  // with today's, because the whole finding is that the section 3(1) six months
  // may already have been running for a quarter before anybody looked.
  //
  // The headcount sync is audited with `stillApplicable` beside the strength,
  // because a strength recorded below the threshold on an applicable
  // establishment is the row somebody will later read as 'the Act stopped
  // applying' — the proviso to section 1(3) says it did not, and the record has
  // to show it.
  //
  // The certification carries both the certificate date and the dispatch date.
  // Section 7 runs from the second; using the first brings the orders into
  // force weeks early, and the pair is what lets a reviewer see which was used.
  //
  // The modification carries the agreement's party and reference rather than a
  // flag, because section 10(1) excepts a modification *agreed* — and an
  // agreement with nothing to point at is the claim, not the document.
  'STANDING_ORDERS_ESTABLISHMENT_RECORDED',
  'STANDING_ORDERS_APPLICABILITY_DETERMINED',
  'STANDING_ORDERS_HEADCOUNT_SYNCED',
  'STANDING_ORDERS_CERTIFIED',
  'STANDING_ORDERS_MODIFICATION_PROPOSED',
  // National and Festival Holidays Acts (#1970). The substitution is audited
  // with the holiday's kind on it, because a NATIONAL kind on one of these rows
  // means the engine's refusal was bypassed — 26 January, 15 August and 2
  // October cannot be substituted by any agreement, and that is the record an
  // inspection asks about.
  //
  // A holiday worked is audited with both the payable and what was paid,
  // because the gap between them is the finding: the entitlement is a whole day
  // at the statutory rate however few hours were worked, and the natural wrong
  // answer — scaling it by hours through the overtime engine — produces a
  // smaller number that looks arithmetically reasonable.
  'HOLIDAY_CALENDAR_OPENED',
  'HOLIDAY_LIST_SETTLED',
  'FESTIVAL_HOLIDAY_DECLARED',
  'HOLIDAY_SUBSTITUTED',
  'HOLIDAY_WORKED_RECORDED',
  // A salary advance commits future deductions from someone's pay, so
  // issuing, pausing and collecting against one are all financial events
  // and are audited as such (#460).
  'LOAN_ISSUE',
  'LOAN_STATUS_CHANGE',
  // Article 276 and the state professional tax enactments (#1876). The rule is
  // audited because it carries an effective date: backdating one rewrites the
  // deduction on payslips already issued, and the employee's copy and ours then
  // disagree with nothing having failed.
  //
  // The payment is audited because section 16(iii) allows professional tax
  // *actually paid*, so the date on that row decides which year an employee may
  // deduct it in — and the period it discharges can be in the other one.
  'PROFESSIONAL_TAX_RULE_RECORDED',
  'PROFESSIONAL_TAX_PROFILE_RECORDED',
  'PROFESSIONAL_TAX_REGISTRATION_RECORDED',
  'PROFESSIONAL_TAX_PAYMENT_RECORDED',
  'PROFESSIONAL_TAX_ASSESSMENT_COMMITTED',

  'LOAN_REPAYMENT',
  // Labour Welfare Fund (#1701). A state rule decides what every employee in
  // that state owes for years, so adding one changes contributions not yet
  // made; a committed contribution is a liability to a welfare board; the
  // challan is its discharge; and the register is every employee's wages and
  // amount in one file.
  'LWF_RULE_ADDED',
  'LWF_CONTRIBUTION_COMMITTED',
  'LWF_REMITTANCE_RECORDED',
  'LWF_REGISTER_EXPORTED',
  // EMPLOYEE_UPDATE records only the *names* of the fields that changed,
  // so a salary change left no trace of what it changed from. This one
  // carries the before/after (#461).
  'SALARY_REVISION',
  // The salary history endpoints emit their own three (#664).
  'SALARY_HISTORY_CREATE',
  'SALARY_HISTORY_EXPORT',
  'SALARY_HISTORY_DELETE',
  // LTA claims (#1345). Approving a journey decides how much of somebody's
  // allowance escapes tax, and therefore the TDS deducted from their salary for
  // the rest of the year — the same class of financial mutation as the salary
  // history entries above.
  'LTA_CLAIM_SUBMITTED',
  'LTA_CLAIM_APPROVED',
  'LTA_CLAIM_REJECTED',
  // Perquisite valuation under Rule 3 (#1770). Next to the LTA actions because
  // both decide how much of a package is taxable. The State Bank of India rate
  // is the one worth auditing hardest: it is frozen for the year and applied to
  // every concessional loan in the establishment, so a figure recorded a point
  // low understates the perquisite for every borrower and nothing in a payslip
  // would show it. Recording a grant is audited because it is a benefit given
  // to a named person, and committing the statement fixes what reaches Form 16.
  'PERQUISITE_RULES_UPDATED',
  'PERQUISITE_GRANT_RECORDED',
  'PERQUISITE_GRANT_REMOVED',
  'PERQUISITE_STATEMENT_COMMITTED',
  // The approval workflow engine (#590, mounted in #614) emits three (#664).
  // A change to the graph that decides who may approve a payroll run is
  // exactly the kind of thing an auditor asks about.
  // Child and Adolescent Labour Act, 1986 (#1877). The age is audited because
  // that one date decides whether section 3's total bar applies at all —
  // moving it by a year moves somebody across the fourteen or the eighteen
  // boundary, and nothing else in the record would change.
  //
  // The register entry is audited because of one field on it: a claimed section
  // 3 exception turns a prohibited engagement into a permitted one on paper,
  // and the claim is about a relationship and about schooling rather than about
  // a job title.
  //
  // None of these lines carries an amount. An underage engagement has no
  // compensable figure, and section 14's fine is a criminal penalty on
  // conviction rather than a liability that accrues.
  'YOUNG_PERSON_AGE_RECORDED',
  'YOUNG_PERSON_REGISTER_RECORDED',
  'YOUNG_PERSON_DAYS_RECORDED',
  'YOUNG_PERSON_FINDING_RESOLVED',
  'YOUNG_PERSON_ASSESSMENT_COMMITTED',
  'COMPLIANCE_VIOLATION',

  'WORKFLOW_CREATE',
  'WORKFLOW_INSTANCE_START',
  'WORKFLOW_TRANSITION',
  'PAYSLIP_EMAIL',
  'PAYSLIP_BULK_EMAIL',
  'REPORT_DOWNLOAD',
  'ACCOUNT_DELETE',
  'SETTINGS_UPDATE',
  'PASSWORD_UPDATE',
  // #474 — a webhook endpoint is the company's instruction to POST payroll and
  // employee data to an external URL, and the secret signs every one of those
  // requests. Creating one, changing what it receives, rotating its secret or
  // deleting it all alter what leaves the org, so they are audited like the
  // other security mutations above.
  'WEBHOOK_CREATE',
  'WEBHOOK_UPDATE',
  'WEBHOOK_DELETE',
  'WEBHOOK_SECRET_REGENERATED',
  // Contract Labour (Regulation and Abolition) Act, 1970 (#1700). A licence
  // decides whether a deployment is lawful, so editing one changes findings
  // already made; the Form XXV return is a statement to the labour department;
  // and Forms XII, XIII and XVII are every contract workman's designation and
  // wage in one file. All four are inspection questions.
  'CONTRACT_LABOUR_CONTRACTOR_REGISTERED',
  'CONTRACT_LABOUR_LICENCE_UPDATED',
  'CONTRACT_LABOUR_RETURN_FILED',
  // EDLI paragraph 22 (#1878). The nomination is audited because it decides
  // who receives the assurance, and a nomination summing to less than a hundred
  // per cent sends the remainder to a different limb of the scheme — a change
  // of payee rather than of amount.
  //
  // Prior service is audited because those months decide whether the ₹2,50,000
  // floor applies at all, and the gap flag decides whether they aggregate. Both
  // are on the line.
  //
  // And the exemption is audited because it decides whether the group policy or
  // paragraph 22 is the measure — where the policy pays less, the difference is
  // the establishment's liability rather than the insurer's.
  'EPF_NOMINATION_RECORDED',
  'EDLI_EXEMPTION_RECORDED',
  'EDLI_PRIOR_SERVICE_RECORDED',
  'EDLI_CLAIM_COMMITTED',

  'CONTRACT_LABOUR_REGISTER_EXPORTED',
  // Industrial Disputes Act, Chapters VA and VB (#1830). The permission record
  // is audited because that one field decides which of two liabilities the
  // establishment is under: half pay for forty-five days if the act was lawful,
  // and full wages for the whole period if it was not.
  //
  // The rules are audited for the neighbouring reason — raising the Chapter VB
  // threshold from one hundred to three hundred turns an illegal act into a
  // compensable one on paper with nothing changing on the ground. And the
  // section 25H offer is audited because it is the discharge of a statutory
  // preference: the workman's claim on the vacancy is answered by the fact that
  // it was offered, whatever they then decided.
  'LAYOFF_RULES_UPDATED',
  'LAYOFF_SPELL_RECORDED',
  'CHAPTER_VB_ACTION_RECORDED',
  'CHAPTER_VB_PERMISSION_RECORDED',
  'REEMPLOYMENT_PREFERENCE_OFFERED',
  'LAYOFF_ASSESSMENT_COMMITTED',
  // Apprentices Act, 1961 (#1771). Next to the contract labour actions because
  // both concern people on the site who are not on the payroll. The recorded
  // strength is audited because it is the denominator of the whole obligation:
  // reducing it by ten lowers the floor and can make a shortfall disappear
  // without a single apprentice being engaged. And the registration is audited
  // because that one date decides whether the establishment owes provident
  // fund, ESI, bonus and gratuity for the period.
  'APPRENTICESHIP_RULES_UPDATED',
  'APPRENTICESHIP_STRENGTH_RECORDED',
  'APPRENTICE_ENGAGED',
  'APPRENTICE_CONTRACT_REGISTERED',
  // EPF International Workers, paragraph 83 (#1971). The determination and the
  // certificate are audited because each moves a remittance by roughly a factor
  // of forty, in opposite directions: the determination removes the ₹15,000
  // ceiling and the certificate stops the contribution altogether. Nothing else
  // in the product moves that much money on the strength of one field.
  //
  // The contribution is audited with the ceiling figure beside the basis
  // actually used, because that pair is what lets a reviewer tell an intended
  // full-pay basis from a bug — and a lapsed certificate turns every month
  // since into an under-remittance carrying section 7Q interest and section 14B
  // damages under #1875.
  'IW_STATUS_DETERMINED',
  'IW_CERTIFICATE_RECORDED',
  'IW_CONTRIBUTION_COMPUTED',
  'IW_ONE_FILED',
  'APPRENTICESHIP_ASSESSMENT_COMMITTED',
  // Inter-State Migrant Workmen Act, 1979 (#1826). The comparator is audited
  // for the same reason the recorded strength above is: it is the denominator
  // of the comparison, and lowering what a local workman is said to earn makes
  // a section 13(1)(b) breach disappear without a rupee changing hands — and
  // unlike a wage floor there is no notification anywhere to check it against.
  //
  // The displacement recovery is audited because it is the one write in the
  // module that takes money back from a workman, against a payment section 14
  // makes non-refundable. And the return-journey accrual is audited because the
  // liability arises at recruitment: the date it was recognised is the fact an
  // inspection asks for when a workman left early and was never sent home.
  'MIGRANT_RULES_UPDATED',
  'MIGRANT_WORKMAN_RECRUITED',
  'MIGRANT_COMPARATOR_RECORDED',
  'MIGRANT_DISPLACEMENT_RECOVERED',
  // Employment Exchanges (CNV) Act, 1959 (#1879). The determination is audited
  // because the section 3 ground on it removes the vacancy from the Act
  // entirely — and a ground of "less than three months' duration" is
  // contradicted later by the engagement's own length, which is the record an
  // inspection asks about.
  //
  // The headcount is audited for the neighbouring reason: twenty-four as at the
  // date a requisition opened takes every requisition that month below the
  // threshold, with nothing else changing.
  'CNV_HEADCOUNT_RECORDED',
  'CNV_DETERMINATION_RECORDED',
  'CNV_OUTCOME_RECORDED',
  'CNV_VACANCY_NOTIFIED',
  'CNV_RETURN_FILED',

  'MIGRANT_RETURN_JOURNEY_ACCRUED',
  'MIGRANT_ASSESSMENT_COMMITTED',
  // International assignments (#1348). Opening one commits the employer to
  // bearing somebody's foreign tax bill for years; a settlement moves money
  // between the employee and the company; and the two threshold events record
  // the moment a treaty day count stopped being comfortable, which is the fact
  // an adviser asks for when a host-country filing obligation turns up.
  //
  // The two threshold actions are emitted through a ternary, so
  // `auditActions.coverage.test.js` cannot see them — its scan only matches a
  // string literal. Registered here anyway: the schema would reject them at
  // runtime and the entry would be dropped exactly as silently.
  'ASSIGNMENT_CREATED',
  'ASSIGNMENT_UPDATED',
  'ASSIGNMENT_COST_APPROVED',
  'ASSIGNMENT_SETTLEMENT_RECORDED',
  'ASSIGNMENT_TREATY_THRESHOLD_APPROACHING',
  'ASSIGNMENT_TREATY_THRESHOLD_EXCEEDED',
  // The monthly-updates endpoints emit their own two. Monthly revisions are
  // financial mutations (they move allowances and deductions into the next
  // payroll run), so they are audited like SALARY_HISTORY_* above.
  'MONTHLY_UPDATE_UPSERT',
  'MONTHLY_UPDATE_DELETE',
  // Pay equity (#1347). A committed report is a published figure in a growing
  // number of jurisdictions, and a salary band decides what everybody at that
  // grade is checked against — widening one is equivalent to approving any
  // offer inside it. Both belong in the trail for the same reason the salary
  // history entries above do.
  'PAY_EQUITY_REPORT_COMMITTED',
  'PAY_BAND_UPDATED',
  'IMPERSONATE_USER_START',
  'IMPERSONATE_USER_STOP',
  'TEAM_INVITE_SENT',
  'TEAM_INVITE_ACCEPTED',
  'TEAM_INVITE_REVOKED',
  'TEAM_MEMBER_DEACTIVATED',
];

/** Every resource type a controller emits. Same story as the actions above. */
const AUDIT_RESOURCE_TYPES = [
  'Payroll',
  'StatutoryBonus',
  'Employee',
  'User',
  'Report',
  'Attendance',
  'WorkingHoursLimits',
  'WorkingHoursAssessment',
  'Settlement',
  'InjuryCompensationClaim',
  'GratuityAssumption',
  'GratuityValuation',
  'Loan',
  'LabourWelfareFundRule',
  'LabourWelfareFundContribution',
  'SalaryHistory',
  'LtaClaim',
  'Workflow',
  'WorkflowInstance',
  'Webhook',
  'ContractLabourContractor',
  'ContractLabourReturn',
  // An HRMS connection (#954) can read and write the employee directory under
  // credentials an admin installs, so configuring, syncing and removing one are
  // audited like the webhook mutations it sits next to.
  'IntegrationConfig',
  'Assignment',
  'EqualizationSettlement',
  'MonthlyUpdate',
  // Where staff are allowed to clock in from (#930, reachable since #953).
  // Editing a fence changes whose attendance is recorded as field duty, so it
  // is audited like the settings change it is.
  'OfficeLocation',
  'MinimumWageNotification',
  'MinimumWageAssessment',
  'PayEquityReport',
  'PayBand',
  'TeamInvite',
];

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    /**
     * The company the action happened in — the field the read endpoints filter
     * on.
     *
     * Added in #664. Before it, `AuditLog` had no tenant at all and
     * `audit.controller.js` filtered on `userId: req.userId`, so the trail was a
     * personal diary: an owner reviewing who approved a payroll run saw only the
     * runs they approved themselves, and every action by the other admins and HR
     * managers in the same company was invisible to them. #458 deliberately split
     * approve from write so two different people are involved in a payroll run —
     * and then neither could see the other's half of it.
     *
     * Required. There is no such thing as an audit entry that belongs to no
     * company, and a nullable tenant on a scoped collection is how you end up
     * with `{ tenantId: undefined }` silently matching everything — see
     * utils/tenantScope.js.
     */
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },

    action: {
      type: String,
      required: true,
      enum: AUDIT_ACTIONS,
    },
    resourceType: {
      type: String,
      enum: AUDIT_RESOURCE_TYPES,
      required: true,
    },
    resourceIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
      },
    ],
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Integrity chain fields
    recordHash: { type: String, default: null, index: true },
    previousHash: { type: String, default: null },
    hashChainValid: { type: Boolean, default: true },
    result: {
      type: String,
      enum: ['success', 'failure', 'partial'],
      default: 'success',
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  { timestamps: true },
);

// The read path is "this company's trail, newest first", optionally narrowed to
// one actor or one action — so the tenant leads every index.
auditLogSchema.index({ tenantId: 1, createdAt: -1 });
auditLogSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
auditLogSchema.index({ tenantId: 1, action: 1, createdAt: -1 });
auditLogSchema.index({ tenantId: 1, createdAt: -1, action: 1 });

auditLogSchema.plugin(softDeletePlugin);
module.exports = mongoose.model('AuditLog', auditLogSchema);
module.exports.AUDIT_ACTIONS = AUDIT_ACTIONS;
module.exports.AUDIT_RESOURCE_TYPES = AUDIT_RESOURCE_TYPES;
