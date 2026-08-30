/**
 * EPF International Workers — paragraph 83 and the Social Security Agreements
 * (#1971).
 *
 * `ecrGenerator.utils.js` builds the ECR, `epsPension.js` (#1769) computes the
 * pension and `epfBelatedRemittance.js` (#1875) computes section 7Q interest and
 * section 14B damages on a late remittance. All three assume the ₹15,000
 * statutory wage ceiling, which is right for every domestic employee and wrong
 * for an International Worker by roughly a factor of forty.
 *
 * Four things shape everything below.
 *
 * **Paragraph 83 has no wage ceiling.** An International Worker contributes on
 * the **full monthly pay**, including the portion paid outside India and the
 * portion paid in a foreign currency. An expatriate on ₹6,00,000 a month
 * attracts ₹72,000 of contribution and not ₹1,800. `contributionBasis` returns
 * the figure the domestic ceiling *would* have produced alongside the one
 * actually due, because a difference that large has to be visibly intended
 * rather than silently absent — and because an under-remittance found here is
 * what #1875 then charges interest and damages on.
 *
 * **"International Worker" is a definition, not a nationality field.** It
 * reaches a foreign national working in India *and* an Indian employee who has
 * worked or is going to work in a country India has an SSA with. The second limb
 * is the one that gets missed: an Indian citizen on deputation to Germany is an
 * International Worker, and #1348's assignment module already records that
 * deputation. `determineStatus` therefore takes a limb and a ground rather than
 * a passport.
 *
 * **A Certificate of Coverage detaches the worker, and it expires.** A worker
 * holding a valid COC remains covered at home and is an *excluded employee*
 * here for as long as it runs. The day it expires they attach to Indian PF at
 * full pay with no ceiling, and nothing in a payroll system notices a date
 * passing on a scanned PDF. `certificatePosition` counts down rather than
 * reporting a date, because the only useful time to raise this is before the
 * certificate lapses.
 *
 * **Withdrawal is on a different footing.** A domestic member may withdraw after
 * two months' unemployment. An International Worker may not: retirement at 58,
 * permanent and total incapacity, or a route an SSA gives — and nothing else. A
 * self-service portal that offers a withdrawal to every member offers this one
 * something that will be refused.
 *
 * Pure functions, no database access, matching how `epsPension.js` and
 * `esiContribution.js` are written.
 */

const IW_RULES = {
  /**
   * The domestic statutory wage ceiling.
   *
   * Held here **only** so that the module can report what it would have
   * produced. It is never applied to an International Worker. See
   * `contributionBasis`.
   */
  domesticWageCeiling: 15000,

  /** Employee and employer shares, as fractions of the contribution basis. */
  employeeRate: 0.12,
  employerRate: 0.12,

  /** Of the employer's share, the part that goes to the pension fund. */
  employerPensionRate: 0.0833,

  /** Withdrawal on retirement. */
  retirementAge: 58,

  /**
   * How far ahead a Certificate of Coverage is raised before it lapses.
   *
   * Ninety days rather than thirty: extending a COC is an application to a
   * foreign social security authority, and thirty days is not enough time to
   * make one.
   */
  certificateNoticeDays: 90,

  /** EPS eligibility for a domestic member. */
  pensionEligibleYears: 10,

  /** IW-1 is a monthly return. Days after the month end that it is due. */
  iwOneDueDays: 15,
};

/**
 * The two limbs of the paragraph 83 definition.
 *
 * Two rather than one because they behave differently downstream: only the
 * second can hold a COC issued by the other country, and only the first can be
 * an excluded employee by holding one.
 */
const LIMB = {
  /** A foreign national working in India for a covered establishment. */
  FOREIGN_NATIONAL_IN_INDIA: 'FOREIGN_NATIONAL_IN_INDIA',
  /** An Indian employee working, or going to work, in an SSA country. */
  INDIAN_IN_SSA_COUNTRY: 'INDIAN_IN_SSA_COUNTRY',
};

const STATUS = {
  /** An International Worker, contributing on full pay with no ceiling. */
  INTERNATIONAL_WORKER: 'INTERNATIONAL_WORKER',
  /** An International Worker detached by a valid Certificate of Coverage. */
  EXCLUDED_BY_CERTIFICATE: 'EXCLUDED_BY_CERTIFICATE',
  /** Not within paragraph 83. The domestic rules apply. */
  DOMESTIC: 'DOMESTIC',
  /** Nobody has determined which. A question, not an answer. */
  UNDETERMINED: 'UNDETERMINED',
};

