/**
 * Payment of Wages Act, 1936 (#1767).
 *
 * Every deduction engine in the tree adds a row to `payroll.deductions` and
 * each of them is individually lawful. `loanSchedule.js` puts an EMI there,
 * `garnishmentEngine.utils.js` an attachment, `taxCalculator.js` the TDS, and
 * the statutory provident fund and professional tax arrive from
 * `taxEngine.utils.js`. Nothing asks what they come to together.
 *
 * Section 7(3) is not a rule about deductions. It is a rule about their sum:
 * fifty per cent of the wages of the period, or seventy-five where the set
 * includes a payment to a co-operative society. An employee on ₹18,000 with
 * ₹2,160 of provident fund, ₹200 of professional tax, ₹1,400 of tax deducted at
 * source, a ₹4,000 loan instalment and a ₹1,500 attachment is at ₹9,260 and
 * unlawful, and there is no single deduction to reject.
 *
 * That is why this takes the whole set. An engine that sees one deduction
 * cannot answer the question, and an engine that rejects whichever deduction
 * happened to be added last makes lawfulness depend on module load order.
 *
 * The useful output is therefore not a boolean but an abatement: which
 * deduction gives way, by how much, and what balance carries into the next
 * period. Some cannot give way — a provident fund contribution is the
 * employer's own statutory liability and an attachment is a court's order — so
 * the order in which the rest are abated is a question the statute answers and
 * not one the tenant configures.
 *
 * Pure functions, no database access.
 */

const DAYS_PER_WEEK = 7;
const MS_PER_DAY = 86400000;

/**
 * The Act's own figures, as the default rule set.
 *
 * A rule set rather than literals because three of them move by notification.
 * The applicability ceiling in section 1(6) has been revised four times and
 * stood at ₹24,000 a month from the 2017 notification; the fines ceiling and
 * the deduction ceilings have not moved since 1936 but sit here so that a
 * state amendment can be represented without a code change.
 */
const PAYMENT_OF_WAGES_LIMITS = {
  /** Section 7(3) — the ceiling on the sum of all deductions. */
  maxDeductionPercent: 50,
  /**
   * Section 7(3), proviso — the higher ceiling.
   *
   * Not a configuration option. It applies because a co-operative society
   * payment is present in the set, so it is reached by the facts rather than
   * chosen, and `resolveCeiling` derives it.
   */
  maxDeductionPercentWithCoOperative: 75,
  /** Section 8(1) — fines in any one wage period. */
  maxFinePercent: 3,
  /** Section 8(3) — nobody under this age may be fined at all. */
  minFineableAge: 15,
  /** Section 8(6) — a fine may not be recovered after this many days. */
  fineRecoveryWindowDays: 60,
  /** Section 4 — no wage period may be longer than this. */
  maxWagePeriodDays: 31,
  /** Section 5(1) — the deadline where fewer than 1,000 are employed. */
  paymentDayBelowThreshold: 7,
  /** Section 5(1) — and where 1,000 or more are. */
  paymentDayAtOrAboveThreshold: 10,
  /** The headcount that switches between the two. */
  headcountThreshold: 1000,
  /** Section 5(4) — working days, from the termination rather than the period. */
  terminationPaymentWorkingDays: 2,
  /** Section 9(2), proviso — the concerted-absence ceiling, in days. */
  concertedAbsenceMaxDays: 8,
  /** Section 9(2), proviso — and the number of employees that unlocks it. */
  concertedAbsenceMinEmployees: 10,
  /** Section 1(6) — the wage above which the Act does not apply. */
  applicabilityWageCeiling: 24000,
};

/**
 * The section 7(2) list.
 *
 * Closed, and that is the whole point of holding it as an enumeration. A
 * deduction that is not one of these is not a lawful deduction at a lower
 * amount — it is a withholding of wages, and section 23 voids any agreement by
 * which an employee gives up that protection, so consent does not move it into
 * the list.
 */
const DEDUCTION_KIND = {
  /** (a) fines. */
  FINE: 'FINE',
  /** (b) absence from duty. */
  ABSENCE: 'ABSENCE',
  /** (c) damage to or loss of goods entrusted. */
  DAMAGE_OR_LOSS: 'DAMAGE_OR_LOSS',
  /** (d) house accommodation supplied by the employer. */
  HOUSE_ACCOMMODATION: 'HOUSE_ACCOMMODATION',
  /** (e) amenities and services. */
  AMENITIES: 'AMENITIES',
  /** (f) recovery of advances. */
  ADVANCE_RECOVERY: 'ADVANCE_RECOVERY',
  /** (fff) recovery of loans granted for house-building or welfare. */
  LOAN_RECOVERY: 'LOAN_RECOVERY',
  /** (g) income-tax payable. */
  INCOME_TAX: 'INCOME_TAX',
  /** (h) deductions required by order of a court. */
  COURT_ORDER: 'COURT_ORDER',
  /** (i) provident fund contributions. */
  PROVIDENT_FUND: 'PROVIDENT_FUND',
  /** (j) payments to co-operative societies — and the 75% trigger. */
  CO_OPERATIVE_SOCIETY: 'CO_OPERATIVE_SOCIETY',
  /** (k) written authorisation for an insurance premium. */
  INSURANCE_PREMIUM: 'INSURANCE_PREMIUM',
  /** (kkk) membership of a trade union. */
  TRADE_UNION: 'TRADE_UNION',
  /** (l) payment of insurance premia on a Postal Life policy. */
  POSTAL_INSURANCE: 'POSTAL_INSURANCE',
  /** (m) contribution to the Prime Minister's National Relief Fund. */
  RELIEF_FUND: 'RELIEF_FUND',
  /** Anything else. Not a kind of deduction; a withholding of wages. */
  UNAUTHORISED: 'UNAUTHORISED',
};

