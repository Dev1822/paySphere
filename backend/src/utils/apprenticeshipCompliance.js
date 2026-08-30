/**
 * Apprentices Act, 1961 (#1771).
 *
 * The difficulty is not that an apprentice is a cheaper employee. It is that
 * under section 18 an apprentice is **not a worker**, and the consequence is
 * that the same individual counts for one statute and is invisible to the next:
 *
 *   section 8 engagement band (2.5–15%)  counted — and so is every contract worker
 *   provident fund                       no
 *   ESI                                  no
 *   Payment of Bonus Act                 no
 *   gratuity, continuous service         no
 *   Factories Act hours and safety       yes, by section 15
 *
 * Every headcount in the product is a single number. `complianceAggregator.js`
 * counts employees, `statutoryBonus.js` counts eligible employees,
 * `contractLabour.js` counts deployed workers, and each of them would be wrong
 * about apprentices in a different direction. So this module never returns a
 * bare headcount: `strengthFor` takes the statute as an argument, and there is
 * no way to call it without saying which convention you are under.
 *
 * The obligation with teeth is registration. An apprenticeship contract not
 * registered on the portal within thirty days is not an apprenticeship — the
 * individual was an ordinary employee for that period, and the provident fund,
 * ESI, bonus and gratuity that section 18 excluded become payable
 * retrospectively. The exposure is exactly the size of the exclusions taken.
 *
 * Pure functions, no database access.
 */

const MONTHS_PER_YEAR = 12;

/**
 * The notified figures, as the default rule set.
 *
 * A rule set because all of them move: the applicability threshold went from
 * forty workers to thirty, the band's floor was set by the 2019 amendment to the
 * rules, and the Rule 11 stipends were last revised in 2019.
 */
const APPRENTICESHIP_RULES = {
  /** Section 8 with Rule 7A — the establishment size the obligation starts at. */
  applicabilityHeadcount: 30,
  /** Rule 7A — the floor, as a percentage of total strength. */
  bandFloorPercent: 2.5,
  /** Rule 7A — and the ceiling. */
  bandCeilingPercent: 15,
  /** Rule 7A — of which this much must be freshers or certificate holders. */
  fresherSubQuotaPercent: 5,
  /** Section 4(4) with the rules — registration window, in days. */
  registrationWindowDays: 30,
  /** Rule 11 — second-year uplift on the *first-year* prescribed rate. */
  secondYearUpliftPercent: 10,
  /** Rule 11 — and the third-year uplift, also on the first-year rate. */
  thirdYearUpliftPercent: 15,
  /** NAPS — the share of the stipend reimbursed. */
  napsReimbursementPercent: 25,
  /** NAPS — capped at this a month. */
  napsMonthlyCeiling: 1500,
  /** NAPS — and payable only where attendance reached this. */
  napsMinimumAttendanceDays: 15,
  /**
   * Rule 11 — the prescribed first-year stipends, by qualification.
   *
   * In the rule set rather than only as a module constant, because the Rule 11
   * table is revised by notification and an establishment assessed for an
   * earlier year needs the figures that were in force then.
   */
  prescribedStipends: null,
};

/**
 * Rule 11 — the prescribed minimum first-year stipend, by qualification.
 *
 * First-year only. The second and third years are computed from these figures
 * rather than from whatever was actually paid, so an employer who paid above the
 * minimum does not owe an escalation on its own generosity.
 */
const PRESCRIBED_STIPEND = {
  SCHOOL_5_TO_9: 5000,
  SCHOOL_10: 6000,
  SCHOOL_12: 7000,
  NATIONAL_OR_STATE_TRADE_CERTIFICATE: 7000,
  DIPLOMA: 8000,
  DEGREE: 9000,
};

const QUALIFICATION_LABEL = {
  SCHOOL_5_TO_9: 'School pass, class 5 to 9',
  SCHOOL_10: 'School pass, class 10',
  SCHOOL_12: 'School pass, class 12',
  NATIONAL_OR_STATE_TRADE_CERTIFICATE: 'National or State Trade Certificate',
  DIPLOMA: 'Diploma',
  DEGREE: 'Degree',
};

/**
 * Which statute a headcount is being taken for.
 *
 * The whole reason `strengthFor` exists. There is no default: a caller has to
 * say which convention it is under, because the two answers differ by the number
 * of apprentices and the failure is otherwise silent — a bonus calculation that
 * quietly includes them produces a plausible number that is simply too large.
 */
