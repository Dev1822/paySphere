/**
 * Employees' State Insurance Act, 1948 (#1768).
 *
 * ESI is the only Indian payroll statute whose coverage is decided by a
 * **period** rather than by a month, and every mistake made with it follows from
 * treating it as though it were not.
 *
 * Regulation 4 splits the year into two contribution periods — 1 April to 30
 * September and 1 October to 31 March — each with a benefit period lagging it by
 * three months. Coverage attaches to the period, and the proviso to Rule 50 is
 * the consequence: an employee whose wages exceed the ceiling *after the
 * beginning of* a contribution period continues to be an employee until the end
 * of it. So a raise from ₹20,000 to ₹26,000 in July does not end coverage in
 * July. It ends on 30 September, and July, August and September are contributed
 * on **₹26,000** — the wages actually paid, not the ₹21,000 ceiling and not the
 * old ₹20,000. The ceiling is a test for entry into the scheme; the Act contains
 * no cap on the contribution base at all.
 *
 * Underneath that sits a second asymmetry, running the other way. Overtime is
 * **excluded** when deciding coverage, because it is not a regular recurring
 * payment — so a heavy overtime month does not push somebody out of the scheme.
 * And overtime is **included** when computing the contribution, because section
 * 2(22) defines wages to include remuneration paid for overtime. The same rupee
 * is outside the test and inside the base, and nothing that carries one "ESI
 * wage" per employee can represent that.
 *
 * Pure functions, no database access.
 */

const MS_PER_DAY = 86400000;

/**
 * The notified figures, as the default rule set.
 *
 * A rule set rather than literals because every one of them has moved. The wage
 * ceiling went from ₹15,000 to ₹21,000 in 2017, the rates from 1.75/4.75 to
 * 0.75/3.25 in July 2019, and the section 42(1) daily floor from ₹137 to ₹176 in
 * 2019.
 */
const ESI_RULES = {
  /** Section 2(9) with Rule 50 — the monthly wage for coverage. */
  wageCeiling: 21000,
  /** Rule 50, proviso — the ceiling for a person with a disability. */
  disabledWageCeiling: 25000,
  /** Employee's share, per cent of wages. */
  employeeRatePercent: 0.75,
  /** Employer's share, per cent of wages. */
  employerRatePercent: 3.25,
  /** Section 42(1) — the daily average below which the employee pays nothing. */
  dailyWageFloor: 176,
  /** Regulation 31 — the day of the following month the contribution is due. */
  dueDayOfMonth: 15,
  /** Section 39(5)(a) — simple interest on a late contribution, per cent a year. */
  interestRatePercent: 12,
  /** Regulation 52A — contribution days needed for sickness benefit. */
  benefitQualifyingDays: 78,
  /** Section 2(12) — the headcount at which the Act applies. */
  applicabilityHeadcount: 10,
  /**
   * The employer's exemption for a newly engaged person with a disability,
   * in months. Section 2 of the 2008 amendment: three years.
   */
  disabledEmployerExemptionMonths: 36,
};

/**
 * Regulation 31C — damages for delayed payment.
 *
 * Bands, not a rate. Payable *in addition to* the section 39(5)(a) interest, so
 * a late contribution carries two separate charges and paying one does not
 * discharge the other.
 */
const DAMAGES_BANDS = [
  { upToDays: 60, ratePercent: 5, label: 'less than 2 months' },
  { upToDays: 120, ratePercent: 10, label: '2 months and above, below 4' },
  { upToDays: 180, ratePercent: 15, label: '4 months and above, below 6' },
  { upToDays: Infinity, ratePercent: 25, label: '6 months and above' },
];

/**
 * Why somebody is covered — or is not.
 *
 * The distinction that matters is between CONTINUED and COVERED. Both mean the
 * contribution is payable; only the first says the employee is above the
 * ceiling and being carried to the end of the period by the Rule 50 proviso,
 * which is the fact an inspection asks about and the one a boolean loses.
 */
const COVERAGE = {
  /** Wages are at or below the ceiling. */
  COVERED: 'COVERED',
  /** Above the ceiling, carried to the end of the period by Rule 50. */
  CONTINUED: 'CONTINUED',
  /** Above the ceiling at the start of the period. Not an employee. */
  EXCLUDED: 'EXCLUDED',
  /** Not employed in the month at all. */
  NOT_EMPLOYED: 'NOT_EMPLOYED',
};