/**
 * Which sub-clause of section 7(2) each kind is.
 *
 * Carried so a finding can cite the clause rather than the section, because
 * "section 7(2)" is true of every lawful deduction and says nothing.
 */
const DEDUCTION_CLAUSE = {
  [DEDUCTION_KIND.FINE]: 'section 7(2)(a)',
  [DEDUCTION_KIND.ABSENCE]: 'section 7(2)(b)',
  [DEDUCTION_KIND.DAMAGE_OR_LOSS]: 'section 7(2)(c)',
  [DEDUCTION_KIND.HOUSE_ACCOMMODATION]: 'section 7(2)(d)',
  [DEDUCTION_KIND.AMENITIES]: 'section 7(2)(e)',
  [DEDUCTION_KIND.ADVANCE_RECOVERY]: 'section 7(2)(f)',
  [DEDUCTION_KIND.LOAN_RECOVERY]: 'section 7(2)(fff)',
  [DEDUCTION_KIND.INCOME_TAX]: 'section 7(2)(g)',
  [DEDUCTION_KIND.COURT_ORDER]: 'section 7(2)(h)',
  [DEDUCTION_KIND.PROVIDENT_FUND]: 'section 7(2)(i)',
  [DEDUCTION_KIND.CO_OPERATIVE_SOCIETY]: 'section 7(2)(j)',
  [DEDUCTION_KIND.INSURANCE_PREMIUM]: 'section 7(2)(k)',
  [DEDUCTION_KIND.TRADE_UNION]: 'section 7(2)(kkk)',
  [DEDUCTION_KIND.POSTAL_INSURANCE]: 'section 7(2)(l)',
  [DEDUCTION_KIND.RELIEF_FUND]: 'section 7(2)(m)',
  [DEDUCTION_KIND.UNAUTHORISED]: 'section 7(2)',
};

/**
 * The order in which deductions give way when the ceiling is exceeded.
 *
 * Lower abates first. This is a legal ordering and not a preference:
 *
 * A provident fund contribution and the income tax are liabilities the employer
 * owes to somebody else and has already incurred; deferring them creates a
 * default under a different statute rather than curing one under this. A court
 * order is an order, and the court that made it is the only thing that can vary
 * it. Those three are unabatable, and carry no rank.
 *
 * Of what remains, a fine abates first because it is the only deduction that is
 * a punishment rather than a recovery, and section 8 already treats it as the
 * most constrained. Then the discretionary recoveries — an advance, then a
 * loan — because both are the employer's own money and deferring either costs
 * nobody anything but time. Then the charges for what the employer supplied.
 * The authorised voluntary deductions abate last of the abatable, because the
 * employee asked for them.
 */
const ABATEMENT_RANK = {
  [DEDUCTION_KIND.FINE]: 1,
  [DEDUCTION_KIND.DAMAGE_OR_LOSS]: 2,
  [DEDUCTION_KIND.ADVANCE_RECOVERY]: 3,
  [DEDUCTION_KIND.LOAN_RECOVERY]: 4,
  [DEDUCTION_KIND.AMENITIES]: 5,
  [DEDUCTION_KIND.HOUSE_ACCOMMODATION]: 6,
  [DEDUCTION_KIND.CO_OPERATIVE_SOCIETY]: 7,
  [DEDUCTION_KIND.TRADE_UNION]: 8,
  [DEDUCTION_KIND.INSURANCE_PREMIUM]: 9,
  [DEDUCTION_KIND.POSTAL_INSURANCE]: 10,
  [DEDUCTION_KIND.RELIEF_FUND]: 11,
};

/**
 * The three that cannot be abated.
 *
 * Absence is not here and is not in `ABATEMENT_RANK` either, which is
 * deliberate: a deduction for absence is not a deduction from earned wages, it
 * is wages that were never earned. Abating it would pay somebody for a day they
 * did not work. It is handled before the ceiling rather than inside it — see
 * `assessWagePeriod`.
 */
const UNABATABLE = new Set([
  DEDUCTION_KIND.PROVIDENT_FUND,
  DEDUCTION_KIND.INCOME_TAX,
  DEDUCTION_KIND.COURT_ORDER,
]);

const FINDING = {
  AGGREGATE_CEILING: 'AGGREGATE_CEILING',
  ACT_NOT_APPLICABLE: 'ACT_NOT_APPLICABLE',
  UNAUTHORISED_DEDUCTION: 'UNAUTHORISED_DEDUCTION',
  FINE_CEILING: 'FINE_CEILING',
  FINE_UNAPPROVED_ACT: 'FINE_UNAPPROVED_ACT',
  FINE_ON_MINOR: 'FINE_ON_MINOR',
  FINE_TIME_BARRED: 'FINE_TIME_BARRED',
  FINE_IN_INSTALMENTS: 'FINE_IN_INSTALMENTS',
  DAMAGE_EXCEEDS_LOSS: 'DAMAGE_EXCEEDS_LOSS',
  DAMAGE_WITHOUT_SHOW_CAUSE: 'DAMAGE_WITHOUT_SHOW_CAUSE',
  ABSENCE_DISPROPORTIONATE: 'ABSENCE_DISPROPORTIONATE',
  CONCERTED_ABSENCE_EXCEEDED: 'CONCERTED_ABSENCE_EXCEEDED',
  WAGE_PERIOD_TOO_LONG: 'WAGE_PERIOD_TOO_LONG',
  PAYMENT_LATE: 'PAYMENT_LATE',
  TERMINATION_PAYMENT_LATE: 'TERMINATION_PAYMENT_LATE',
  ABATEMENT_APPLIED: 'ABATEMENT_APPLIED',
  ABATEMENT_INSUFFICIENT: 'ABATEMENT_INSUFFICIENT',
};