const STATUTE = {
  /** Section 8 — direct, contract and casual workers, apprentices included. */
  APPRENTICES_ACT: 'APPRENTICES_ACT',
  /** Apprentices excluded by section 18. */
  PROVIDENT_FUND: 'PROVIDENT_FUND',
  ESI: 'ESI',
  BONUS: 'BONUS',
  GRATUITY: 'GRATUITY',
  /** Section 15 — apprentices included. */
  FACTORIES_ACT: 'FACTORIES_ACT',
};

/** Which statutes count an apprentice, and which do not. */
const COUNTS_APPRENTICES = {
  [STATUTE.APPRENTICES_ACT]: true,
  [STATUTE.PROVIDENT_FUND]: false,
  [STATUTE.ESI]: false,
  [STATUTE.BONUS]: false,
  [STATUTE.GRATUITY]: false,
  [STATUTE.FACTORIES_ACT]: true,
};

/** And which count contract labour, which section 8 does and PF does not. */
const COUNTS_CONTRACT = {
  [STATUTE.APPRENTICES_ACT]: true,
  [STATUTE.PROVIDENT_FUND]: false,
  [STATUTE.ESI]: false,
  [STATUTE.BONUS]: false,
  [STATUTE.GRATUITY]: false,
  [STATUTE.FACTORIES_ACT]: true,
};

const REGISTRATION = {
  REGISTERED: 'REGISTERED',
  /** Inside the thirty days and not yet registered. Not a breach yet. */
  PENDING: 'PENDING',
  /** Past the window. The person was an employee for the period. */
  LAPSED: 'LAPSED',
};

const FINDING = {
  BELOW_BAND_FLOOR: 'BELOW_BAND_FLOOR',
  ABOVE_BAND_CEILING: 'ABOVE_BAND_CEILING',
  FRESHER_SUB_QUOTA_UNMET: 'FRESHER_SUB_QUOTA_UNMET',
  STIPEND_BELOW_PRESCRIBED: 'STIPEND_BELOW_PRESCRIBED',
  REGISTRATION_LAPSED: 'REGISTRATION_LAPSED',
  REGISTRATION_PENDING: 'REGISTRATION_PENDING',
  NAPS_ATTENDANCE_UNMET: 'NAPS_ATTENDANCE_UNMET',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  HOLIDAY_DEDUCTED: 'HOLIDAY_DEDUCTED',
};

const FINDING_SECTION = {
  [FINDING.BELOW_BAND_FLOOR]: 'section 8 with Rule 7A',
  [FINDING.ABOVE_BAND_CEILING]: 'section 8 with Rule 7A',
  [FINDING.FRESHER_SUB_QUOTA_UNMET]: 'Rule 7A(2)',
  [FINDING.STIPEND_BELOW_PRESCRIBED]: 'section 13 with Rule 11',
  [FINDING.REGISTRATION_LAPSED]: 'section 4(4)',
  [FINDING.REGISTRATION_PENDING]: 'section 4(4)',
  [FINDING.NAPS_ATTENDANCE_UNMET]: 'NAPS guidelines',
  [FINDING.NOT_APPLICABLE]: 'section 1(4) with Rule 7A',
  [FINDING.HOLIDAY_DEDUCTED]: 'section 15 with Rule 12',
};

