/**
 * Inter-State Migrant Workmen (Regulation of Employment and Conditions of
 * Service) Act, 1979 (#1826).
 *
 * A migrant workman is not a contract workman who travelled. The Act attaches
 * obligations to the *act of recruitment across a state boundary*, and those
 * obligations are invisible to a module that only sees the site:
 *
 *   wage floor       the higher of two states' schedules — and then 13(1)(b)
 *   recruitment      a displacement allowance, once, non-refundable
 *   the fare         both ways, plus wages for the days spent travelling
 *   registration     five migrant workmen, not the 1970 Act's twenty
 *
 * The one that goes wrong silently is **section 13(1)(b)**. Everyone reads
 * 13(1)(a) — pay at least the notified minimum — and stops. But where the work
 * is the same as or similar to a local workman's, the migrant is entitled to
 * the *same wages as that local workman*, which is not a minimum-wage question
 * at all. An establishment paying every migrant the notified minimum while
 * paying its own fitters ₹640 a day satisfies every wage floor the product
 * knows about and breaches 13(1)(b).
 *
 * So `bindingWageRate` never returns a bare number. It returns the rate *and*
 * which of the three candidates produced it, because "below the floor" and
 * "below the local rate" are different breaches with different remedies, and a
 * single figure would lose that.
 *
 * The other asymmetry worth naming: the **return** fare is owed from the moment
 * of recruitment, not from termination. Accruing it at the end is how it gets
 * forgotten for the workman who left early, which is the only case where
 * anybody was going to forget it.
 *
 * Pure functions, no database access.
 */

/** Section 14's floor has stood in rupees since 1979, so the max matters. */
const RUPEE = 1;

/**
 * The Act's figures, as the default rule set.
 *
 * A rule set rather than constants because the section 4 and 8 thresholds are
 * amended by state rules, and because an assessment run for a historical period
 * needs the figures that were in force then — the same shape as the notified
 * schedules in #1698 and the engagement band in #1771.
 */
const MIGRANT_RULES = {
  /** Section 4 — registration of the principal employer, in migrant workmen. */
  registrationThreshold: 5,
  /** Section 8 — licensing of the contractor. The same number, separately set. */
  licensingThreshold: 5,
  /** Section 14 — the allowance, as a percentage of monthly wages. */
  displacementPercent: 50,
  /** Section 14 — and the rupee floor the percentage is taken against. */
  displacementFloor: 75 * RUPEE,
  /** Section 15 — wages for the days spent travelling, as though worked. */
  journeyWagesPayable: true,
  /** Rule 8 — the passbook has to be refreshed when a wage rate changes. */
  passbookRefreshDays: 30,
  /** Section 16 — the facilities that must be provided free of charge. */
  requiredFacilities: null,
  /** Days in a month, for turning a monthly wage into a daily one. */
  daysPerMonth: 26,
};

/**
 * Which of the three candidate rates bound.
 *
 * The whole reason `bindingWageRate` exists. Two of these are wage *floors* and
 * the third is a parity entitlement, and an establishment can clear both floors
 * and still breach the third by a wide margin.
 */
const WAGE_BASIS = {
  /** Section 13(1)(a), read with the home state's notified schedule. */
  HOME_STATE_NOTIFIED: 'HOME_STATE_NOTIFIED',
  /** Section 13(1)(a), read with the state of employment's schedule. */
  HOST_STATE_NOTIFIED: 'HOST_STATE_NOTIFIED',
  /** Section 13(1)(b) — the local workman doing the same or similar work. */
  LOCAL_COMPARABLE: 'LOCAL_COMPARABLE',
};

const WAGE_BASIS_LABEL = {
  [WAGE_BASIS.HOME_STATE_NOTIFIED]: 'the home state’s notified rate',
  [WAGE_BASIS.HOST_STATE_NOTIFIED]: 'the state of employment’s notified rate',
  [WAGE_BASIS.LOCAL_COMPARABLE]: 'a comparable local workman’s rate',
};

/** Section 16 — provided free of charge, or the cost is recoverable. */
const FACILITY = {
  ACCOMMODATION: 'ACCOMMODATION',
  MEDICAL: 'MEDICAL',
  PROTECTIVE_CLOTHING: 'PROTECTIVE_CLOTHING',
};