const FINDING_SECTION = {
  [FINDING.AGGREGATE_CEILING]: 'section 7(3)',
  [FINDING.ACT_NOT_APPLICABLE]: 'section 1(6)',
  [FINDING.UNAUTHORISED_DEDUCTION]: 'section 7(2)',
  [FINDING.FINE_CEILING]: 'section 8(1), proviso',
  [FINDING.FINE_UNAPPROVED_ACT]: 'section 8(1)',
  [FINDING.FINE_ON_MINOR]: 'section 8(3)',
  [FINDING.FINE_TIME_BARRED]: 'section 8(6)',
  [FINDING.FINE_IN_INSTALMENTS]: 'section 8(5)',
  [FINDING.DAMAGE_EXCEEDS_LOSS]: 'section 10(1)',
  [FINDING.DAMAGE_WITHOUT_SHOW_CAUSE]: 'section 10(1A)',
  [FINDING.ABSENCE_DISPROPORTIONATE]: 'section 9(2)',
  [FINDING.CONCERTED_ABSENCE_EXCEEDED]: 'section 9(2), proviso',
  [FINDING.WAGE_PERIOD_TOO_LONG]: 'section 4(2)',
  [FINDING.PAYMENT_LATE]: 'section 5(1)',
  [FINDING.TERMINATION_PAYMENT_LATE]: 'section 5(4)',
  [FINDING.ABATEMENT_APPLIED]: 'section 7(3)',
  [FINDING.ABATEMENT_INSUFFICIENT]: 'section 7(3)',
};

const SEVERITY = {
  BREACH: 'BREACH',
  ADJUSTED: 'ADJUSTED',
  INFORMATIONAL: 'INFORMATIONAL',
};

/**
 * @param {*} value
 * @returns {number} the finite value, or zero
 */
function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

/**
 * Round to paise.
 *
 * @param {number} value
 * @returns {number}
 */
function round2(value) {
  const numeric = toNumber(value);
  return Math.round((numeric + Number.EPSILON) * 100) / 100;
}

/**
 * @param {*} value
 * @returns {Date|null}
 */
function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Whole days between two dates, ignoring the time of day.
 *
 * @param {Date} from
 * @param {Date} to
 * @returns {number}
 */
function daysBetween(from, to) {
  const a = Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate(),
  );
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((b - a) / MS_PER_DAY);
}

/**
 * Merge a rule set over the Act's figures.
 *
 * @param {object} [limits]
 * @returns {object}
 */
function resolveLimits(limits) {
  return { ...PAYMENT_OF_WAGES_LIMITS, ...(limits || {}) };
}

/**
 * @param {string} code
 * @param {string} severity
 * @param {string} message
 * @param {object} [context]
 * @returns {object}
 */
function finding(code, severity, message, context = {}) {
  return {
    code,
    section: FINDING_SECTION[code] || '',
    severity,
    message,
    ...context,
  };
}

/**
 * Classify a deduction into the section 7(2) clause it belongs to.
 *
 * Takes the declared kind when there is one, and otherwise reads the label —
 * because the deductions already in `payroll.deductions` were written by six
 * engines that had no reason to declare a clause, and a migration that left
 * them all unauthorised would report a breach for every payslip in the history.
 *
 * The label match is deliberately narrow. Guessing wrong in the direction of
 * "this is lawful" is the failure that matters, so anything unrecognised falls
 * to UNAUTHORISED and is reported rather than assumed into a clause.
 *
 * @param {object} deduction
 * @returns {string} a DEDUCTION_KIND
 */
function classifyDeduction(deduction) {
  const declared = deduction?.kind;
  if (declared && Object.hasOwn(DEDUCTION_KIND, declared)) {
    return DEDUCTION_KIND[declared];
  }

  const label = String(deduction?.label || deduction?.code || '')
    .toLowerCase()
    .trim();

  if (!label) return DEDUCTION_KIND.UNAUTHORISED;

  // Ordered: 'co-operative society loan' is a co-operative payment and not a
  // loan recovery, and the 75% ceiling turns on the difference, so the
  // co-operative test runs before the loan one.
  if (/co.?op|society|sahakari/.test(label)) {
    return DEDUCTION_KIND.CO_OPERATIVE_SOCIETY;
  }
  if (/^pf$|provident|epf|vpf|pension fund/.test(label)) {
    return DEDUCTION_KIND.PROVIDENT_FUND;
  }
  if (/^tds$|income.?tax|withholding tax/.test(label)) {
    return DEDUCTION_KIND.INCOME_TAX;
  }
  if (/court|attach|garnish|decree|maintenance order/.test(label)) {
    return DEDUCTION_KIND.COURT_ORDER;
  }
  if (/fine|penalt/.test(label)) return DEDUCTION_KIND.FINE;
  if (/absen|lop|loss of pay|leave without pay/.test(label)) {
    return DEDUCTION_KIND.ABSENCE;
  }
  if (/damage|breakage|shortage|loss of goods/.test(label)) {
    return DEDUCTION_KIND.DAMAGE_OR_LOSS;
  }
  if (/quarter|accommodation|housing|hostel/.test(label)) {
    return DEDUCTION_KIND.HOUSE_ACCOMMODATION;
  }
  if (/canteen|transport|amenit|uniform|meal/.test(label)) {
    return DEDUCTION_KIND.AMENITIES;
  }
  if (/advance|salary advance|imprest/.test(label)) {
    return DEDUCTION_KIND.ADVANCE_RECOVERY;
  }
  if (/loan|emi|instal/.test(label)) return DEDUCTION_KIND.LOAN_RECOVERY;
  if (/insurance|lic|premium/.test(label)) {
    return /postal/.test(label)
      ? DEDUCTION_KIND.POSTAL_INSURANCE
      : DEDUCTION_KIND.INSURANCE_PREMIUM;
  }
  if (/union|check.?off/.test(label)) return DEDUCTION_KIND.TRADE_UNION;
  if (/relief fund|pmnrf|pm cares/.test(label)) {
    return DEDUCTION_KIND.RELIEF_FUND;
  }

  // Professional tax and ESI are lawful deductions and neither is in section
  // 7(2)'s list, because both post-date it. Both are "required by law" in the
  // sense clause (g) reaches, and both are treated as such here rather than
  // reported as withholdings.
  if (/professional tax|^pt$|ptax/.test(label))
    return DEDUCTION_KIND.INCOME_TAX;
  if (/^esi$|state insurance/.test(label)) return DEDUCTION_KIND.PROVIDENT_FUND;

  return DEDUCTION_KIND.UNAUTHORISED;
}