/**
 * The countries India has a Social Security Agreement with, and what each
 * agreement actually provides.
 *
 * The three flags are not the same thing and are commonly conflated.
 * `detachment` is what makes a COC possible at all; `totalisation` is what lets
 * service in both countries count towards *eligibility*; `exportOfPension` is
 * what lets a pension be paid into a foreign account after the member leaves.
 * An agreement can give one and not the others.
 */
const SSA_COUNTRIES = {
  DE: {
    code: 'DE',
    label: 'Germany',
    detachment: true,
    totalisation: true,
    exportOfPension: true,
  },
  BE: {
    code: 'BE',
    label: 'Belgium',
    detachment: true,
    totalisation: true,
    exportOfPension: true,
  },
  CH: {
    code: 'CH',
    label: 'Switzerland',
    detachment: true,
    totalisation: true,
    exportOfPension: true,
  },
  NL: {
    code: 'NL',
    label: 'Netherlands',
    detachment: true,
    totalisation: true,
    exportOfPension: true,
  },
  FR: {
    code: 'FR',
    label: 'France',
    detachment: true,
    totalisation: true,
    exportOfPension: true,
  },
  DK: {
    code: 'DK',
    label: 'Denmark',
    detachment: true,
    totalisation: true,
    exportOfPension: true,
  },
  KR: {
    code: 'KR',
    label: 'South Korea',
    detachment: true,
    totalisation: true,
    exportOfPension: true,
  },
  NO: {
    code: 'NO',
    label: 'Norway',
    detachment: true,
    totalisation: true,
    exportOfPension: true,
  },
  SE: {
    code: 'SE',
    label: 'Sweden',
    detachment: true,
    totalisation: true,
    exportOfPension: true,
  },
  JP: {
    code: 'JP',
    label: 'Japan',
    detachment: true,
    totalisation: true,
    exportOfPension: true,
  },
  AU: {
    code: 'AU',
    label: 'Australia',
    detachment: true,
    totalisation: true,
    exportOfPension: true,
  },
  CA: {
    code: 'CA',
    label: 'Canada',
    detachment: true,
    totalisation: true,
    exportOfPension: true,
  },
  PT: {
    code: 'PT',
    label: 'Portugal',
    detachment: true,
    totalisation: true,
    exportOfPension: true,
  },
  AT: {
    code: 'AT',
    label: 'Austria',
    detachment: true,
    totalisation: true,
    exportOfPension: true,
  },
  HU: {
    code: 'HU',
    label: 'Hungary',
    detachment: true,
    totalisation: true,
    exportOfPension: true,
  },
  CZ: {
    code: 'CZ',
    label: 'Czech Republic',
    detachment: true,
    totalisation: true,
    exportOfPension: true,
  },
  FI: {
    code: 'FI',
    label: 'Finland',
    detachment: true,
    totalisation: true,
    exportOfPension: true,
  },
  BR: {
    code: 'BR',
    label: 'Brazil',
    detachment: true,
    totalisation: true,
    exportOfPension: true,
  },
  QC: {
    code: 'QC',
    label: 'Quebec',
    detachment: true,
    totalisation: true,
    exportOfPension: true,
  },
};

const WITHDRAWAL_GROUND = {
  RETIREMENT_AT_58: 'RETIREMENT_AT_58',
  PERMANENT_INCAPACITY: 'PERMANENT_INCAPACITY',
  UNDER_AN_SSA: 'UNDER_AN_SSA',
  /** The domestic ground, and the one that does not reach an IW. */
  TWO_MONTHS_UNEMPLOYED: 'TWO_MONTHS_UNEMPLOYED',
};