const FINDING = {
  CEILING_CROSSED_MID_PERIOD: 'CEILING_CROSSED_MID_PERIOD',
  CONTRIBUTION_BASE_CAPPED: 'CONTRIBUTION_BASE_CAPPED',
  EMPLOYEE_EXEMPT_EMPLOYER_LIABLE: 'EMPLOYEE_EXEMPT_EMPLOYER_LIABLE',
  BELOW_QUALIFYING_DAYS: 'BELOW_QUALIFYING_DAYS',
  LATE_REMITTANCE: 'LATE_REMITTANCE',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  DISABLED_EMPLOYER_EXEMPT: 'DISABLED_EMPLOYER_EXEMPT',
};

const FINDING_SECTION = {
  [FINDING.CEILING_CROSSED_MID_PERIOD]: 'Rule 50, proviso',
  [FINDING.CONTRIBUTION_BASE_CAPPED]: 'section 2(22)',
  [FINDING.EMPLOYEE_EXEMPT_EMPLOYER_LIABLE]: 'section 42(1)',
  [FINDING.BELOW_QUALIFYING_DAYS]: 'Regulation 52A',
  [FINDING.LATE_REMITTANCE]: 'section 39(5)(a) and Regulation 31C',
  [FINDING.NOT_APPLICABLE]: 'section 2(12)',
  [FINDING.DISABLED_EMPLOYER_EXEMPT]: 'section 2, Amendment Act 2008',
};

const SEVERITY = {
  BREACH: 'BREACH',
  ADJUSTED: 'ADJUSTED',
  INFORMATIONAL: 'INFORMATIONAL',
};

/**
 * @param {*} value
 * @returns {number}
 */
function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

/**
 * @param {number} value
 * @returns {number}
 */
function round2(value) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
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
 * Merge a rule set over the notified figures.
 *
 * @param {object} [rules]
 * @returns {object}
 */