/**
 * The section 7(3) ceiling for a set of deductions.
 *
 * Seventy-five per cent is reached by the facts and not by configuration: the
 * proviso raises the ceiling where the deductions are wholly or partly payments
 * to co-operative societies, so the presence of such a payment in the set is
 * what does it. An establishment cannot elect into the higher ceiling, and a
 * co-operative payment of one rupee reaches it — which reads as a loophole and
 * is what the proviso says.
 *
 * @param {Array<object>} classified deductions with a `kind`
 * @param {number} wages the wages of the period
 * @param {object} limits
 * @returns {{percent: number, amount: number, raised: boolean}}
 */
function resolveCeiling(classified, wages, limits) {
  const rules = resolveLimits(limits);

  const raised = classified.some(
    (entry) =>
      entry.kind === DEDUCTION_KIND.CO_OPERATIVE_SOCIETY && entry.amount > 0,
  );

  const percent = raised
    ? rules.maxDeductionPercentWithCoOperative
    : rules.maxDeductionPercent;

  return {
    percent,
    amount: round2((toNumber(wages) * percent) / 100),
    raised,
  };
}

/**
 * Section 8, in full, for the fines imposed in one wage period.
 *
 * Five separate rules, and an employer can satisfy four of them. The ceiling is
 * on the period rather than on the fine, so two lawful fines of two per cent
 * each are an unlawful four per cent together — the same aggregation problem as
 * section 7(3), one level down.
 *
 * @param {Array<object>} fines
 * @param {number} wages wages payable in the period
 * @param {object} context
 * @param {number} [context.age] the employee's age, for section 8(3)
 * @param {Array<string>} [context.approvedActs] the displayed list
 * @param {Date} [context.periodEnd]
 * @param {object} [context.limits]
 * @returns {{findings: Array<object>, recoverable: number, disallowed: number, entries: Array<object>}}
 */
function evaluateFines(fines, wages, context = {}) {
  const rules = resolveLimits(context.limits);
  const findings = [];
  const entries = [];

  const approved = new Set(
    (context.approvedActs || []).map((act) => String(act).toLowerCase().trim()),
  );
  const periodEnd = toDate(context.periodEnd);
  const ceiling = round2((toNumber(wages) * rules.maxFinePercent) / 100);

  // Section 8(3). A single test that disallows every fine in the period, so it
  // runs before the rest — there is nothing to rank or abate if none of them
  // could be imposed at all.
  const isMinor =
    Number.isFinite(Number(context.age)) &&
    Number(context.age) < rules.minFineableAge;

  let running = 0;

  for (const fine of fines || []) {
    const amount = round2(Math.max(0, toNumber(fine?.amount)));
    const act = String(fine?.act || '').trim();
    const imposedOn = toDate(fine?.imposedOn);
    const reasons = [];

    if (isMinor) {
      reasons.push(FINDING.FINE_ON_MINOR);
      findings.push(
        finding(
          FINDING.FINE_ON_MINOR,
          SEVERITY.BREACH,
          `A fine of ₹${amount.toFixed(2)} was imposed on an employee aged ${context.age}. No fine may be imposed on anybody under ${rules.minFineableAge}.`,
          { amount, act },
        ),
      );
    }

    if (act && approved.size > 0 && !approved.has(act.toLowerCase())) {
      reasons.push(FINDING.FINE_UNAPPROVED_ACT);
      findings.push(
        finding(
          FINDING.FINE_UNAPPROVED_ACT,
          SEVERITY.BREACH,
          `“${act}” is not on the approved list of acts and omissions, so no fine may be imposed for it.`,
          { amount, act },
        ),
      );
    }

    // Section 8(6). Sixty days from the day of the act, not from the day it
    // was discovered and not from the day the fine was decided.
    if (imposedOn && periodEnd) {
      const age = daysBetween(imposedOn, periodEnd);
      if (age > rules.fineRecoveryWindowDays) {
        reasons.push(FINDING.FINE_TIME_BARRED);
        findings.push(
          finding(
            FINDING.FINE_TIME_BARRED,
            SEVERITY.BREACH,
            `The act was on ${imposedOn.toISOString().slice(0, 10)}, ${age} days before the end of this wage period. A fine may not be recovered more than ${rules.fineRecoveryWindowDays} days after the act.`,
            { amount, act, daysSinceAct: age },
          ),
        );
      }
    }

    // Section 8(5). By instalments, or after the sixty days — the sub-section
    // forbids both, and an instalment plan is how the sixty days get exceeded.
    if (toNumber(fine?.instalments) > 1) {
      reasons.push(FINDING.FINE_IN_INSTALMENTS);
      findings.push(
        finding(
          FINDING.FINE_IN_INSTALMENTS,
          SEVERITY.BREACH,
          `A fine of ₹${amount.toFixed(2)} is being recovered in ${toNumber(fine.instalments)} instalments. A fine may not be recovered by instalments.`,
          { amount, act },
        ),
      );
    }

    const allowed = reasons.length === 0;

    // The ceiling is tested on the fines that survived the other four rules.
    // Counting a disallowed fine toward the three per cent would let an
    // unlawful fine crowd out a lawful one.
    let recoverable = 0;
    if (allowed) {
      const headroom = Math.max(0, round2(ceiling - running));
      recoverable = Math.min(amount, headroom);

      if (recoverable < amount) {
        findings.push(
          finding(
            FINDING.FINE_CEILING,
            SEVERITY.ADJUSTED,
            `Fines in this wage period reach ₹${round2(running + amount).toFixed(2)} against a ceiling of ₹${ceiling.toFixed(2)} — ${rules.maxFinePercent}% of ₹${round2(wages).toFixed(2)}. ₹${round2(amount - recoverable).toFixed(2)} is not recoverable in this period.`,
            { amount, act, ceiling, recoverable },
          ),
        );
      }

      running = round2(running + recoverable);
    }

    entries.push({
      act,
      amount,
      imposedOn,
      allowed,
      recoverable: round2(recoverable),
      disallowed: round2(amount - recoverable),
      reasons,
    });
  }

  return {
    findings,
    ceiling,
    recoverable: round2(running),
    disallowed: round2(
      entries.reduce((sum, entry) => sum + entry.disallowed, 0),
    ),
    entries,
  };
}