const FACILITY_LABEL = {
  [FACILITY.ACCOMMODATION]: 'Suitable residential accommodation',
  [FACILITY.MEDICAL]: 'Medical facilities',
  [FACILITY.PROTECTIVE_CLOTHING]: 'Protective clothing',
};

/** Section 15 — and the return leg is the one that gets forgotten. */
const JOURNEY_LEG = {
  OUTWARD: 'OUTWARD',
  RETURN: 'RETURN',
};

const FINDING = {
  BELOW_STATUTORY_FLOOR: 'BELOW_STATUTORY_FLOOR',
  BELOW_LOCAL_COMPARABLE: 'BELOW_LOCAL_COMPARABLE',
  NO_LOCAL_COMPARATOR: 'NO_LOCAL_COMPARATOR',
  DISPLACEMENT_UNPAID: 'DISPLACEMENT_UNPAID',
  DISPLACEMENT_SHORT: 'DISPLACEMENT_SHORT',
  DISPLACEMENT_RECOVERED: 'DISPLACEMENT_RECOVERED',
  OUTWARD_JOURNEY_UNPAID: 'OUTWARD_JOURNEY_UNPAID',
  RETURN_JOURNEY_UNACCRUED: 'RETURN_JOURNEY_UNACCRUED',
  JOURNEY_WAGES_UNPAID: 'JOURNEY_WAGES_UNPAID',
  FACILITY_NOT_PROVIDED: 'FACILITY_NOT_PROVIDED',
  PASSBOOK_NOT_ISSUED: 'PASSBOOK_NOT_ISSUED',
  PASSBOOK_STALE: 'PASSBOOK_STALE',
  REGISTRATION_REQUIRED: 'REGISTRATION_REQUIRED',
  CONTRACTOR_UNLICENSED: 'CONTRACTOR_UNLICENSED',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
};