const FINDING = {
  STATUS_NOT_DETERMINED: 'STATUS_NOT_DETERMINED',
  CEILING_APPLIED_TO_IW: 'CEILING_APPLIED_TO_IW',
  CERTIFICATE_EXPIRING: 'CERTIFICATE_EXPIRING',
  CERTIFICATE_EXPIRED: 'CERTIFICATE_EXPIRED',
  CERTIFICATE_FROM_NON_SSA_COUNTRY: 'CERTIFICATE_FROM_NON_SSA_COUNTRY',
  DEPUTATION_NOT_CLASSIFIED: 'DEPUTATION_NOT_CLASSIFIED',
  WITHDRAWAL_NOT_AVAILABLE: 'WITHDRAWAL_NOT_AVAILABLE',
  PENSION_NOT_AVAILABLE: 'PENSION_NOT_AVAILABLE',
  IW_ONE_DUE: 'IW_ONE_DUE',
  IW_ONE_OVERDUE: 'IW_ONE_OVERDUE',
};

const FINDING_AUTHORITY = {
  [FINDING.STATUS_NOT_DETERMINED]: 'Paragraph 83(2)(f)',
  [FINDING.CEILING_APPLIED_TO_IW]: 'Paragraph 83 and paragraph 26A',
  [FINDING.CERTIFICATE_EXPIRING]: 'The detachment article of the SSA',
  [FINDING.CERTIFICATE_EXPIRED]: 'Paragraph 83(2)(e)',
  [FINDING.CERTIFICATE_FROM_NON_SSA_COUNTRY]: 'Paragraph 83(2)(e)',
  [FINDING.DEPUTATION_NOT_CLASSIFIED]: 'Paragraph 83(2)(f)(ii)',
  [FINDING.WITHDRAWAL_NOT_AVAILABLE]: 'Paragraph 69(2)',
  [FINDING.PENSION_NOT_AVAILABLE]: 'Paragraph 83 and the EPS',
  [FINDING.IW_ONE_DUE]: 'Paragraph 36(9)',
  [FINDING.IW_ONE_OVERDUE]: 'Paragraph 36(9)',
};

const SEVERITY = {
  BREACH: 'BREACH',
  /** A deadline that has not yet passed. Not a failure. */
  DUE: 'DUE',
  INFORMATIONAL: 'INFORMATIONAL',
};

const FINDING_SEVERITY = {
  [FINDING.STATUS_NOT_DETERMINED]: SEVERITY.DUE,
  [FINDING.CEILING_APPLIED_TO_IW]: SEVERITY.BREACH,
  [FINDING.CERTIFICATE_EXPIRING]: SEVERITY.DUE,
  [FINDING.CERTIFICATE_EXPIRED]: SEVERITY.BREACH,
  [FINDING.CERTIFICATE_FROM_NON_SSA_COUNTRY]: SEVERITY.BREACH,
  [FINDING.DEPUTATION_NOT_CLASSIFIED]: SEVERITY.DUE,
  [FINDING.WITHDRAWAL_NOT_AVAILABLE]: SEVERITY.INFORMATIONAL,
  [FINDING.PENSION_NOT_AVAILABLE]: SEVERITY.INFORMATIONAL,
  [FINDING.IW_ONE_DUE]: SEVERITY.DUE,
  [FINDING.IW_ONE_OVERDUE]: SEVERITY.BREACH,
};

/**
 * Paragraph 83, in the module's own words.
 *
 * Carried on every contribution basis rather than left in a comment. The
 * difference between ₹1,800 and ₹72,000 a month looks like a bug to anybody
 * who has only ever seen the domestic path, and the sentence is what stops
 * somebody "fixing" it back to the ceiling.
 */
const NO_WAGE_CEILING_FOR_INTERNATIONAL_WORKERS =
  'The ₹15,000 statutory wage ceiling does not apply to an International Worker. Contribution is on the full monthly pay, including the portion paid outside India and the portion paid in a foreign currency. A figure that looks forty times too large against the domestic path is the correct one.';

/**
 * Paragraph 69(2), in the module's own words.
 */
const WITHDRAWAL_IS_NOT_AVAILABLE_ON_UNEMPLOYMENT =
  'An International Worker cannot withdraw on two months’ unemployment. The grounds are retirement at 58, permanent and total incapacity, or a route the applicable Social Security Agreement gives — and nothing else. Offering the domestic withdrawal to this member offers something that will be refused.';

// --- Dates ------------------------------------------------------------------

/**
 * @param {Date|string|number|null|undefined} value
 * @returns {Date|null}
 */
function toUtcDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(
    Date.UTC(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth(),
      parsed.getUTCDate(),
    ),
  );
}