function resolveRules(rules) {
  return { ...ESI_RULES, ...(rules || {}) };
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
 * The contribution period containing a date.
 *
 * April to September, or October to March. The second one straddles the
 * calendar year, which is the detail every home-grown implementation of this
 * gets wrong: January belongs to the period that began in the *previous*
 * October, so its period start is in a different year from the date itself.
 *
 * @param {Date|string} date
 * @returns {{key: string, label: string, start: Date, end: Date}}
 */
function contributionPeriodFor(date) {
  const when = toDate(date) || new Date();
  const month = when.getUTCMonth() + 1;
  const year = when.getUTCFullYear();

  if (month >= 4 && month <= 9) {
    return {
      key: `${year}-H1`,
      label: `1 April ${year} – 30 September ${year}`,
      start: new Date(Date.UTC(year, 3, 1)),
      end: new Date(Date.UTC(year, 8, 30)),
    };
  }

  // October to March. A January date belongs to the period that started last
  // October, so the start year is one behind the date's.
  const startYear = month >= 10 ? year : year - 1;

  return {
    key: `${startYear}-H2`,
    label: `1 October ${startYear} – 31 March ${startYear + 1}`,
    start: new Date(Date.UTC(startYear, 9, 1)),
    end: new Date(Date.UTC(startYear + 1, 2, 31)),
  };
}

/**
 * The benefit period a contribution period feeds.
 *
 * Lagging by three months: contributions from April to September pay for
 * benefit from 1 January to 30 June of the following year. The lag is why an
 * employee who left the scheme in September is still drawing benefit in
 * December, and why dropping them from the register the month their wages rose
 * is visible to the employee before it is visible to the employer.
 *
 * @param {{key: string}} period a contribution period
 * @returns {{key: string, label: string, start: Date, end: Date}}
 */
function benefitPeriodFor(period) {
  const [yearPart, half] = String(period?.key || '').split('-');
  const year = Number(yearPart);

  if (!Number.isFinite(year)) {
    throw new TypeError('benefitPeriodFor needs a contribution period');
  }

  if (half === 'H1') {
    // April–September contributions → 1 January to 30 June of the next year.
    return {
      key: `${year + 1}-B1`,
      label: `1 January ${year + 1} – 30 June ${year + 1}`,
      start: new Date(Date.UTC(year + 1, 0, 1)),
      end: new Date(Date.UTC(year + 1, 5, 30)),
    };
  }

  // October–March contributions → 1 July to 31 December of the next year.
  return {
    key: `${year + 1}-B2`,
    label: `1 July ${year + 1} – 31 December ${year + 1}`,
    start: new Date(Date.UTC(year + 1, 6, 1)),
    end: new Date(Date.UTC(year + 1, 11, 31)),
  };
}

/**
 * The wages that decide coverage.
 *
 * Overtime is excluded, and that is the whole of this function. Overtime is not
 * a regular recurring payment, so it cannot take somebody out of the scheme —
 * an employee on ₹20,000 whose overtime brings a month to ₹22,000 has not
 * crossed the ceiling.
 *
 * The annual bonus, gratuity, retrenchment compensation and leave encashment are
 * excluded too, by Rule 2(22) itself, and for a different reason: none of them
 * is paid at intervals of less than two months.
 *
 * @param {object} wages
 * @returns {number}
 */
function coverageWage(wages) {
  return round2(
    toNumber(wages?.basic) +
      toNumber(wages?.dearnessAllowance) +
      toNumber(wages?.houseRentAllowance) +
      toNumber(wages?.otherAllowances) +
      toNumber(wages?.incentive),
  );
}

/**
 * The wages the contribution is computed on.
 *
 * Overtime is included, and nothing is capped. Section 2(22) means all
 * remuneration paid or payable in cash, and it names overtime expressly; the
 * Act sets no ceiling on the base, only on entry to the scheme.
 *
 * Capping this at ₹21,000 is the most common error in Indian payroll software
 * and it under-remits every month of every Rule 50 continuation.
 *
 * @param {object} wages
 * @returns {number}
 */
function contributionWage(wages) {
  return round2(coverageWage(wages) + toNumber(wages?.overtime));
}

/**
 * Coverage for one month, given where the contribution period stands.
 *
 * The state carried between months is `continuedFrom` — the date the employee
 * crossed the ceiling inside the current period. A boolean cannot hold it, which
 * is why `esiApplicable` on the employee document is the shape that produces the
 * bug: it has no memory of when it changed, so nothing can tell "crossed in July
 * and must continue to September" from "was never covered".
 *
 * @param {object} input
 * @param {object} input.wages
 * @param {Date} input.monthStart
 * @param {object} input.period the contribution period
 * @param {object} [input.previous] the previous month's decision
 * @param {boolean} [input.disabled]
 * @param {boolean} [input.employed]
 * @param {object} [input.rules]
 * @returns {{status: string, ceiling: number, coverageWage: number, contributionWage: number, continuedFrom: Date|null, findings: Array<object>}}
 */
function decideCoverage(input) {
  const rules = resolveRules(input?.rules);
  const findings = [];

  if (input?.employed === false) {
    return {
      status: COVERAGE.NOT_EMPLOYED,
      ceiling: 0,
      coverageWage: 0,
      contributionWage: 0,
      continuedFrom: null,
      findings,
    };
  }

  const ceiling = input?.disabled
    ? rules.disabledWageCeiling
    : rules.wageCeiling;

  const forTest = coverageWage(input?.wages);
  const forBase = contributionWage(input?.wages);
  const monthStart = toDate(input?.monthStart);
  const periodStart = toDate(input?.period?.start);

  const previousStatus = input?.previous?.status;
  const previousContinuedFrom = toDate(input?.previous?.continuedFrom);

  // Already being carried by the proviso. It runs to the end of the period and
  // nothing inside the period ends it — including the wages falling back below
  // the ceiling, which does not restart anything because coverage never stopped.
  if (
    previousContinuedFrom &&
    periodStart &&
    previousContinuedFrom >= periodStart
  ) {
    return {
      status: COVERAGE.CONTINUED,
      ceiling,
      coverageWage: forTest,
      contributionWage: forBase,
      continuedFrom: previousContinuedFrom,
      findings,
    };
  }

  if (forTest <= ceiling) {
    return {
      status: COVERAGE.COVERED,
      ceiling,
      coverageWage: forTest,
      contributionWage: forBase,
      continuedFrom: null,
      findings,
    };
  }

  // Above the ceiling. Whether that excludes the employee depends entirely on
  // whether it happened at the start of the period or during it.
  const atPeriodStart =
    !previousStatus ||
    previousStatus === COVERAGE.EXCLUDED ||
    (monthStart &&
      periodStart &&
      monthStart.getTime() === periodStart.getTime());

  const wasInScheme =
    previousStatus === COVERAGE.COVERED ||
    previousStatus === COVERAGE.CONTINUED;

  if (atPeriodStart && !wasInScheme) {
    return {
      status: COVERAGE.EXCLUDED,
      ceiling,
      coverageWage: forTest,
      contributionWage: forBase,
      continuedFrom: null,
      findings,
    };
  }

  findings.push(
    finding(
      FINDING.CEILING_CROSSED_MID_PERIOD,
      SEVERITY.INFORMATIONAL,
      `Wages of ₹${forTest.toFixed(2)} crossed the ₹${ceiling.toFixed(2)} ceiling during the contribution period. Coverage continues to the end of the period, and the contribution is computed on ₹${forBase.toFixed(2)} — the wages actually paid, not the ceiling.`,
      { coverageWage: forTest, ceiling, contributionWage: forBase },
    ),
  );

  return {
    status: COVERAGE.CONTINUED,
    ceiling,
    coverageWage: forTest,
    contributionWage: forBase,
    continuedFrom: monthStart,
    findings,
  };
}

/**
 * The contribution for one month.
 *
 * Two rounding rules that look like one. Regulation 40 rounds each share **up**
 * to the next rupee, and it does so separately — so the total is not four per
 * cent of anything and cannot be back-computed from it. Rounding the total
 * instead of the halves produces a figure that reconciles against neither.
 *
 * @param {object} input
 * @param {number} input.contributionWage
 * @param {number} [input.daysWorked]
 * @param {boolean} [input.disabled]
 * @param {number} [input.monthsSinceEngagement] for the disabled employer exemption
 * @param {object} [input.rules]
 * @returns {{employee: number, employer: number, total: number, findings: Array<object>}}
 */
function computeContribution(input) {
  const rules = resolveRules(input?.rules);
  const findings = [];

  const wage = Math.max(0, toNumber(input?.contributionWage));
  const daysWorked = Math.max(0, toNumber(input?.daysWorked));

  // Section 42(1). The floor is on the *daily average*, so it needs the days
  // and cannot be tested against the monthly wage.
  const dailyAverage = daysWorked > 0 ? wage / daysWorked : 0;
  const belowFloor = daysWorked > 0 && dailyAverage < rules.dailyWageFloor;

  let employee = belowFloor
    ? 0
    : Math.ceil((wage * rules.employeeRatePercent) / 100);

  let employer = Math.ceil((wage * rules.employerRatePercent) / 100);

  if (belowFloor) {
    findings.push(
      finding(
        FINDING.EMPLOYEE_EXEMPT_EMPLOYER_LIABLE,
        SEVERITY.INFORMATIONAL,
        `A daily average of ₹${round2(dailyAverage).toFixed(2)} is below the ₹${rules.dailyWageFloor} floor, so the employee contributes nothing. The employer's ${rules.employerRatePercent}% — ₹${employer} — is still payable.`,
        { dailyAverage: round2(dailyAverage), floor: rules.dailyWageFloor },
      ),
    );
  }

  // The 2008 amendment exempts the employer's share for three years from the
  // engagement of a person with a disability. The employee's share is not
  // exempted, so this is the mirror of section 42(1) and the two can both apply.
  if (
    input?.disabled &&
    Number.isFinite(Number(input?.monthsSinceEngagement)) &&
    Number(input.monthsSinceEngagement) < rules.disabledEmployerExemptionMonths
  ) {
    findings.push(
      finding(
        FINDING.DISABLED_EMPLOYER_EXEMPT,
        SEVERITY.INFORMATIONAL,
        `Month ${Number(input.monthsSinceEngagement) + 1} of the ${rules.disabledEmployerExemptionMonths}-month exemption from the employer's share for a newly engaged person with a disability. ₹${employer} is not payable.`,
        { monthsSinceEngagement: Number(input.monthsSinceEngagement) },
      ),
    );

    employer = 0;
  }

  return {
    employee,
    employer,
    total: employee + employer,
    dailyAverage: round2(dailyAverage),
    findings,
  };
}

/**
 * One employee across a whole contribution period.
 *
 * Walks the months in order, because each month's coverage depends on where the
 * period stands — which is exactly what a per-month computation cannot know.
 *
 * @param {object} input
 * @param {object} input.employee
 * @param {object} input.period
 * @param {Array<object>} input.months `{month, year, wages, daysWorked, employed}`
 * @param {object} [input.rules]
 * @returns {object}
 */
function assessEmployeePeriod(input) {
  const rules = resolveRules(input?.rules);
  const period = input?.period;
  const findings = [];

  let previous = input?.employee?.carriedForward || null;

  const months = [];
  let employeeTotal = 0;
  let employerTotal = 0;
  let qualifyingDays = 0;

  for (const row of input?.months || []) {
    const monthStart = new Date(Date.UTC(row.year, row.month - 1, 1));

    const coverage = decideCoverage({
      wages: row.wages,
      monthStart,
      period,
      previous,
      disabled: input?.employee?.disabled,
      employed: row.employed,
      rules,
    });

    findings.push(
      ...coverage.findings.map((entry) => ({
        ...entry,
        month: row.month,
        year: row.year,
      })),
    );

    const payable =
      coverage.status === COVERAGE.COVERED ||
      coverage.status === COVERAGE.CONTINUED;

    const contribution = payable
      ? computeContribution({
          contributionWage: coverage.contributionWage,
          daysWorked: row.daysWorked,
          disabled: input?.employee?.disabled,
          monthsSinceEngagement: row.monthsSinceEngagement,
          rules,
        })
      : { employee: 0, employer: 0, total: 0, dailyAverage: 0, findings: [] };

    findings.push(
      ...contribution.findings.map((entry) => ({
        ...entry,
        month: row.month,
        year: row.year,
      })),
    );

    employeeTotal += contribution.employee;
    employerTotal += contribution.employer;

    // Regulation 52A counts days for which contribution was *paid*, so a month
    // where the employee's share was nil under section 42(1) still counts —
    // a contribution was paid, by the employer.
    if (payable) qualifyingDays += Math.max(0, toNumber(row.daysWorked));

    months.push({
      month: row.month,
      year: row.year,
      status: coverage.status,
      coverageWage: coverage.coverageWage,
      contributionWage: payable ? coverage.contributionWage : 0,
      ceiling: coverage.ceiling,
      daysWorked: Math.max(0, toNumber(row.daysWorked)),
      employeeContribution: contribution.employee,
      employerContribution: contribution.employer,
      continuedFrom: coverage.continuedFrom,
    });

    previous = coverage;
  }

  const benefitPeriod = period ? benefitPeriodFor(period) : null;

  if (qualifyingDays > 0 && qualifyingDays < rules.benefitQualifyingDays) {
    findings.push(
      finding(
        FINDING.BELOW_QUALIFYING_DAYS,
        SEVERITY.INFORMATIONAL,
        `${qualifyingDays} contribution days in this period, against the ${rules.benefitQualifyingDays} needed for sickness benefit in ${benefitPeriod ? benefitPeriod.label : 'the corresponding benefit period'}.`,
        { qualifyingDays, required: rules.benefitQualifyingDays },
      ),
    );
  }

  return {
    employeeId: input?.employee?.employeeId || null,
    employeeName: input?.employee?.name || '',
    period,
    benefitPeriod,
    months,
    employeeTotal,
    employerTotal,
    total: employeeTotal + employerTotal,
    qualifyingDays,
    benefitEligible: qualifyingDays >= rules.benefitQualifyingDays,
    /**
     * The state the next period needs.
     *
     * Reset deliberately: the Rule 50 continuation does not survive a period
     * boundary, which is the entire point of the proviso.
     */
    carriedForward: {
      status:
        previous?.status === COVERAGE.CONTINUED
          ? COVERAGE.EXCLUDED
          : previous?.status || null,
      continuedFrom: null,
    },
    findings,
  };
}

/**
 * Section 39(5)(a) interest and Regulation 31C damages.
 *
 * Both, on the same delay. They are separate charges and paying one does not
 * discharge the other, so a function that returns a single "penalty" would be
 * understating it by whichever one it left out.
 *
 * @param {object} input
 * @param {number} input.amount the contribution not paid on time
 * @param {Date|string} input.dueOn
 * @param {Date|string} input.paidOn
 * @param {object} [input.rules]
 * @returns {{daysLate: number, interest: number, damages: number, band: string|null, total: number, findings: Array<object>}}
 */
function computeDelayCharges(input) {
  const rules = resolveRules(input?.rules);

  const amount = Math.max(0, toNumber(input?.amount));
  const dueOn = toDate(input?.dueOn);
  const paidOn = toDate(input?.paidOn);

  if (!dueOn || !paidOn || paidOn <= dueOn || amount === 0) {
    return {
      daysLate: 0,
      interest: 0,
      damages: 0,
      band: null,
      total: 0,
      findings: [],
    };
  }

  const daysLate = Math.round(
    (paidOn.getTime() - dueOn.getTime()) / MS_PER_DAY,
  );

  const interest = round2(
    (amount * rules.interestRatePercent * daysLate) / (100 * 365),
  );

  const band =
    DAMAGES_BANDS.find((entry) => daysLate < entry.upToDays) ||
    DAMAGES_BANDS[DAMAGES_BANDS.length - 1];

  // Damages are an annual rate applied over the period of delay, not a flat
  // percentage of the contribution — a five per cent band on a fortnight's
  // delay is not five per cent of the money.
  const damages = round2((amount * band.ratePercent * daysLate) / (100 * 365));

  return {
    daysLate,
    interest,
    damages,
    band: band.label,
    bandRatePercent: band.ratePercent,
    total: round2(interest + damages),
    findings: [
      finding(
        FINDING.LATE_REMITTANCE,
        SEVERITY.BREACH,
        `₹${amount.toFixed(2)} was remitted ${daysLate} day(s) after the due date. Interest under section 39(5)(a) is ₹${interest.toFixed(2)} and damages under Regulation 31C at the "${band.label}" band are ₹${damages.toFixed(2)}. Both are payable.`,
        { amount, daysLate, interest, damages, band: band.label },
      ),
    ],
  };
}

/**
 * The date a month's contribution falls due.
 *
 * @param {number} month
 * @param {number} year
 * @param {object} [rules]
 * @returns {Date}
 */
function dueDateFor(month, year, rules) {
  const resolved = resolveRules(rules);
  return new Date(Date.UTC(year, month, resolved.dueDayOfMonth));
}

/**
 * A whole establishment across a contribution period.
 *
 * @param {Array<object>} rows one per employee, in `assessEmployeePeriod` shape
 * @param {object} [options]
 * @param {object} [options.rules]
 * @param {number} [options.headcount]
 * @returns {object}
 */
function assessPeriod(rows, options = {}) {
  const rules = resolveRules(options.rules);

  const employees = (rows || []).map((row) =>
    assessEmployeePeriod({ ...row, rules }),
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

      if (!summary.has(entry.code)) {
        summary.set(entry.code, {
          code: entry.code,
          section: entry.section,
          severity: entry.severity,
          count: 0,
          employees: new Set(),
        });
      }

      const bucket = summary.get(entry.code);
      bucket.count += 1;
      if (employee.employeeId)
        bucket.employees.add(String(employee.employeeId));
    }
  }

  const headcount = toNumber(options.headcount) || employees.length;

  if (headcount > 0 && headcount < rules.applicabilityHeadcount) {
    findings.unshift(
      finding(
        FINDING.NOT_APPLICABLE,
        SEVERITY.INFORMATIONAL,
        `The establishment employs ${headcount}. The Act applies at ${rules.applicabilityHeadcount} or more, so these figures are what would be payable rather than what is.`,
        { headcount, threshold: rules.applicabilityHeadcount },
      ),
    );
  }

  const continued = employees.filter((employee) =>
    employee.months.some((month) => month.status === COVERAGE.CONTINUED),
  );

  return {
    period: employees[0]?.period || null,
    benefitPeriod: employees[0]?.benefitPeriod || null,
    employeeCount: employees.length,
    coveredCount: employees.filter((employee) =>
      employee.months.some(
        (month) =>
          month.status === COVERAGE.COVERED ||
          month.status === COVERAGE.CONTINUED,
      ),
    ).length,
    continuedCount: continued.length,
    benefitEligibleCount: employees.filter(
      (employee) => employee.benefitEligible,
    ).length,
    employeeTotal: round2(
      employees.reduce((sum, employee) => sum + employee.employeeTotal, 0),
    ),
    employerTotal: round2(
      employees.reduce((sum, employee) => sum + employee.employerTotal, 0),
    ),
    total: round2(employees.reduce((sum, employee) => sum + employee.total, 0)),
    applicable: headcount >= rules.applicabilityHeadcount,
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
  ESI_RULES,
  DAMAGES_BANDS,
  COVERAGE,
  FINDING,
  FINDING_SECTION,
  SEVERITY,
  resolveRules,
  contributionPeriodFor,
  benefitPeriodFor,
  coverageWage,
  contributionWage,
  decideCoverage,
  computeContribution,
  assessEmployeePeriod,
  computeDelayCharges,
  dueDateFor,
  assessPeriod,
};