const FINDING_SECTION = {
  [FINDING.BELOW_STATUTORY_FLOOR]: 'section 13(1)(a)',
  [FINDING.BELOW_LOCAL_COMPARABLE]: 'section 13(1)(b)',
  [FINDING.NO_LOCAL_COMPARATOR]: 'section 13(1)(b)',
  [FINDING.DISPLACEMENT_UNPAID]: 'section 14',
  [FINDING.DISPLACEMENT_SHORT]: 'section 14',
  [FINDING.DISPLACEMENT_RECOVERED]: 'section 14',
  [FINDING.OUTWARD_JOURNEY_UNPAID]: 'section 15',
  [FINDING.RETURN_JOURNEY_UNACCRUED]: 'section 15',
  [FINDING.JOURNEY_WAGES_UNPAID]: 'section 15',
  [FINDING.FACILITY_NOT_PROVIDED]: 'section 16',
  [FINDING.PASSBOOK_NOT_ISSUED]: 'section 12 with Rule 8',
  [FINDING.PASSBOOK_STALE]: 'section 12 with Rule 8',
  [FINDING.REGISTRATION_REQUIRED]: 'section 4',
  [FINDING.CONTRACTOR_UNLICENSED]: 'section 8',
  [FINDING.NOT_APPLICABLE]: 'section 1(4)',
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
 * @param {Date} from
 * @param {Date} to
 * @returns {number}
 */
function daysBetween(from, to) {
  return Math.floor((to.getTime() - from.getTime()) / 86400000);
}

/**
 * Merge a rule set over the Act's figures.
 *
 * @param {object} [rules]
 * @returns {object}
 */
function resolveRules(rules) {
  const merged = { ...MIGRANT_RULES, ...(rules || {}) };

  // A stored rule set with no facility list falls back to section 16's three
  // rather than to `null` — which would make every facility optional and every
  // section 16 finding disappear.
  if (
    !Array.isArray(merged.requiredFacilities) ||
    !merged.requiredFacilities.length
  ) {
    merged.requiredFacilities = Object.values(FACILITY);
  }

  if (!(merged.daysPerMonth > 0))
    merged.daysPerMonth = MIGRANT_RULES.daysPerMonth;

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
 * Section 13 — the rate that actually binds, and which candidate produced it.
 *
 * Two floors and a parity entitlement, and they do not compose into one number
 * without losing the distinction the Act draws:
 *
 *   13(1)(a)  not less than the notified minimum — and since the workman is
 *             recruited in one state and employed in another, the honest floor
 *             is the higher of the two schedules;
 *   13(1)(b)  where the work is the same as or similar to a local workman's,
 *             *the same wages as that workman* — which is not a floor at all.
 *
 * A local comparator above the floor therefore displaces it, and one below it
 * does not pull the entitlement down: 13(1)(b) is an entitlement to parity,
 * not a licence to pay a local workman badly and match it.
 *
 * Where no comparator has been recorded the answer is the floor, reported with
 * `comparatorRecorded: false` — an absent comparator is not evidence that none
 * exists, and the caller should be able to tell "nobody does similar work here"
 * from "nobody has looked".
 *
 * @param {object} rates
 * @param {number} [rates.homeStateRate] daily, notified in the state of recruitment
 * @param {number} [rates.hostStateRate] daily, notified in the state of employment
 * @param {number} [rates.localComparableRate] daily, actually paid to a local workman
 * @returns {object}
 */
function bindingWageRate(rates) {
  const home = Math.max(0, toNumber(rates?.homeStateRate));
  const host = Math.max(0, toNumber(rates?.hostStateRate));

  const comparatorRecorded =
    rates?.localComparableRate !== undefined &&
    rates?.localComparableRate !== null &&
    Number.isFinite(Number(rates.localComparableRate));

  const local = comparatorRecorded
    ? Math.max(0, toNumber(rates.localComparableRate))
    : 0;

  // The statutory floor is the higher of the two schedules. Ties go to the host
  // state, which is the one an inspection is conducted under.
  const floor = Math.max(home, host);
  const floorBasis =
    host >= home
      ? WAGE_BASIS.HOST_STATE_NOTIFIED
      : WAGE_BASIS.HOME_STATE_NOTIFIED;

  const parityBinds = comparatorRecorded && local > floor;

  return {
    rate: parityBinds ? local : floor,
    basis: parityBinds ? WAGE_BASIS.LOCAL_COMPARABLE : floorBasis,
    floor,
    floorBasis,
    comparatorRecorded,
    localComparableRate: comparatorRecorded ? local : null,
    candidates: {
      [WAGE_BASIS.HOME_STATE_NOTIFIED]: home,
      [WAGE_BASIS.HOST_STATE_NOTIFIED]: host,
      [WAGE_BASIS.LOCAL_COMPARABLE]: comparatorRecorded ? local : null,
    },
  };
}

/**
 * What a workman was short, and under which limb.
 *
 * Reported as two shortfalls rather than one, because they are different
 * breaches: falling below the floor is a minimum-wages offence and falling
 * below the comparator is a parity one, and an establishment can be in the
 * second without being in the first. Collapsing them would let the larger
 * number hide which statute was broken.
 *
 * @param {object} params
 * @param {object} params.rates
 * @param {number} params.paidDailyRate
 * @param {number} params.daysWorked
 * @param {object} [rules]
 * @returns {object}
 */
function assessWageParity({ rates, paidDailyRate, daysWorked }, rules) {
  resolveRules(rules);

  const binding = bindingWageRate(rates);
  const paid = Math.max(0, toNumber(paidDailyRate));
  const days = Math.max(0, toNumber(daysWorked));

  const findings = [];

  const floorGap = Math.max(0, binding.floor - paid);
  const parityGap = binding.comparatorRecorded
    ? Math.max(0, binding.localComparableRate - paid)
    : 0;

  if (floorGap > 0) {
    findings.push(
      finding(
        FINDING.BELOW_STATUTORY_FLOOR,
        SEVERITY.BREACH,
        `Paid ₹${round2(paid)} a day against ${WAGE_BASIS_LABEL[binding.floorBasis]} of ₹${round2(binding.floor)}.`,
        {
          paidDailyRate: paid,
          floor: binding.floor,
          basis: binding.floorBasis,
        },
      ),
    );
  }

  // Reported even where the floor was also breached. The remedy differs — one
  // is arrears to the notified rate, the other arrears to a colleague's rate —
  // and an establishment that fixes only the first is still in breach.
  if (parityGap > 0) {
    findings.push(
      finding(
        FINDING.BELOW_LOCAL_COMPARABLE,
        SEVERITY.BREACH,
        `Paid ₹${round2(paid)} a day against a comparable local workman’s ₹${round2(binding.localComparableRate)}. Section 13(1)(b) is a parity entitlement and is not discharged by clearing the notified minimum.`,
        {
          paidDailyRate: paid,
          localComparableRate: binding.localComparableRate,
        },
      ),
    );
  }

  if (!binding.comparatorRecorded) {
    findings.push(
      finding(
        FINDING.NO_LOCAL_COMPARATOR,
        SEVERITY.INFORMATIONAL,
        'No comparable local rate has been recorded, so only the section 13(1)(a) floor has been tested. An absent comparator is not a finding that none exists.',
        {},
      ),
    );
  }

  return {
    binding,
    paidDailyRate: paid,
    daysWorked: days,
    floorGap: round2(floorGap),
    parityGap: round2(parityGap),
    // The arrears run to whichever limb binds, so this is the single number to
    // pay — the two gaps above say which statute it discharges.
    arrears: round2(Math.max(floorGap, parityGap) * days),
    findings,
  };
}

/**
 * Section 14 — the displacement allowance.
 *
 * Fifty per cent of the monthly wages payable, or the rupee floor, whichever is
 * higher, paid at recruitment. For any realistic wage the percentage limb binds
 * and the ₹75 is dead — but it is live for a part-month engagement and for an
 * assessment run against a historical period, which is why the max is written
 * out rather than assumed away.
 *
 * Not an advance. The `recoverable: false` on the result is load-bearing: the
 * allowance is expressly non-refundable, and a recovery pass that treated it
 * like `salaryAdvances` would claw back a statutory payment.
 *
 * @param {object} params
 * @param {number} params.monthlyWages
 * @param {number} [params.paid]
 * @param {number} [params.recovered]
 * @param {object} [rules]
 * @returns {object}
 */
function displacementAllowance(
  { monthlyWages, paid = 0, recovered = 0 },
  rules,
) {
  const resolved = resolveRules(rules);

  const wages = Math.max(0, toNumber(monthlyWages));
  const percentLimb = round2((wages * resolved.displacementPercent) / 100);
  const floorLimb = round2(resolved.displacementFloor);

  const due = Math.max(percentLimb, floorLimb);
  const paidAmount = Math.max(0, toNumber(paid));
  const recoveredAmount = Math.max(0, toNumber(recovered));

  const findings = [];

  if (paidAmount <= 0) {
    findings.push(
      finding(
        FINDING.DISPLACEMENT_UNPAID,
        SEVERITY.BREACH,
        `₹${round2(due)} was payable at recruitment and nothing has been paid.`,
        { due },
      ),
    );
  } else if (paidAmount + 0.005 < due) {
    findings.push(
      finding(
        FINDING.DISPLACEMENT_SHORT,
        SEVERITY.BREACH,
        `₹${round2(due)} was payable at recruitment and ₹${round2(paidAmount)} was paid.`,
        { due, paid: paidAmount, shortfall: round2(due - paidAmount) },
      ),
    );
  }

  // The failure mode this module exists to make visible. A displacement
  // allowance is not refundable, so any recovery against it is money taken back
  // that the workman was statutorily entitled to keep.
  if (recoveredAmount > 0) {
    findings.push(
      finding(
        FINDING.DISPLACEMENT_RECOVERED,
        SEVERITY.BREACH,
        `₹${round2(recoveredAmount)} has been recovered against a payment section 14 makes non-refundable.`,
        { recovered: recoveredAmount },
      ),
    );
  }

  return {
    due,
    percentLimb,
    floorLimb,
    /** Which limb bound. The rupee floor is normally dead and occasionally is not. */
    boundBy: percentLimb >= floorLimb ? 'PERCENT' : 'FLOOR',
    paid: round2(paidAmount),
    recovered: round2(recoveredAmount),
    shortfall: round2(Math.max(0, due - paidAmount) + recoveredAmount),
    recoverable: false,
    findings,
  };
}

/**
 * Section 15 — the journey allowance, per leg.
 *
 * The fare both ways, borne by the contractor, plus wages for the days spent
 * travelling as though the workman had worked them.
 *
 * The return leg is accrued **at recruitment**. It is owed even where the
 * workman leaves before the contract ends, which is exactly the case where
 * nobody is thinking about it — so an unaccrued return leg is a finding on its
 * own, before any question of whether it was paid.
 *
 * @param {object} params
 * @param {number} params.outwardFare
 * @param {number} [params.returnFare]
 * @param {number} [params.outwardJourneyDays]
 * @param {number} [params.returnJourneyDays]
 * @param {number} params.dailyWage
 * @param {number} [params.outwardPaid]
 * @param {number} [params.returnPaid]
 * @param {boolean} [params.returnAccrued]
 * @param {object} [rules]
 * @returns {object}
 */
function journeyAllowance(params, rules) {
  const resolved = resolveRules(rules);

  const dailyWage = Math.max(0, toNumber(params?.dailyWage));

  const outwardFare = Math.max(0, toNumber(params?.outwardFare));
  // A return fare is presumed symmetric where it has not been stated
  // separately. Presuming zero would make the commonest data shape — one fare
  // recorded — silently halve the liability.
  const returnFare =
    params?.returnFare === undefined || params?.returnFare === null
      ? outwardFare
      : Math.max(0, toNumber(params.returnFare));

  const outwardDays = Math.max(0, toNumber(params?.outwardJourneyDays));
  const returnDays = Math.max(
    0,
    toNumber(params?.returnJourneyDays ?? outwardDays),
  );

  const wagesFor = (days) =>
    resolved.journeyWagesPayable ? round2(days * dailyWage) : 0;

  const legs = [
    {
      leg: JOURNEY_LEG.OUTWARD,
      fare: round2(outwardFare),
      journeyDays: outwardDays,
      journeyWages: wagesFor(outwardDays),
      due: round2(outwardFare + wagesFor(outwardDays)),
      paid: round2(Math.max(0, toNumber(params?.outwardPaid))),
    },
    {
      leg: JOURNEY_LEG.RETURN,
      fare: round2(returnFare),
      journeyDays: returnDays,
      journeyWages: wagesFor(returnDays),
      due: round2(returnFare + wagesFor(returnDays)),
      paid: round2(Math.max(0, toNumber(params?.returnPaid))),
      accrued: params?.returnAccrued === true,
    },
  ];

  const findings = [];

  const outward = legs[0];
  if (outward.due > 0 && outward.paid + 0.005 < outward.due) {
    findings.push(
      finding(
        FINDING.OUTWARD_JOURNEY_UNPAID,
        SEVERITY.BREACH,
        `₹${outward.due} was payable for the outward journey and ₹${outward.paid} was paid.`,
        { due: outward.due, paid: outward.paid },
      ),
    );
  }

  const back = legs[1];
  if (!back.accrued && back.due > 0) {
    findings.push(
      finding(
        FINDING.RETURN_JOURNEY_UNACCRUED,
        SEVERITY.EXPOSURE,
        `₹${back.due} for the return journey has not been accrued. It is owed from recruitment, including where the workman leaves before the contract ends.`,
        { due: back.due },
      ),
    );
  }

  if (resolved.journeyWagesPayable) {
    const wagesDue = round2(outward.journeyWages + back.journeyWages);
    const wagesPaid = Math.max(0, toNumber(params?.journeyWagesPaid));

    if (wagesDue > 0 && wagesPaid + 0.005 < wagesDue) {
      findings.push(
        finding(
          FINDING.JOURNEY_WAGES_UNPAID,
          SEVERITY.BREACH,
          `${outward.journeyDays + back.journeyDays} days of journey attract wages as though worked — ₹${wagesDue} — of which ₹${round2(wagesPaid)} has been paid.`,
          { due: wagesDue, paid: round2(wagesPaid) },
        ),
      );
    }
  }

  const due = round2(legs.reduce((sum, leg) => sum + leg.due, 0));
  const paid = round2(legs.reduce((sum, leg) => sum + leg.paid, 0));

  return {
    legs,
    due,
    paid,
    outstanding: round2(Math.max(0, due - paid)),
    findings,
  };
}

/**
 * Section 16 — the facilities, and what their absence costs.
 *
 * Costed rather than merely flagged, because where a facility is not provided
 * the appropriate government may provide it and recover the cost from the
 * contractor as an arrear of land revenue. The absence is a quantifiable
 * liability, not a policy note.
 *
 * @param {Array<object>} provided
 * @param {object} [rules]
 * @returns {object}
 */
function assessFacilities(provided, rules) {
  const resolved = resolveRules(rules);

  const byFacility = new Map();
  for (const entry of Array.isArray(provided) ? provided : []) {
    if (entry && entry.facility) byFacility.set(entry.facility, entry);
  }

  const findings = [];
  const rows = [];
  let recoverableCost = 0;

  for (const facility of resolved.requiredFacilities) {
    const entry = byFacility.get(facility);
    const isProvided = entry?.provided === true;
    const cost = Math.max(0, toNumber(entry?.substituteCost));

    rows.push({
      facility,
      label: FACILITY_LABEL[facility] || facility,
      provided: isProvided,
      substituteCost: round2(cost),
    });

    if (!isProvided) {
      recoverableCost += cost;
      findings.push(
        finding(
          FINDING.FACILITY_NOT_PROVIDED,
          cost > 0 ? SEVERITY.EXPOSURE : SEVERITY.BREACH,
          `${FACILITY_LABEL[facility] || facility} has not been provided. Section 16 lets the appropriate government provide it and recover the cost as an arrear of land revenue.`,
          { facility, substituteCost: round2(cost) },
        ),
      );
    }
  }

  return {
    facilities: rows,
    provided: rows.filter((row) => row.provided).length,
    required: rows.length,
    recoverableCost: round2(recoverableCost),
    findings,
  };
}

/**
 * Section 12 with Rule 8 — the Form XIII passbook.
 *
 * Assembled from the assessment rather than entered, so what the passbook says
 * and what the ledger says cannot drift. It is the only document where the two
 * allowances are evidenced, and it is the first thing an inspection asks for.
 *
 * "Stale" is its own state because the passbook has to be brought up to date
 * when the wage rate changes — a passbook issued once at recruitment and never
 * touched is not a compliant passbook, and it looks identical to a compliant
 * one in any check that only asks whether it exists.
 *
 * @param {object} params
 * @param {object} [rules]
 * @returns {object}
 */
function passbookState(
  { issuedOn, lastUpdatedOn, rateChangedOn, asAt },
  rules,
) {
  const resolved = resolveRules(rules);

  const issued = toDate(issuedOn);
  const at = toDate(asAt) || new Date();
  const findings = [];

  if (!issued) {
    findings.push(
      finding(
        FINDING.PASSBOOK_NOT_ISSUED,
        SEVERITY.BREACH,
        'No passbook has been issued. It has to record the wage rate, the period of employment and the allowances actually paid, in a language the workman understands.',
        {},
      ),
    );

    return { issued: false, stale: false, staleByDays: 0, findings };
  }

  const updated = toDate(lastUpdatedOn) || issued;
  const rateChanged = toDate(rateChangedOn);

  let stale = false;
  let staleByDays = 0;

  if (rateChanged && rateChanged > updated) {
    const overdueSince = new Date(
      rateChanged.getTime() + resolved.passbookRefreshDays * 86400000,
    );

    if (at > overdueSince) {
      stale = true;
      staleByDays = daysBetween(overdueSince, at);

      findings.push(
        finding(
          FINDING.PASSBOOK_STALE,
          SEVERITY.BREACH,
          `The wage rate changed on ${rateChanged.toISOString().slice(0, 10)} and the passbook has not been brought up to date. It is ${staleByDays} days past the ${resolved.passbookRefreshDays}-day window.`,
          { rateChangedOn: rateChanged, staleByDays },
        ),
      );
    }
  }

  return {
    issued: true,
    issuedOn: issued,
    lastUpdatedOn: updated,
    stale,
    staleByDays,
    findings,
  };
}

/**
 * Sections 4 and 8 — whether the Act applies, and to whom.
 *
 * The threshold is **five** migrant workmen, against the Contract Labour Act's
 * twenty. Establishments sit between the two routinely, which is the case this
 * reports next to the 1970 Act's own number rather than in place of it: two
 * different figures shown together is the only way anybody notices they differ.
 *
 * Measured on the *peak* over the preceding twelve months rather than on today,
 * because both sections are worded on "any day".
 *
 * @param {object} params
 * @param {number} params.migrantPeak highest migrant headcount in the last twelve months
 * @param {Array<object>} [params.contractors]
 * @param {object} [rules]
 * @returns {object}
 */
function assessApplicability(
  { migrantPeak, contractors = [], registered = false },
  rules,
) {
  const resolved = resolveRules(rules);

  const peak = Math.max(0, toNumber(migrantPeak));
  const findings = [];

  const applicable = peak >= resolved.registrationThreshold;

  if (!applicable) {
    findings.push(
      finding(
        FINDING.NOT_APPLICABLE,
        SEVERITY.INFORMATIONAL,
        `The highest migrant headcount in the preceding twelve months was ${peak}. Sections 4 and 8 start at ${resolved.registrationThreshold}.`,
        { migrantPeak: peak, threshold: resolved.registrationThreshold },
      ),
    );
  } else if (!registered) {
    findings.push(
      finding(
        FINDING.REGISTRATION_REQUIRED,
        SEVERITY.BREACH,
        `${peak} migrant workmen were engaged and the principal employer is not registered. Section 4's threshold is ${resolved.registrationThreshold}, against twenty under the Contract Labour Act.`,
        { migrantPeak: peak, threshold: resolved.registrationThreshold },
      ),
    );
  }

  const contractorRows = [];

  for (const contractor of Array.isArray(contractors) ? contractors : []) {
    const deployed = Math.max(0, toNumber(contractor?.migrantWorkmen));
    const licensed = contractor?.licensed === true;
    const needsLicence = deployed >= resolved.licensingThreshold;

    contractorRows.push({
      contractorId: contractor?.contractorId || null,
      name: contractor?.name || '',
      migrantWorkmen: deployed,
      needsLicence,
      licensed,
    });

    if (needsLicence && !licensed) {
      findings.push(
        finding(
          FINDING.CONTRACTOR_UNLICENSED,
          SEVERITY.BREACH,
          `${contractor?.name || 'A contractor'} has ${deployed} migrant workmen and no section 8 licence.`,
          {
            contractorId: contractor?.contractorId || null,
            migrantWorkmen: deployed,
          },
        ),
      );
    }
  }

  return {
    applicable,
    migrantPeak: peak,
    threshold: resolved.registrationThreshold,
    /** Shown beside it, so the two thresholds are visibly different numbers. */
    contractLabourThreshold: 20,
    registered: registered === true,
    contractors: contractorRows,
    findings,
  };
}

/**
 * One workman, end to end.
 *
 * @param {object} workman
 * @param {object} [rules]
 * @returns {object}
 */
function assessWorkman(workman, rules) {
  const resolved = resolveRules(rules);

  const parity = assessWageParity(
    {
      rates: workman?.rates || {},
      paidDailyRate: workman?.paidDailyRate,
      daysWorked: workman?.daysWorked,
    },
    resolved,
  );

  // Section 14's base is the monthly wages *payable*, which is the binding rate
  // rather than what was actually paid — an establishment underpaying the wage
  // should not also get a smaller displacement allowance out of it.
  const monthlyWages =
    workman?.monthlyWages !== undefined && workman?.monthlyWages !== null
      ? toNumber(workman.monthlyWages)
      : round2(parity.binding.rate * resolved.daysPerMonth);

  const displacement = displacementAllowance(
    {
      monthlyWages,
      paid: workman?.displacementPaid,
      recovered: workman?.displacementRecovered,
    },
    resolved,
  );

  const journey = journeyAllowance(
    {
      outwardFare: workman?.outwardFare,
      returnFare: workman?.returnFare,
      outwardJourneyDays: workman?.outwardJourneyDays,
      returnJourneyDays: workman?.returnJourneyDays,
      dailyWage: parity.binding.rate,
      outwardPaid: workman?.outwardPaid,
      returnPaid: workman?.returnPaid,
      returnAccrued: workman?.returnAccrued,
      journeyWagesPaid: workman?.journeyWagesPaid,
    },
    resolved,
  );

  const passbook = passbookState(
    {
      issuedOn: workman?.passbookIssuedOn,
      lastUpdatedOn: workman?.passbookUpdatedOn,
      rateChangedOn: workman?.rateChangedOn,
      asAt: workman?.asAt,
    },
    resolved,
  );

  const findings = [
    ...parity.findings,
    ...displacement.findings,
    ...journey.findings,
    ...passbook.findings,
  ].map((entry) => ({
    ...entry,
    workmanId: workman?.workmanId || null,
    workmanName: workman?.name || '',
  }));

  return {
    workmanId: workman?.workmanId || null,
    name: workman?.name || '',
    trade: workman?.trade || '',
    homeState: workman?.homeState || '',
    hostState: workman?.hostState || '',
    parity,
    monthlyWages: round2(monthlyWages),
    displacement,
    journey,
    passbook,
    /** What is owed to this workman today, across every limb. */
    outstanding: round2(
      parity.arrears + displacement.shortfall + journey.outstanding,
    ),
    findings,
  };
}

/**
 * The establishment.
 *
 * @param {object} params
 * @param {Array<object>} params.workmen
 * @param {object} [params.applicability]
 * @param {Array<object>} [params.facilities]
 * @param {object} [params.rules]
 * @returns {object}
 */
function assessEstablishment({
  workmen = [],
  applicability = {},
  facilities = [],
  rules,
} = {}) {
  const resolved = resolveRules(rules);

  const gate = assessApplicability(
    {
      migrantPeak:
        applicability?.migrantPeak !== undefined
          ? applicability.migrantPeak
          : workmen.length,
      contractors: applicability?.contractors,
      registered: applicability?.registered,
    },
    resolved,
  );

  const facilityResult = assessFacilities(facilities, resolved);

  const assessed = workmen.map((workman) => assessWorkman(workman, resolved));

  const findings = [
    ...gate.findings,
    ...facilityResult.findings,
    ...assessed.flatMap((row) => row.findings),
  ];

  const summary = new Map();
  for (const entry of findings) {
    const bucket = summary.get(entry.code) || {
      code: entry.code,
      section: entry.section,
      severity: entry.severity,
      count: 0,
      workmen: new Set(),
    };

    bucket.count += 1;
    if (entry.workmanId) bucket.workmen.add(String(entry.workmanId));
    summary.set(entry.code, bucket);
  }

  const sum = (pick) =>
    round2(assessed.reduce((total, row) => total + pick(row), 0));

  return {
    applicable: gate.applicable,
    applicability: gate,
    facilities: facilityResult,
    workmanCount: assessed.length,

    wageArrears: sum((row) => row.parity.arrears),
    /**
     * Split out because it is the number nobody else in the product can see: a
     * workman above every notified floor and below the colleague beside them.
     */
    parityOnlyCount: assessed.filter(
      (row) => row.parity.parityGap > 0 && row.parity.floorGap === 0,
    ).length,

    displacementDue: sum((row) => row.displacement.due),
    displacementShortfall: sum((row) => row.displacement.shortfall),
    journeyDue: sum((row) => row.journey.due),
    journeyOutstanding: sum((row) => row.journey.outstanding),
    /** Section 16's recoverable cost sits outside the per-workman totals. */
    facilityExposure: facilityResult.recoverableCost,

    outstanding: round2(
      sum((row) => row.outstanding) + facilityResult.recoverableCost,
    ),

    findings,
    summary: [...summary.values()].map((bucket) => ({
      code: bucket.code,
      section: bucket.section,
      severity: bucket.severity,
      count: bucket.count,
      workmanCount: bucket.workmen.size,
    })),
    workmen: assessed,
  };
}

module.exports = {
  MIGRANT_RULES,
  WAGE_BASIS,
  WAGE_BASIS_LABEL,
  FACILITY,
  FACILITY_LABEL,
  JOURNEY_LEG,
  FINDING,
  FINDING_SECTION,
  SEVERITY,
  resolveRules,
  bindingWageRate,
  assessWageParity,
  displacementAllowance,
  journeyAllowance,
  assessFacilities,
  passbookState,
  assessApplicability,
  assessWorkman,
  assessEstablishment,
};