/**
 * @param {Date} date
 * @param {number} days
 * @returns {Date}
 */
function addDays(date, days) {
  return new Date(date.getTime() + days * 86400000);
}

/**
 * Whole days between two dates. Signed — the sign is the answer.
 *
 * @param {Date} from
 * @param {Date} to
 * @returns {number}
 */
function daysBetween(from, to) {
  if (!from || !to) return 0;
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

/**
 * Completed months between two dates.
 *
 * Completed rather than rounded, because service is counted in completed months
 * everywhere in the Scheme and a rounded month buys eligibility that has not
 * been earned.
 *
 * @param {Date|string} from
 * @param {Date|string} to
 * @returns {number}
 */
function monthsBetween(from, to) {
  const start = toUtcDate(from);
  const end = toUtcDate(to);
  if (!start || !end || end < start) return 0;

  let months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth());
  if (end.getUTCDate() < start.getUTCDate()) months -= 1;

  return Math.max(0, months);
}

// --- Status -----------------------------------------------------------------

/**
 * Whether an employee is an International Worker on a date, and on what limb.
 *
 * Takes a limb and a ground rather than a nationality. Keying off nationality
 * misses every Indian employee on deputation to an SSA country — who is an
 * International Worker by definition — and wrongly catches foreign nationals
 * holding a valid Certificate of Coverage, who are excluded employees. Both
 * errors are in the direction that costs money.
 *
 * @param {object} input
 * @param {object} input.determination
 * @param {object|null} [input.certificate]
 * @param {Date|string} [input.asOn]
 * @returns {object}
 */
function determineStatus({ determination, certificate, asOn = new Date() }) {
  const on = toUtcDate(asOn);

  if (!determination?.limb || !LIMB[determination.limb]) {
    return {
      status: STATUS.UNDETERMINED,
      limb: null,
      authority: 'Paragraph 83(2)(f)',
      reason:
        'Nobody has determined whether this employee is within paragraph 83. Status is a determination on the definition and not something a nationality field answers.',
    };
  }

  const from = toUtcDate(determination.from);
  const to = toUtcDate(determination.to);

  if ((from && on < from) || (to && on > to)) {
    return {
      status: STATUS.DOMESTIC,
      limb: determination.limb,
      authority: 'Paragraph 83(2)(f)',
      reason:
        'The date falls outside the period the determination covers, so the domestic rules apply to it.',
    };
  }

  const position = certificatePosition({ certificate, asAt: on });

  if (position?.valid) {
    return {
      status: STATUS.EXCLUDED_BY_CERTIFICATE,
      limb: determination.limb,
      authority: 'Paragraph 83(2)(e)',
      reason: `Detached under the ${position.country?.label || position.countryCode} agreement for the period of the certificate, and an excluded employee here for as long as it runs.`,
      certificate: position,
    };
  }

  return {
    status: STATUS.INTERNATIONAL_WORKER,
    limb: determination.limb,
    authority: 'Paragraph 83',
    reason:
      'Within paragraph 83 and not detached by a certificate, so contributing on full monthly pay with no wage ceiling.',
    certificate: position,
  };
}

// --- Certificates of Coverage -----------------------------------------------

/**
 * A Certificate of Coverage's position on a date.
 *
 * A countdown rather than a date. A COC lapsing is the highest-value obligation
 * in the module — the worker attaches at full pay with no ceiling the day after,
 * and the under-remittance compounds monthly until somebody opens the PDF — and
 * only a countdown raises it while an extension can still be applied for.
 *
 * @param {object} input
 * @param {object|null} input.certificate
 * @param {Date|string} [input.asAt]
 * @returns {object|null}
 */
function certificatePosition({ certificate, asAt = new Date() }) {
  if (!certificate) return null;

  const today = toUtcDate(asAt);
  const from = toUtcDate(certificate.validFrom);
  const to = toUtcDate(certificate.validTo);
  const country = SSA_COUNTRIES[certificate.countryCode] || null;

  const daysRemaining = to ? daysBetween(today, to) : null;

  return {
    countryCode: certificate.countryCode,
    country,
    // An agreement without a detachment article cannot produce a certificate at
    // all, so a certificate from such a country detaches nobody.
    detachmentAvailable: Boolean(country?.detachment),
    validFrom: from,
    validTo: to,
    valid:
      Boolean(country?.detachment) &&
      Boolean(from) &&
      Boolean(to) &&
      today >= from &&
      today <= to,
    daysRemaining,
    expiring:
      daysRemaining !== null &&
      daysRemaining >= 0 &&
      daysRemaining <= IW_RULES.certificateNoticeDays,
    expired: daysRemaining !== null && daysRemaining < 0,
    /** The month the worker attaches at full pay if it is not extended. */
    attachesFrom: to ? addDays(to, 1) : null,
  };
}