const SEVERITY = {
  BREACH: 'BREACH',
  EXPOSURE: 'EXPOSURE',
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
  const merged = { ...APPRENTICESHIP_RULES, ...(rules || {}) };

  // A stored rule set that carries no stipend table falls back to Rule 11's,
  // rather than to `null` — which would make every prescribed stipend zero and
  // every shortfall disappear.
  if (!merged.prescribedStipends) {
    merged.prescribedStipends = { ...PRESCRIBED_STIPEND };
  }

  return merged;
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
 * The headcount, for a named statute.
 *
 * The statute is a required argument and there is deliberately no default. Two
 * callers wanting "the headcount" want different numbers, and the one that gets
 * the wrong one produces a plausible figure rather than an error — which is the
 * failure mode this signature exists to make impossible.
 *
 * @param {object} composition
 * @param {number} composition.directEmployees
 * @param {number} [composition.contractWorkers]
 * @param {number} [composition.casualWorkers]
 * @param {number} [composition.apprentices]
 * @param {string} statute a STATUTE
 * @returns {number}
 */
function strengthFor(composition, statute) {
  if (!Object.hasOwn(COUNTS_APPRENTICES, statute)) {
    throw new TypeError(
      `strengthFor needs a statute; "${statute}" is not one of ${Object.keys(COUNTS_APPRENTICES).join(', ')}`,
    );
  }

  const direct = Math.max(0, toNumber(composition?.directEmployees));
  const contract = Math.max(0, toNumber(composition?.contractWorkers));
  const casual = Math.max(0, toNumber(composition?.casualWorkers));
  const apprentices = Math.max(0, toNumber(composition?.apprentices));

  return (
    direct +
    (COUNTS_CONTRACT[statute] ? contract + casual : 0) +
    (COUNTS_APPRENTICES[statute] ? apprentices : 0)
  );
}

/**
 * Section 8 with Rule 7A — the engagement band.
 *
 * A floor **and** a ceiling. Engaging too few is a default under section 30 and
 * engaging too many is not a way to cure it, which is why this reports both
 * directions rather than only a shortfall.
 *
 * The base is total strength including contract and casual workers — not the
 * payroll headcount, which is the number every other part of the product has.
 *
 * @param {object} composition
 * @param {object} [rules]
 * @returns {object}
 */
function evaluateBand(composition, rules) {
  const resolved = resolveRules(rules);
  const findings = [];

  const totalStrength = strengthFor(composition, STATUTE.APPRENTICES_ACT);
  const apprentices = Math.max(0, toNumber(composition?.apprentices));
  const freshers = Math.max(0, toNumber(composition?.fresherApprentices));

  if (totalStrength < resolved.applicabilityHeadcount) {
    findings.push(
      finding(
        FINDING.NOT_APPLICABLE,
        SEVERITY.INFORMATIONAL,
        `Total strength is ${totalStrength}. The obligation to engage apprentices starts at ${resolved.applicabilityHeadcount}.`,
        { totalStrength, threshold: resolved.applicabilityHeadcount },
      ),
    );

    return {
      applicable: false,
      totalStrength,
      apprentices,
      floor: 0,
      ceiling: 0,
      shortfall: 0,
      excess: 0,
      findings,
    };
  }

  // The floor rounds *up*: 2.5% of 41 is 1.025, and one apprentice does not
  // discharge it. The ceiling rounds down for the mirror reason.
  const floor = Math.ceil((totalStrength * resolved.bandFloorPercent) / 100);
  const ceiling = Math.floor(
    (totalStrength * resolved.bandCeilingPercent) / 100,
  );

  const shortfall = Math.max(0, floor - apprentices);
  const excess = Math.max(0, apprentices - ceiling);

  if (shortfall > 0) {
    findings.push(
      finding(
        FINDING.BELOW_BAND_FLOOR,
        SEVERITY.BREACH,
        `${apprentices} apprentice(s) against a floor of ${floor} — ${resolved.bandFloorPercent}% of a total strength of ${totalStrength}. ${shortfall} more must be engaged.`,
        { apprentices, floor, shortfall, totalStrength },
      ),
    );
  }

  if (excess > 0) {
    findings.push(
      finding(
        FINDING.ABOVE_BAND_CEILING,
        SEVERITY.BREACH,
        `${apprentices} apprentice(s) against a ceiling of ${ceiling} — ${resolved.bandCeilingPercent}% of a total strength of ${totalStrength}. Engaging beyond the ceiling is a breach in its own right, not a way to make up an earlier shortfall.`,
        { apprentices, ceiling, excess, totalStrength },
      ),
    );
  }

  const fresherFloor = Math.ceil(
    (totalStrength * resolved.fresherSubQuotaPercent) / 100,
  );

  // The sub-quota is a share of total strength, so it can exceed the number of
  // apprentices actually required — which is the point: it says what *kind* of
  // apprentice, and an establishment meeting the floor entirely with
  // certificate-exempt candidates has not met it.
  if (apprentices > 0 && freshers < Math.min(fresherFloor, apprentices)) {
    findings.push(
      finding(
        FINDING.FRESHER_SUB_QUOTA_UNMET,
        SEVERITY.BREACH,
        `${freshers} fresher or skill-certificate apprentice(s), against ${Math.min(fresherFloor, apprentices)} required — ${resolved.fresherSubQuotaPercent}% of total strength, capped at the number engaged.`,
        { freshers, required: Math.min(fresherFloor, apprentices) },
      ),
    );
  }

  return {
    applicable: true,
    totalStrength,
    apprentices,
    freshers,
    floor,
    ceiling,
    fresherFloor: Math.min(fresherFloor, apprentices),
    shortfall,
    excess,
    withinBand: shortfall === 0 && excess === 0,
    findings,
  };
}

/**
 * Rule 11 — the prescribed stipend for a qualification and year.
 *
 * The uplift is computed on the **prescribed first-year rate**, not on what was
 * actually paid. An employer paying ₹12,000 to a class-10 apprentice in year one
 * owes ₹6,600 in year two, not ₹13,200 — the escalation is on the statutory
 * minimum and generosity does not compound.
 *
 * @param {string} qualification
 * @param {number} year 1, 2 or 3
 * @param {object} [rules]
 * @returns {{prescribed: number, firstYear: number, upliftPercent: number}}
 */
function prescribedStipend(qualification, year, rules) {
  const resolved = resolveRules(rules);

  const table = resolved.prescribedStipends || PRESCRIBED_STIPEND;
  const firstYear = Number(table[qualification]) || 0;
  const which = Math.max(1, Math.min(3, Math.floor(toNumber(year)) || 1));

  const upliftPercent =
    which === 2
      ? resolved.secondYearUpliftPercent
      : which === 3
        ? resolved.thirdYearUpliftPercent
        : 0;

  return {
    prescribed: round2(firstYear * (1 + upliftPercent / 100)),
    firstYear,
    upliftPercent,
    year: which,
  };
}

/**
 * The stipend payable for one apprentice-month.
 *
 * Prorated on attendance, and holidays and authorised leave are **not** absences
 * — which is the opposite convention from the loss-of-pay arithmetic in
 * `salaryCalculator.js`, so a caller that reused that would under-pay.
 *
 * @param {object} input
 * @param {string} input.qualification
 * @param {number} input.year
 * @param {number} input.actualStipend what was paid, monthly
 * @param {number} input.workingDays days in the month
 * @param {number} input.daysAttended
 * @param {number} [input.holidays] not absences
 * @param {number} [input.authorisedLeaveDays] not absences either
 * @param {object} [input.rules]
 * @returns {object}
 */
function monthlyStipend(input) {
  const rules = resolveRules(input?.rules);
  const findings = [];

  const scale = prescribedStipend(input?.qualification, input?.year, rules);

  const workingDays = Math.max(1, toNumber(input?.workingDays));
  const attended = Math.max(0, toNumber(input?.daysAttended));
  const holidays = Math.max(0, toNumber(input?.holidays));
  const authorised = Math.max(0, toNumber(input?.authorisedLeaveDays));

  // Days that count as served: attended, plus holidays, plus authorised leave.
  const credited = Math.min(workingDays, attended + holidays + authorised);
  const proportion = credited / workingDays;

  const prescribedForMonth = round2(scale.prescribed * proportion);
  const actual = round2(Math.max(0, toNumber(input?.actualStipend)));
  const actualForMonth = round2(actual * proportion);

  const shortfall = round2(Math.max(0, prescribedForMonth - actualForMonth));

  if (shortfall > 0.01) {
    findings.push(
      finding(
        FINDING.STIPEND_BELOW_PRESCRIBED,
        SEVERITY.BREACH,
        `₹${actualForMonth.toFixed(2)} paid against a prescribed ₹${prescribedForMonth.toFixed(2)} — the ₹${scale.firstYear} first-year rate for ${QUALIFICATION_LABEL[input?.qualification] || 'this qualification'}${scale.upliftPercent > 0 ? ` uplifted ${scale.upliftPercent}% for year ${scale.year}` : ''}, over ${credited} of ${workingDays} days. ₹${shortfall.toFixed(2)} is owed.`,
        {
          paid: actualForMonth,
          prescribed: prescribedForMonth,
          shortfall,
        },
      ),
    );
  }

  return {
    qualification: input?.qualification,
    year: scale.year,
    prescribedFullMonth: scale.prescribed,
    prescribed: prescribedForMonth,
    paid: actualForMonth,
    shortfall,
    creditedDays: credited,
    workingDays,
    findings,
  };
}

/**
 * NAPS reimbursement for one apprentice-month.
 *
 * A receivable, not a reduction in the stipend. Treating it as a reduction
 * would mean the apprentice was paid less than the prescribed minimum, which is
 * a breach of section 13 whatever the government later refunds.
 *
 * @param {object} input
 * @param {number} input.stipendPaid
 * @param {number} input.daysAttended
 * @param {string} input.registrationStatus
 * @param {object} [input.rules]
 * @returns {{amount: number, capped: boolean, findings: Array<object>}}
 */
function napsReimbursement(input) {
  const rules = resolveRules(input?.rules);
  const findings = [];

  // Only a registered contract is claimable. A pending one may become so and a
  // lapsed one never will, but neither is claimable now.
  if (input?.registrationStatus !== REGISTRATION.REGISTERED) {
    return { amount: 0, capped: false, findings };
  }

  const attended = Math.max(0, toNumber(input?.daysAttended));

  if (attended < rules.napsMinimumAttendanceDays) {
    findings.push(
      finding(
        FINDING.NAPS_ATTENDANCE_UNMET,
        SEVERITY.INFORMATIONAL,
        `${attended} day(s) attended, against the ${rules.napsMinimumAttendanceDays} needed to claim reimbursement for the month.`,
        { daysAttended: attended },
      ),
    );

    return { amount: 0, capped: false, findings };
  }

  const share = round2(
    (Math.max(0, toNumber(input?.stipendPaid)) *
      rules.napsReimbursementPercent) /
      100,
  );

  const amount = Math.min(share, rules.napsMonthlyCeiling);

  return {
    amount: round2(amount),
    capped: share > rules.napsMonthlyCeiling,
    findings,
  };
}

/**
 * Where a contract stands against the thirty-day window.
 *
 * @param {object} input
 * @param {Date|string} input.engagedOn
 * @param {Date|string} [input.registeredOn]
 * @param {Date|string} [input.asAt]
 * @param {object} [input.rules]
 * @returns {{status: string, dueBy: Date|null, daysLate: number}}
 */
function registrationStatus(input) {
  const rules = resolveRules(input?.rules);

  const engagedOn = toDate(input?.engagedOn);
  if (!engagedOn)
    return { status: REGISTRATION.PENDING, dueBy: null, daysLate: 0 };

  const dueBy = new Date(
    engagedOn.getTime() + rules.registrationWindowDays * 86400000,
  );

  const registeredOn = toDate(input?.registeredOn);

  if (registeredOn) {
    // Registered late is still registered. The Act's remedy for lateness is the
    // section 30 penalty, not a retrospective loss of apprentice status, so a
    // contract registered on day forty is REGISTERED and not LAPSED.
    return {
      status: REGISTRATION.REGISTERED,
      dueBy,
      daysLate: Math.max(
        0,
        Math.round((registeredOn.getTime() - dueBy.getTime()) / 86400000),
      ),
    };
  }

  const asAt = toDate(input?.asAt) || new Date();

  if (asAt.getTime() <= dueBy.getTime()) {
    return { status: REGISTRATION.PENDING, dueBy, daysLate: 0 };
  }

  return {
    status: REGISTRATION.LAPSED,
    dueBy,
    daysLate: Math.round((asAt.getTime() - dueBy.getTime()) / 86400000),
  };
}

/**
 * What an unregistered contract exposes the establishment to.
 *
 * The point of the module. If the contract is not an apprenticeship, the person
 * was an ordinary employee for the period — so the exposure is exactly the
 * exclusions section 18 allowed the establishment to take, and no more.
 *
 * Computed on the stipend actually paid, because that is what the wages were.
 *
 * @param {object} input
 * @param {number} input.stipendPaidInPeriod
 * @param {number} input.months
 * @param {object} [input.rates] contribution rates, defaulted to the statutory ones
 * @returns {object}
 */
function unregisteredExposure(input) {
  const stipend = Math.max(0, toNumber(input?.stipendPaidInPeriod));
  const months = Math.max(0, toNumber(input?.months));
  const monthly = months > 0 ? stipend / months : 0;

  const rates = {
    // Employer's share only. The employee's halves would have been withheld
    // from the stipend and were not, so recovering them now is a separate and
    // much harder question — and one the Act does not answer.
    providentFundPercent: 12,
    esiPercent: 3.25,
    // Section 10 of the Payment of Bonus Act. The minimum, since an apprentice
    // treated as an employee would have been eligible for at least that.
    bonusPercent: 8.33,
    ...(input?.rates || {}),
  };

  const providentFund = round2((stipend * rates.providentFundPercent) / 100);
  const esi = round2((stipend * rates.esiPercent) / 100);
  const bonus = round2((stipend * rates.bonusPercent) / 100);

  // Gratuity accrues only past five years of continuous service, so a period
  // shorter than that carries no gratuity exposure — reported as zero with the
  // reason, rather than omitted, because "no gratuity" and "gratuity not
  // computed" are different answers to an auditor.
  const gratuityApplies = months >= 60;
  const gratuity = gratuityApplies
    ? round2(((15 * monthly) / 26) * Math.floor(months / MONTHS_PER_YEAR))
    : 0;

  return {
    months,
    stipendPaidInPeriod: round2(stipend),
    providentFund,
    esi,
    bonus,
    gratuity,
    gratuityApplies,
    total: round2(providentFund + esi + bonus + gratuity),
  };
}

/**
 * One apprentice across a period.
 *
 * @param {object} input
 * @param {object} input.apprentice
 * @param {Array<object>} input.months
 * @param {Date|string} [input.asAt]
 * @param {object} [input.rules]
 * @returns {object}
 */
function assessApprentice(input) {
  const rules = resolveRules(input?.rules);
  const apprentice = input?.apprentice || {};
  const findings = [];

  const registration = registrationStatus({
    engagedOn: apprentice.engagedOn,
    registeredOn: apprentice.registeredOn,
    asAt: input?.asAt,
    rules,
  });

  if (registration.status === REGISTRATION.PENDING) {
    findings.push(
      finding(
        FINDING.REGISTRATION_PENDING,
        SEVERITY.INFORMATIONAL,
        `Not yet registered. The contract must be registered on the portal by ${registration.dueBy.toISOString().slice(0, 10)}.`,
        { dueBy: registration.dueBy },
      ),
    );
  }

  const months = [];
  let stipendPaid = 0;
  let stipendShortfall = 0;
  let reimbursement = 0;

  for (const row of input?.months || []) {
    const stipend = monthlyStipend({
      qualification: apprentice.qualification,
      year: row.year ?? apprentice.currentYear,
      actualStipend: row.stipendPaid,
      workingDays: row.workingDays,
      daysAttended: row.daysAttended,
      holidays: row.holidays,
      authorisedLeaveDays: row.authorisedLeaveDays,
      rules,
    });

    findings.push(
      ...stipend.findings.map((entry) => ({
        ...entry,
        month: row.month,
        calendarYear: row.calendarYear,
      })),
    );

    const naps = napsReimbursement({
      stipendPaid: stipend.paid,
      daysAttended: row.daysAttended,
      registrationStatus: registration.status,
      rules,
    });

    findings.push(
      ...naps.findings.map((entry) => ({
        ...entry,
        month: row.month,
        calendarYear: row.calendarYear,
      })),
    );

    stipendPaid = round2(stipendPaid + stipend.paid);
    stipendShortfall = round2(stipendShortfall + stipend.shortfall);
    reimbursement = round2(reimbursement + naps.amount);

    months.push({
      month: row.month,
      calendarYear: row.calendarYear,
      apprenticeshipYear: stipend.year,
      prescribed: stipend.prescribed,
      paid: stipend.paid,
      shortfall: stipend.shortfall,
      creditedDays: stipend.creditedDays,
      workingDays: stipend.workingDays,
      reimbursement: naps.amount,
      reimbursementCapped: naps.capped,
    });
  }

  let exposure = null;

  if (registration.status === REGISTRATION.LAPSED) {
    exposure = unregisteredExposure({
      stipendPaidInPeriod: stipendPaid,
      months: months.length,
      rates: input?.exposureRates,
    });

    findings.push(
      finding(
        FINDING.REGISTRATION_LAPSED,
        SEVERITY.EXPOSURE,
        `The contract was not registered within ${rules.registrationWindowDays} days and is ${registration.daysLate} day(s) past the window. For this period the person was an ordinary employee, exposing ₹${exposure.total.toFixed(2)} of provident fund, ESI, bonus and gratuity that section 18 excluded.`,
        {
          daysLate: registration.daysLate,
          exposure: exposure.total,
          providentFund: exposure.providentFund,
          esi: exposure.esi,
          bonus: exposure.bonus,
          gratuity: exposure.gratuity,
        },
      ),
    );
  }

  return {
    apprenticeId: apprentice.apprenticeId || null,
    name: apprentice.name || '',
    qualification: apprentice.qualification,
    qualificationLabel: QUALIFICATION_LABEL[apprentice.qualification] || '',
    isFresher: Boolean(apprentice.isFresher),
    registration,
    months,
    stipendPaid,
    stipendShortfall,
    reimbursement,
    exposure,
    findings,
  };
}

/**
 * The establishment.
 *
 * @param {object} input
 * @param {object} input.composition
 * @param {Array<object>} input.apprentices each in `assessApprentice` shape
 * @param {Date|string} [input.asAt]
 * @param {object} [input.rules]
 * @returns {object}
 */
function assessEstablishment(input) {
  const rules = resolveRules(input?.rules);

  const apprentices = (input?.apprentices || []).map((row) =>
    assessApprentice({ ...row, asAt: input?.asAt, rules }),
  );

  // The composition's apprentice count is derived from the list rather than
  // taken from the caller, so the band cannot be evaluated against a number that
  // disagrees with the roll it is standing next to.
  const composition = {
    ...(input?.composition || {}),
    apprentices: apprentices.length,
    fresherApprentices: apprentices.filter((entry) => entry.isFresher).length,
  };

  const band = evaluateBand(composition, rules);

  const findings = [...band.findings];
  const summary = new Map();

  for (const entry of band.findings) {
    if (!summary.has(entry.code)) {
      summary.set(entry.code, {
        code: entry.code,
        section: entry.section,
        severity: entry.severity,
        count: 0,
        apprentices: new Set(),
      });
    }
    summary.get(entry.code).count += 1;
  }

  for (const apprentice of apprentices) {
    for (const entry of apprentice.findings) {
      findings.push({
        ...entry,
        apprenticeId: apprentice.apprenticeId,
        apprenticeName: apprentice.name,
      });

      if (!summary.has(entry.code)) {
        summary.set(entry.code, {
          code: entry.code,
          section: entry.section,
          severity: entry.severity,
          count: 0,
          apprentices: new Set(),
        });
      }

      const bucket = summary.get(entry.code);
      bucket.count += 1;
      if (apprentice.apprenticeId) {
        bucket.apprentices.add(String(apprentice.apprenticeId));
      }
    }
  }

  return {
    band,
    /**
     * The same establishment counted under each statute, side by side.
     *
     * Returned together rather than as one number, because the point of the
     * module is that they differ and a caller that saw only one would not know
     * which convention it had.
     */
    strength: Object.fromEntries(
      Object.values(STATUTE).map((statute) => [
        statute,
        strengthFor(composition, statute),
      ]),
    ),
    apprenticeCount: apprentices.length,
    registeredCount: apprentices.filter(
      (entry) => entry.registration.status === REGISTRATION.REGISTERED,
    ).length,
    lapsedCount: apprentices.filter(
      (entry) => entry.registration.status === REGISTRATION.LAPSED,
    ).length,
    stipendPaid: round2(
      apprentices.reduce((sum, entry) => sum + entry.stipendPaid, 0),
    ),
    stipendShortfall: round2(
      apprentices.reduce((sum, entry) => sum + entry.stipendShortfall, 0),
    ),
    reimbursementReceivable: round2(
      apprentices.reduce((sum, entry) => sum + entry.reimbursement, 0),
    ),
    exposure: round2(
      apprentices.reduce((sum, entry) => sum + (entry.exposure?.total || 0), 0),
    ),
    findings,
    summary: [...summary.values()].map((bucket) => ({
      code: bucket.code,
      section: bucket.section,
      severity: bucket.severity,
      count: bucket.count,
      apprenticeCount: bucket.apprentices.size,
    })),
    apprentices,
  };
}

module.exports = {
  APPRENTICESHIP_RULES,
  PRESCRIBED_STIPEND,
  QUALIFICATION_LABEL,
  STATUTE,
  COUNTS_APPRENTICES,
  REGISTRATION,
  FINDING,
  FINDING_SECTION,
  SEVERITY,
  resolveRules,
  strengthFor,
  evaluateBand,
  prescribedStipend,
  monthlyStipend,
  napsReimbursement,
  registrationStatus,
  unregisteredExposure,
  assessApprentice,
  assessEstablishment,
};