/**
 * Section 9 — deduction for absence from duty.
 *
 * The general rule is proportion: the deduction bears the same relation to the
 * wages of the period that the absence bears to the period. The proviso is the
 * only place in the Act where a deduction may exceed the time lost, and it is
 * gated on facts the payroll cannot infer — ten or more employees absenting
 * themselves without due notice and in concert — so it is reached by an
 * explicit flag and never by arithmetic.
 *
 * @param {object} input
 * @param {number} input.wages
 * @param {number} input.periodDays
 * @param {number} input.absentDays
 * @param {number} input.deducted what was actually deducted
 * @param {boolean} [input.concerted]
 * @param {number} [input.participantCount]
 * @param {object} [input.limits]
 * @returns {{findings: Array<object>, proportionate: number, permitted: number}}
 */
function evaluateAbsenceDeduction(input) {
  const rules = resolveLimits(input?.limits);
  const findings = [];

  const wages = Math.max(0, toNumber(input?.wages));
  const periodDays = Math.max(1, toNumber(input?.periodDays));
  const absentDays = Math.max(0, toNumber(input?.absentDays));
  const deducted = Math.max(0, toNumber(input?.deducted));

  const dailyWage = wages / periodDays;
  const proportionate = round2(dailyWage * Math.min(absentDays, periodDays));

  let permitted = proportionate;

  if (input?.concerted) {
    const participants = toNumber(input?.participantCount);

    if (participants < rules.concertedAbsenceMinEmployees) {
      // The proviso needs ten. Below that it is an ordinary absence and the
      // ordinary rule applies — flagging it as concerted does not make it so.
      findings.push(
        finding(
          FINDING.CONCERTED_ABSENCE_EXCEEDED,
          SEVERITY.BREACH,
          `A concerted absence deduction needs ${rules.concertedAbsenceMinEmployees} or more employees absenting themselves together; ${participants} were recorded. The proportionate deduction of ₹${proportionate.toFixed(2)} is the limit.`,
          { participants, proportionate },
        ),
      );
    } else {
      permitted = round2(dailyWage * rules.concertedAbsenceMaxDays);

      findings.push(
        finding(
          FINDING.CONCERTED_ABSENCE_EXCEEDED,
          SEVERITY.INFORMATIONAL,
          `The proviso to section 9(2) permits up to ${rules.concertedAbsenceMaxDays} days' wages — ₹${permitted.toFixed(2)} — where ${participants} employees absented themselves in concert and without due notice. The time actually lost was ${absentDays} day(s), worth ₹${proportionate.toFixed(2)}.`,
          { participants, proportionate, permitted },
        ),
      );
    }
  }

  if (deducted > permitted + 0.01) {
    findings.push(
      finding(
        FINDING.ABSENCE_DISPROPORTIONATE,
        SEVERITY.BREACH,
        `₹${deducted.toFixed(2)} was deducted for ${absentDays} day(s) absent in a period of ${periodDays} days. The deduction may not exceed ₹${permitted.toFixed(2)}.`,
        { deducted, permitted, absentDays, periodDays },
      ),
    );
  }

  return {
    findings,
    proportionate,
    permitted,
    excess: round2(Math.max(0, deducted - permitted)),
  };
}

/**
 * Section 10 — deduction for damage or loss.
 *
 * Two conditions, and the second is the one that is skipped: the deduction may
 * not exceed the amount of the damage, *and* it may not be made until the
 * employee has been given an opportunity to show cause. A recorded show-cause
 * is what makes the deduction lawful, so its absence is a breach at any amount
 * including one below the loss.
 *
 * @param {Array<object>} deductions
 * @returns {Array<object>} findings
 */
function evaluateDamageDeductions(deductions) {
  const findings = [];

  for (const entry of deductions || []) {
    const amount = round2(Math.max(0, toNumber(entry?.amount)));
    const loss = round2(Math.max(0, toNumber(entry?.assessedLoss)));

    if (loss > 0 && amount > loss + 0.01) {
      findings.push(
        finding(
          FINDING.DAMAGE_EXCEEDS_LOSS,
          SEVERITY.BREACH,
          `₹${amount.toFixed(2)} was deducted for damage assessed at ₹${loss.toFixed(2)}. A deduction under section 10 may not exceed the amount of the damage or loss.`,
          { amount, assessedLoss: loss, label: entry?.label || '' },
        ),
      );
    }

    if (amount > 0 && !entry?.showCauseRecordedOn) {
      findings.push(
        finding(
          FINDING.DAMAGE_WITHOUT_SHOW_CAUSE,
          SEVERITY.BREACH,
          `₹${amount.toFixed(2)} was deducted for damage or loss without a recorded opportunity to show cause.`,
          { amount, label: entry?.label || '' },
        ),
      );
    }
  }

  return findings;
}