// --- Contribution -----------------------------------------------------------

/**
 * The contribution basis for a month.
 *
 * Returns what the domestic ceiling *would* have produced alongside what is
 * actually due. That comparison is the whole reason the function exists: the
 * difference is large enough to read as a bug, and an under-remittance found
 * here is the amount #1875 then charges section 7Q interest and section 14B
 * damages on.
 *
 * @param {object} input
 * @param {object} input.status
 * @param {object} input.pay
 * @param {object} [input.rules]
 * @returns {object}
 */
function contributionBasis({ status, pay, rules = IW_RULES }) {
  const inIndia = Number(pay?.paidInIndia) || 0;
  const outsideIndia = Number(pay?.paidOutsideIndia) || 0;
  const foreignCurrency = Number(pay?.paidInForeignCurrency) || 0;

  const fullPay = inIndia + outsideIndia + foreignCurrency;

  if (status?.status === STATUS.EXCLUDED_BY_CERTIFICATE) {
    return {
      applicable: false,
      reason:
        'Detached by a valid Certificate of Coverage and an excluded employee. No Indian contribution arises for the period it runs.',
      basis: 0,
      fullPay,
      employee: 0,
      employer: 0,
      note: NO_WAGE_CEILING_FOR_INTERNATIONAL_WORKERS,
    };
  }

  if (status?.status !== STATUS.INTERNATIONAL_WORKER) {
    const domesticBasis = Math.min(fullPay, rules.domesticWageCeiling);
    return {
      applicable: true,
      ceilingApplied: true,
      reason: 'Not within paragraph 83, so the domestic wage ceiling applies.',
      basis: domesticBasis,
      fullPay,
      employee: Math.round(domesticBasis * rules.employeeRate),
      employer: Math.round(domesticBasis * rules.employerRate),
      note: null,
    };
  }

  const ceilingWouldHaveBeen = Math.min(fullPay, rules.domesticWageCeiling);

  return {
    applicable: true,
    // Recorded as an explicit false rather than simply absent, so a reviewer
    // can see the difference was intended.
    ceilingApplied: false,
    reason:
      'An International Worker contributes on full monthly pay. The statutory wage ceiling does not apply.',
    basis: fullPay,
    fullPay,
    paidInIndia: inIndia,
    paidOutsideIndia: outsideIndia,
    paidInForeignCurrency: foreignCurrency,
    employee: Math.round(fullPay * rules.employeeRate),
    employer: Math.round(fullPay * rules.employerRate),
    employerToPension: Math.round(fullPay * rules.employerPensionRate),
    // The comparison. See the docstring.
    ceilingWouldHaveBeen,
    understatementIfCeilingApplied: Math.round(
      (fullPay - ceilingWouldHaveBeen) *
        (rules.employeeRate + rules.employerRate),
    ),
    note: NO_WAGE_CEILING_FOR_INTERNATIONAL_WORKERS,
  };
}

// --- Withdrawal -------------------------------------------------------------

/**
 * Whether an International Worker may withdraw.
 *
 * Returns a refusal with its reason rather than a form. See
 * `WITHDRAWAL_IS_NOT_AVAILABLE_ON_UNEMPLOYMENT`.
 *
 * @param {object} input
 * @param {object} input.status
 * @param {string} input.ground
 * @param {number} input.age
 * @param {string} [input.ssaCountryCode]
 * @param {object} [input.rules]
 * @returns {object}
 */
function withdrawalEligibility({
  status,
  ground,
  age,
  ssaCountryCode,
  rules = IW_RULES,
}) {
  if (status?.status !== STATUS.INTERNATIONAL_WORKER) {
    return {
      available: true,
      ground,
      reason:
        'Not an International Worker. The domestic withdrawal rules apply.',
      authority: 'Paragraph 69',
    };
  }

  const note = WITHDRAWAL_IS_NOT_AVAILABLE_ON_UNEMPLOYMENT;

  if (ground === WITHDRAWAL_GROUND.RETIREMENT_AT_58) {
    const available = Number(age) >= rules.retirementAge;
    return {
      available,
      ground,
      reason: available
        ? `Retirement at ${rules.retirementAge}.`
        : `Aged ${age}, below the retirement age of ${rules.retirementAge}. Leaving India is not a ground.`,
      authority: 'Paragraph 69(2)',
      note,
    };
  }

  if (ground === WITHDRAWAL_GROUND.PERMANENT_INCAPACITY) {
    return {
      available: true,
      ground,
      reason: 'Permanent and total incapacity for work.',
      authority: 'Paragraph 69(1)(b)',
      note,
    };
  }

  if (ground === WITHDRAWAL_GROUND.UNDER_AN_SSA) {
    const country = SSA_COUNTRIES[ssaCountryCode];
    return {
      available: Boolean(country?.exportOfPension),
      ground,
      reason: country?.exportOfPension
        ? `The agreement with ${country.label} provides for it.`
        : `No agreement with ${ssaCountryCode || 'that country'} provides a route, so this ground is not open.`,
      authority: 'The applicable Social Security Agreement',
      note,
    };
  }

  return {
    available: false,
    ground: ground || WITHDRAWAL_GROUND.TWO_MONTHS_UNEMPLOYED,
    reason: note,
    authority: 'Paragraph 69(2)',
    note,
  };
}

// --- Pension ----------------------------------------------------------------

/**
 * EPS eligibility for an International Worker, on totalised service.
 *
 * #1769's ten-year test is right for a domestic member and wrong here. Under an
 * agreement providing for totalisation the periods in both countries are added
 * **for eligibility**, while each country pays only for its own period — so a
 * member with six years here and eight there is eligible, and India's pension is
 * computed on six.
 *
 * @param {object} input
 * @returns {object}
 */
function pensionPosition({
  status,
  indianServiceMonths,
  foreignServiceMonths = 0,
  ssaCountryCode,
  rules = IW_RULES,
  // Injectable for the same reason the state rules are in #1701: the list of
  // agreements is not permanent, and a tenant may hold one the seed does not.
  agreements = SSA_COUNTRIES,
}) {
  const indian = Number(indianServiceMonths) || 0;
  const foreign = Number(foreignServiceMonths) || 0;
  const requiredMonths = rules.pensionEligibleYears * 12;

  if (status?.status !== STATUS.INTERNATIONAL_WORKER) {
    return {
      eligible: indian >= requiredMonths,
      basis: 'DOMESTIC',
      indianServiceMonths: indian,
      countedServiceMonths: indian,
      requiredMonths,
      authority: 'Paragraph 12 of the EPS',
    };
  }

  const country = agreements[ssaCountryCode];

  if (!country) {
    return {
      eligible: false,
      basis: 'NO_AGREEMENT',
      indianServiceMonths: indian,
      countedServiceMonths: indian,
      requiredMonths,
      reason:
        'Pension membership for an International Worker is available only where an agreement provides for it. There is no agreement with this country.',
      authority: 'Paragraph 83 and the EPS',
    };
  }

  if (!country.totalisation) {
    return {
      eligible: indian >= requiredMonths,
      basis: 'AGREEMENT_WITHOUT_TOTALISATION',
      indianServiceMonths: indian,
      countedServiceMonths: indian,
      requiredMonths,
      reason: `The agreement with ${country.label} does not provide for totalisation, so only Indian service counts towards eligibility.`,
      authority: 'The applicable Social Security Agreement',
    };
  }

  const counted = indian + foreign;

  return {
    eligible: counted >= requiredMonths,
    basis: 'TOTALISED',
    indianServiceMonths: indian,
    foreignServiceMonths: foreign,
    countedServiceMonths: counted,
    requiredMonths,
    // Named explicitly. Totalisation buys eligibility and not benefit: India
    // pays for Indian service only, and a member reading "eligible" as "ten
    // years' pension from India" is reading it wrong.
    indiaPaysForMonths: indian,
    reason: `Service in India and ${country.label} is totalised for eligibility. Each country pays for its own period, so India pays on ${indian} months.`,
    authority: 'The totalisation article of the agreement',
  };
}