/**
 * Section 5 — when the wages had to be paid.
 *
 * Two rules that are not variants of each other. The ordinary deadline runs
 * from the end of the wage period and is measured in calendar days. The
 * termination deadline runs from the termination and is measured in **working**
 * days, so a Friday termination in an establishment closed at the weekend falls
 * due on the Tuesday and not on the Sunday.
 *
 * @param {object} input
 * @param {Date} input.periodEnd
 * @param {Date} [input.paidOn]
 * @param {number} [input.headcount]
 * @param {Date} [input.terminatedOn]
 * @param {Array<number>} [input.weeklyOffDays] 0 = Sunday
 * @param {Array<string>} [input.holidays] ISO dates
 * @param {object} [input.limits]
 * @returns {{findings: Array<object>, dueOn: Date|null, daysLate: number}}
 */
function evaluatePaymentDeadline(input) {
  const rules = resolveLimits(input?.limits);
  const findings = [];

  const periodEnd = toDate(input?.periodEnd);
  const paidOn = toDate(input?.paidOn);
  const terminatedOn = toDate(input?.terminatedOn);

  if (!periodEnd) return { findings, dueOn: null, daysLate: 0 };

  const offDays = new Set(
    Array.isArray(input?.weeklyOffDays) ? input.weeklyOffDays : [0],
  );
  const holidays = new Set(input?.holidays || []);

  const isWorkingDay = (date) =>
    !offDays.has(date.getUTCDay()) &&
    !holidays.has(date.toISOString().slice(0, 10));

  let dueOn;
  let code;

  if (terminatedOn) {
    // Section 5(4). Count forward two *working* days from the termination.
    dueOn = new Date(terminatedOn.getTime());
    let counted = 0;
    let guard = 0;

    while (counted < rules.terminationPaymentWorkingDays && guard < 60) {
      dueOn = new Date(dueOn.getTime() + MS_PER_DAY);
      if (isWorkingDay(dueOn)) counted += 1;
      guard += 1;
    }

    code = FINDING.TERMINATION_PAYMENT_LATE;
  } else {
    const headcount = toNumber(input?.headcount);
    const allowance =
      headcount >= rules.headcountThreshold
        ? rules.paymentDayAtOrAboveThreshold
        : rules.paymentDayBelowThreshold;

    dueOn = new Date(periodEnd.getTime() + allowance * MS_PER_DAY);
    code = FINDING.PAYMENT_LATE;
  }

  let daysLate = 0;

  if (paidOn && paidOn.getTime() > dueOn.getTime()) {
    daysLate = daysBetween(dueOn, paidOn);

    findings.push(
      finding(
        code,
        SEVERITY.BREACH,
        terminatedOn
          ? `Wages on termination fell due on ${dueOn.toISOString().slice(0, 10)} — the second working day after ${terminatedOn.toISOString().slice(0, 10)} — and were paid ${daysLate} day(s) late.`
          : `Wages for this period fell due on ${dueOn.toISOString().slice(0, 10)} and were paid ${daysLate} day(s) late.`,
        { dueOn, paidOn, daysLate },
      ),
    );
  }

  return { findings, dueOn, daysLate };
}

/**
 * Section 4 — the wage period may not exceed one month.
 *
 * @param {Date} periodStart
 * @param {Date} periodEnd
 * @param {object} [limits]
 * @returns {Array<object>} findings
 */
function evaluateWagePeriod(periodStart, periodEnd, limits) {
  const rules = resolveLimits(limits);
  const start = toDate(periodStart);
  const end = toDate(periodEnd);

  if (!start || !end) return [];

  const length = daysBetween(start, end) + 1;

  if (length > rules.maxWagePeriodDays) {
    return [
      finding(
        FINDING.WAGE_PERIOD_TOO_LONG,
        SEVERITY.BREACH,
        `The wage period runs ${length} days. No wage period may exceed one month.`,
        { periodStart: start, periodEnd: end, lengthDays: length },
      ),
    ];
  }

  return [];
}

/**
 * Bring the total of the deductions within the ceiling.
 *
 * Walks `ABATEMENT_RANK` in order, taking as much as it can from each abatable
 * deduction until the excess is cleared. Everything taken is a deferral rather
 * than a waiver: the amounts come back as `carryForward`, because the loan
 * instalment that gave way is still owed.
 *
 * The interesting case is when it cannot be cleared. Unabatable deductions can
 * exceed fifty per cent on their own — a large attachment against a small wage
 * does it — and there is nothing lawful the employer may do about that except
 * pay the attachment and report the position, so it returns
 * ABATEMENT_INSUFFICIENT rather than abating something it is not allowed to.
 *
 * @param {Array<object>} classified
 * @param {number} ceilingAmount
 * @returns {{deductions: Array<object>, findings: Array<object>, abated: number, carryForward: number, total: number}}
 */