// --- IW-1 -------------------------------------------------------------------

/**
 * The IW-1 schedule for a period.
 *
 * Built from month ends and never from the international-worker table. IW-1 is
 * a return about international workers and is owed for a month in which the
 * establishment employed none — which is exactly the month a worker-driven
 * schedule would show as clean.
 *
 * @param {object} input
 * @returns {Array<object>}
 */
function iwOneSchedule({
  from,
  to,
  filings = [],
  rules = IW_RULES,
  asAt = new Date(),
}) {
  const start = toUtcDate(from);
  const end = toUtcDate(to);
  if (!start || !end || end < start) return [];

  const today = toUtcDate(asAt);
  const filed = new Set(
    filings
      .map((row) => toUtcDate(row.forMonthEnding))
      .filter(Boolean)
      .map((date) => date.toISOString().slice(0, 10)),
  );

  const rows = [];
  let cursor = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
  );

  while (cursor <= end) {
    const dueOn = addDays(cursor, rules.iwOneDueDays);
    const key = cursor.toISOString().slice(0, 10);

    rows.push({
      forMonthEnding: new Date(cursor),
      dueOn,
      filed: filed.has(key),
      overdue: !filed.has(key) && today > dueOn,
      daysRemaining:
        !filed.has(key) && today <= dueOn ? daysBetween(today, dueOn) : null,
    });

    cursor = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 2, 0),
    );
  }

  return rows;
}

// --- Assessment -------------------------------------------------------------

/**
 * One employee's complete position.
 *
 * @param {object} input
 * @returns {object}
 */
function assessWorker({
  determination,
  certificate,
  pay,
  contributionAsRemitted,
  indianServiceMonths = 0,
  foreignServiceMonths = 0,
  asAt = new Date(),
}) {
  const status = determineStatus({ determination, certificate, asOn: asAt });
  const basis = contributionBasis({ status, pay });
  const position = certificatePosition({ certificate, asAt });

  const findings = [];
  const add = (code, detail) =>
    findings.push({
      code,
      authority: FINDING_AUTHORITY[code],
      severity: FINDING_SEVERITY[code],
      ...detail,
    });

  if (status.status === STATUS.UNDETERMINED) {
    add(FINDING.STATUS_NOT_DETERMINED, { detail: status.reason });
  }

  if (position && !position.detachmentAvailable) {
    add(FINDING.CERTIFICATE_FROM_NON_SSA_COUNTRY, {
      countryCode: position.countryCode,
      detail:
        'A certificate has been recorded from a country India has no detachment article with. It detaches nobody, and the worker is contributing — or should be — on full pay throughout.',
    });
  }

  if (position?.expiring) {
    add(FINDING.CERTIFICATE_EXPIRING, {
      countryCode: position.countryCode,
      daysRemaining: position.daysRemaining,
      attachesFrom: position.attachesFrom,
      detail: `The certificate lapses in ${position.daysRemaining} days. From the day after, the worker attaches at full pay with no ceiling — extending it is an application to a foreign authority and takes time.`,
    });
  }

  if (position?.expired) {
    add(FINDING.CERTIFICATE_EXPIRED, {
      countryCode: position.countryCode,
      expiredOn: position.validTo,
      attachesFrom: position.attachesFrom,
      detail:
        'The certificate has lapsed. The worker has been attached at full pay with no ceiling since the day after, and any month remitted on the domestic ceiling since then is an under-remittance carrying section 7Q interest and section 14B damages.',
    });
  }

  // The finding this module exists for. A remittance computed on ₹15,000 for a
  // member on ₹6,00,000 is not a rounding error.
  if (
    status.status === STATUS.INTERNATIONAL_WORKER &&
    contributionAsRemitted !== undefined &&
    contributionAsRemitted !== null
  ) {
    const due = basis.employee + basis.employer;
    if (Number(contributionAsRemitted) < due) {
      add(FINDING.CEILING_APPLIED_TO_IW, {
        remitted: Number(contributionAsRemitted),
        due,
        shortfall: due - Number(contributionAsRemitted),
        ceilingWouldHaveBeen: basis.ceilingWouldHaveBeen,
        detail: NO_WAGE_CEILING_FOR_INTERNATIONAL_WORKERS,
      });
    }
  }

  if (
    determination?.limb === LIMB.INDIAN_IN_SSA_COUNTRY &&
    !determination?.determinedOn
  ) {
    add(FINDING.DEPUTATION_NOT_CLASSIFIED, {
      detail:
        'An Indian employee on deputation to an agreement country is an International Worker by definition. The deputation is on record and the paragraph 83 determination is not.',
    });
  }

  const pension = pensionPosition({
    status,
    indianServiceMonths,
    foreignServiceMonths,
    ssaCountryCode: certificate?.countryCode || determination?.countryCode,
  });

  if (!pension.eligible && pension.basis === 'NO_AGREEMENT') {
    add(FINDING.PENSION_NOT_AVAILABLE, { detail: pension.reason });
  }

  return {
    status,
    certificate: position,
    contribution: basis,
    pension,
    findings,
    notes: {
      noWageCeiling: NO_WAGE_CEILING_FOR_INTERNATIONAL_WORKERS,
      withdrawalIsNotAvailableOnUnemployment:
        WITHDRAWAL_IS_NOT_AVAILABLE_ON_UNEMPLOYMENT,
    },
  };
}

/**
 * The establishment's position: every worker, plus the IW-1 schedule.
 *
 * @param {object} input
 * @returns {object}
 */
function assessEstablishment({
  workers = [],
  filings = [],
  period,
  asAt = new Date(),
}) {
  const assessments = workers.map((worker) => ({
    employeeId: worker.employeeId,
    ...assessWorker({ ...worker, asAt }),
  }));

  const schedule = iwOneSchedule({
    from: period?.from,
    to: period?.to,
    filings,
    asAt,
  });

  const findings = assessments.flatMap((row) => row.findings);

  for (const row of schedule) {
    if (row.filed) continue;
    findings.push({
      code: row.overdue ? FINDING.IW_ONE_OVERDUE : FINDING.IW_ONE_DUE,
      authority:
        FINDING_AUTHORITY[
          row.overdue ? FINDING.IW_ONE_OVERDUE : FINDING.IW_ONE_DUE
        ],
      severity:
        FINDING_SEVERITY[
          row.overdue ? FINDING.IW_ONE_OVERDUE : FINDING.IW_ONE_DUE
        ],
      forMonthEnding: row.forMonthEnding,
      dueOn: row.dueOn,
      daysRemaining: row.daysRemaining,
      detail:
        'IW-1 is a return about international workers and is owed for a month in which the establishment employed none.',
    });
  }

  return {
    asAt: toUtcDate(asAt),
    assessments,
    iwOne: schedule,
    // The number that makes the case for the module. Summed across workers so
    // the exposure is one figure rather than a column somebody adds up.
    contributionUnderstatementIfCeilingApplied: assessments.reduce(
      (sum, row) =>
        sum + (row.contribution?.understatementIfCeilingApplied || 0),
      0,
    ),
    findings,
    severityCounts: {
      BREACH: findings.filter((f) => f.severity === SEVERITY.BREACH).length,
      DUE: findings.filter((f) => f.severity === SEVERITY.DUE).length,
      INFORMATIONAL: findings.filter(
        (f) => f.severity === SEVERITY.INFORMATIONAL,
      ).length,
    },
    notes: {
      noWageCeiling: NO_WAGE_CEILING_FOR_INTERNATIONAL_WORKERS,
      withdrawalIsNotAvailableOnUnemployment:
        WITHDRAWAL_IS_NOT_AVAILABLE_ON_UNEMPLOYMENT,
    },
  };
}

module.exports = {
  IW_RULES,
  LIMB,
  STATUS,
  SSA_COUNTRIES,
  WITHDRAWAL_GROUND,
  FINDING,
  FINDING_AUTHORITY,
  FINDING_SEVERITY,
  SEVERITY,
  NO_WAGE_CEILING_FOR_INTERNATIONAL_WORKERS,
  WITHDRAWAL_IS_NOT_AVAILABLE_ON_UNEMPLOYMENT,
  toUtcDate,
  addDays,
  daysBetween,
  monthsBetween,
  determineStatus,
  certificatePosition,
  contributionBasis,
  withdrawalEligibility,
  pensionPosition,
  iwOneSchedule,
  assessWorker,
  assessEstablishment,
};