function abateToC(classified, ceilingAmount) {
  const findings = [];
  const working = classified.map((entry) => ({ ...entry, abated: 0 }));

  const total = round2(working.reduce((sum, entry) => sum + entry.amount, 0));

  let excess = round2(total - ceilingAmount);
  if (excess <= 0.01) {
    return {
      deductions: working.map((entry) => ({
        ...entry,
        payable: round2(entry.amount),
        carryForward: 0,
      })),
      findings,
      abated: 0,
      carryForward: 0,
      total,
    };
  }

  const abatable = working
    .filter((entry) => !UNABATABLE.has(entry.kind) && entry.amount > 0)
    .filter((entry) => entry.kind !== DEDUCTION_KIND.ABSENCE)
    .sort(
      (a, b) => (ABATEMENT_RANK[a.kind] || 99) - (ABATEMENT_RANK[b.kind] || 99),
    );

  for (const entry of abatable) {
    if (excess <= 0.01) break;

    const take = Math.min(entry.amount, excess);
    entry.abated = round2(take);
    excess = round2(excess - take);
  }

  const abated = round2(working.reduce((sum, entry) => sum + entry.abated, 0));

  if (abated > 0) {
    findings.push(
      finding(
        FINDING.ABATEMENT_APPLIED,
        SEVERITY.ADJUSTED,
        `Deductions of ₹${total.toFixed(2)} exceeded the ceiling of ₹${round2(ceilingAmount).toFixed(2)}. ₹${abated.toFixed(2)} has been deferred to the next wage period.`,
        { total, ceiling: round2(ceilingAmount), abated },
      ),
    );
  }

  if (excess > 0.01) {
    const unabatable = round2(
      working
        .filter((entry) => UNABATABLE.has(entry.kind))
        .reduce((sum, entry) => sum + entry.amount, 0),
    );

    findings.push(
      finding(
        FINDING.ABATEMENT_INSUFFICIENT,
        SEVERITY.BREACH,
        `₹${excess.toFixed(2)} remains above the ceiling after deferring everything that may be deferred. ₹${unabatable.toFixed(2)} of provident fund, income tax and court-ordered deductions cannot be abated by the employer.`,
        { residual: excess, unabatable, ceiling: round2(ceilingAmount) },
      ),
    );
  }

  return {
    deductions: working.map((entry) => ({
      ...entry,
      payable: round2(entry.amount - entry.abated),
      carryForward: round2(entry.abated),
    })),
    findings,
    abated,
    carryForward: abated,
    total,
  };
}

/**
 * One employee, one wage period.
 *
 * The order matters and is not arbitrary. Absence comes out first because those
 * are wages that were never earned, so they reduce the base the fifty per cent
 * is measured against rather than counting toward it — deducting three days of
 * absence from a monthly wage and then allowing fifty per cent of the full
 * month would permit a deduction of more than half of what the employee is
 * actually owed. Fines are evaluated next because section 8 can disallow some
 * of them, and a disallowed fine should not consume ceiling headroom. Then the
 * aggregate, then the abatement.
 *
 * @param {object} input
 * @param {number} input.grossWages wages payable for the period, before deductions
 * @param {Array<object>} input.deductions
 * @param {Array<object>} [input.fines]
 * @param {object} [input.absence]
 * @param {object} [input.payment]
 * @param {object} [input.employee]
 * @param {object} [input.limits]
 * @returns {object}
 */
function assessWagePeriod(input) {
  const rules = resolveLimits(input?.limits);
  const findings = [];

  const grossWages = Math.max(0, toNumber(input?.grossWages));
  const employee = input?.employee || {};

  // Section 1(6). Above the notified ceiling the Act does not apply at all, and
  // reporting breaches of a statute that does not reach the employee would be
  // noise on exactly the senior payroll where large deductions are normal.
  const monthlyWage = toNumber(employee.monthlyWage) || grossWages;
  const covered = monthlyWage <= rules.applicabilityWageCeiling;

  if (!covered) {
    return {
      covered: false,
      employeeId: employee.employeeId || null,
      employeeName: employee.name || '',
      grossWages: round2(grossWages),
      netWages: round2(grossWages),
      findings: [
        finding(
          FINDING.ACT_NOT_APPLICABLE,
          SEVERITY.INFORMATIONAL,
          `Wages of ₹${round2(monthlyWage).toFixed(2)} a month are above the section 1(6) ceiling of ₹${rules.applicabilityWageCeiling.toFixed(2)}, so the Act does not apply.`,
          { monthlyWage: round2(monthlyWage) },
        ),
      ],
      deductions: [],
      totals: {
        deducted: 0,
        ceiling: 0,
        ceilingPercent: 0,
        abated: 0,
        carryForward: 0,
      },
    };
  }

  const classified = (input?.deductions || []).map((deduction) => {
    const kind = classifyDeduction(deduction);
    return {
      label: deduction?.label || deduction?.code || '',
      kind,
      clause: DEDUCTION_CLAUSE[kind],
      amount: round2(Math.max(0, toNumber(deduction?.amount))),
      assessedLoss: deduction?.assessedLoss,
      showCauseRecordedOn: deduction?.showCauseRecordedOn,
    };
  });

  for (const entry of classified) {
    if (entry.kind === DEDUCTION_KIND.UNAUTHORISED && entry.amount > 0) {
      findings.push(
        finding(
          FINDING.UNAUTHORISED_DEDUCTION,
          SEVERITY.BREACH,
          `“${entry.label || 'unnamed deduction'}” of ₹${entry.amount.toFixed(2)} is not a deduction authorised by section 7(2). Section 23 voids any agreement by which the employee consents to it.`,
          { label: entry.label, amount: entry.amount },
        ),
      );
    }
  }

  findings.push(
    ...evaluateDamageDeductions(
      classified.filter(
        (entry) => entry.kind === DEDUCTION_KIND.DAMAGE_OR_LOSS,
      ),
    ),
  );

  // Absence, first, and out of the base.
  const absenceEntries = classified.filter(
    (entry) => entry.kind === DEDUCTION_KIND.ABSENCE,
  );
  const absenceDeducted = round2(
    absenceEntries.reduce((sum, entry) => sum + entry.amount, 0),
  );

  let absenceResult = null;
  if (input?.absence || absenceDeducted > 0) {
    absenceResult = evaluateAbsenceDeduction({
      wages: grossWages,
      periodDays: input?.absence?.periodDays || 30,
      absentDays: input?.absence?.absentDays || 0,
      deducted: absenceDeducted,
      concerted: input?.absence?.concerted,
      participantCount: input?.absence?.participantCount,
      limits: rules,
    });
    findings.push(...absenceResult.findings);
  }

  const earnedWages = round2(Math.max(0, grossWages - absenceDeducted));

  // Fines, second, against the earned wages.
  const fineResult = evaluateFines(input?.fines || [], earnedWages, {
    age: employee.age,
    approvedActs: input?.approvedActs,
    periodEnd: input?.payment?.periodEnd,
    limits: rules,
  });
  findings.push(...fineResult.findings);

  // The fines that survive replace whatever fine rows arrived in the deduction
  // set, so a fine disallowed under section 8 does not reappear as a deduction.
  const nonFine = classified.filter(
    (entry) =>
      entry.kind !== DEDUCTION_KIND.FINE &&
      entry.kind !== DEDUCTION_KIND.ABSENCE,
  );

  const forCeiling =
    fineResult.recoverable > 0
      ? [
          ...nonFine,
          {
            label: 'Fines (section 8)',
            kind: DEDUCTION_KIND.FINE,
            clause: DEDUCTION_CLAUSE[DEDUCTION_KIND.FINE],
            amount: fineResult.recoverable,
          },
        ]
      : nonFine;

  const ceiling = resolveCeiling(forCeiling, earnedWages, rules);
  const abatement = abateToC(forCeiling, ceiling.amount);
  findings.push(...abatement.findings);

  if (abatement.total > ceiling.amount + 0.01) {
    findings.unshift(
      finding(
        FINDING.AGGREGATE_CEILING,
        SEVERITY.BREACH,
        `Deductions of ₹${abatement.total.toFixed(2)} are ${round2((abatement.total / Math.max(earnedWages, 1)) * 100).toFixed(1)}% of wages of ₹${earnedWages.toFixed(2)}, against a ceiling of ${ceiling.percent}%.`,
        {
          total: abatement.total,
          ceiling: ceiling.amount,
          ceilingPercent: ceiling.percent,
          ceilingRaised: ceiling.raised,
        },
      ),
    );
  }

  const deadline = evaluatePaymentDeadline({
    periodEnd: input?.payment?.periodEnd,
    paidOn: input?.payment?.paidOn,
    headcount: input?.payment?.headcount,
    terminatedOn: employee.terminatedOn,
    weeklyOffDays: input?.payment?.weeklyOffDays,
    holidays: input?.payment?.holidays,
    limits: rules,
  });
  findings.push(...deadline.findings);

  findings.push(
    ...evaluateWagePeriod(
      input?.payment?.periodStart,
      input?.payment?.periodEnd,
      rules,
    ),
  );

  const payable = round2(
    abatement.deductions.reduce((sum, entry) => sum + entry.payable, 0),
  );

  return {
    covered: true,
    employeeId: employee.employeeId || null,
    employeeName: employee.name || '',
    grossWages: round2(grossWages),
    earnedWages,
    absence: absenceResult,
    fines: fineResult,
    deductions: abatement.deductions,
    netWages: round2(earnedWages - payable),
    dueOn: deadline.dueOn,
    daysLate: deadline.daysLate,
    findings,
    totals: {
      deducted: payable,
      attempted: abatement.total,
      ceiling: ceiling.amount,
      ceilingPercent: ceiling.percent,
      ceilingRaised: ceiling.raised,
      abated: abatement.abated,
      carryForward: abatement.carryForward,
      finesRecoverable: fineResult.recoverable,
      finesDisallowed: fineResult.disallowed,
      deductionPercent:
        earnedWages > 0 ? round2((payable / earnedWages) * 100) : 0,
    },
  };
}

/**
 * A whole wage period, across the establishment.
 *
 * @param {Array<object>} rows one per employee, in `assessWagePeriod` shape
 * @param {object} [options]
 * @param {object} [options.limits]
 * @returns {object}
 */
function assessRegister(rows, options = {}) {
  const employees = (rows || []).map((row) =>
    assessWagePeriod({ ...row, limits: options.limits }),
  );

  const findings = [];
  const summary = new Map();

  for (const employee of employees) {
    for (const entry of employee.findings) {
      findings.push({
        ...entry,
        employeeId: employee.employeeId,
        employeeName: employee.employeeName,
      });

      const key = entry.code;
      if (!summary.has(key)) {
        summary.set(key, {
          code: key,
          section: entry.section,
          severity: entry.severity,
          count: 0,
          employees: new Set(),
        });
      }

      const bucket = summary.get(key);
      bucket.count += 1;
      if (employee.employeeId)
        bucket.employees.add(String(employee.employeeId));
    }
  }

  const covered = employees.filter((employee) => employee.covered);

  return {
    employeeCount: employees.length,
    coveredCount: covered.length,
    breachCount: findings.filter((entry) => entry.severity === SEVERITY.BREACH)
      .length,
    totalWages: round2(
      covered.reduce((sum, employee) => sum + (employee.earnedWages || 0), 0),
    ),
    totalDeducted: round2(
      covered.reduce((sum, employee) => sum + employee.totals.deducted, 0),
    ),
    totalAbated: round2(
      covered.reduce((sum, employee) => sum + (employee.totals.abated || 0), 0),
    ),
    totalCarryForward: round2(
      covered.reduce(
        (sum, employee) => sum + (employee.totals.carryForward || 0),
        0,
      ),
    ),
    totalFinesRealised: round2(
      covered.reduce(
        (sum, employee) => sum + (employee.totals.finesRecoverable || 0),
        0,
      ),
    ),
    findings,
    summary: [...summary.values()].map((bucket) => ({
      code: bucket.code,
      section: bucket.section,
      severity: bucket.severity,
      count: bucket.count,
      employeeCount: bucket.employees.size,
    })),
    employees,
  };
}

module.exports = {
  PAYMENT_OF_WAGES_LIMITS,
  DEDUCTION_KIND,
  DEDUCTION_CLAUSE,
  ABATEMENT_RANK,
  UNABATABLE,
  FINDING,
  FINDING_SECTION,
  SEVERITY,
  DAYS_PER_WEEK,
  resolveLimits,
  classifyDeduction,
  resolveCeiling,
  evaluateFines,
  evaluateAbsenceDeduction,
  evaluateDamageDeductions,
  evaluatePaymentDeadline,
  evaluateWagePeriod,
  abateToCeiling: abateToC,
  assessWagePeriod,
  assessRegister,
};
