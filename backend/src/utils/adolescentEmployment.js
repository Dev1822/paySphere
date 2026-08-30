/**
 * Child and Adolescent Labour (Prohibition and Regulation) Act, 1986 (#1877).
 *
 * `workingHoursCompliance.js` implements the **adult** limits from the
 * Factories Act — nine hours a day, forty-eight a week, the spread-over, the
 * section 59 double rate for overtime. Those are the wrong limits for anybody
 * under eighteen, and an adolescent rostered for nine hours passes every check
 * in this product today. This module holds the right ones.
 *
 * **There is no amount anywhere in this file, and that is the feature.**
 *
 * An underage engagement has no compensable figure. Section 14 carries six
 * months to two years' imprisonment and a fine for employing a child; that is a
 * criminal penalty on conviction, not a liability that accrues, and it is not a
 * price. A rupee column here would be summed into a compliance provision by the
 * first report that read it, and the resulting line would state — in a number —
 * that employing a child costs a known amount. So the output of every function
 * below is an occurrence, a person, a date and a section. `assertNoAmounts` is
 * exported for the test that keeps it that way.
 *
 * Three more things shape it.
 *
 * **Two prohibitions, not one.** A child is anybody below fourteen and the bar
 * under section 3 is total — *any* occupation or process, with only the family
 * enterprise and audio-visual artist exceptions, both conditional on schooling.
 * An adolescent is fourteen to under eighteen and the bar under section 3A is
 * by Schedule: mines, inflammable substances and explosives, and the hazardous
 * processes under section 2(cb) of the Factories Act. Outside the Schedule an
 * adolescent may be employed, under section 7's limits. Collapsing the two into
 * one "underage" test would either bar lawful adolescent work or permit a child.
 *
 * **Age is a function of a date, and it moves.** Somebody engaged lawfully as
 * an adolescent turns eighteen during their employment and the limits fall away
 * on that date — not at the end of the month and not at the end of the year. So
 * `classifyOn` takes a date and the classification is recomputed per day rather
 * than stored on the person.
 *
 * **Overtime is not a rate here.** The adult engine's answer to excess hours is
 * to pay the section 59 double rate. For an adolescent section 7 prohibits
 * overtime outright, and there is no rate that makes the hour lawful.
 * `overtimeTreatment` states that precedence in code so a caller cannot reach
 * the wrong engine by default.
 *
 * Pure functions, no database access, matching how `workingHoursCompliance.js`
 * and `minimumWages.js` are written.
 */

/**
 * The two boundaries, as rules.
 *
 * The 2016 amendment moved the definitions and cut the Schedule substantially;
 * both have been amended before and belong in a dated rule set rather than in
 * constants, for the same reason the notified schedules in #1698 are dated.
 */
const EMPLOYMENT_RULES = {
  /** Below this age a person is a child. Section 2(ii). */
  childBelowAge: 14,
  /** From `childBelowAge` up to this age, an adolescent. Section 2(i). */
  adolescentBelowAge: 18,

  // --- Section 7 -----------------------------------------------------------

  /** No spell of work longer than this before an interval. Section 7(1). */
  maxSpellHours: 3,
  /** The interval that must follow a spell. Section 7(1). */
  minIntervalHours: 1,
  /**
   * The day's ceiling, **including** the interval and any waiting time.
   *
   * Inclusive is the part that catches people out: six hours of work plus a
   * one-hour interval is a seven-hour day and is over the limit.
   */
  maxDayHoursInclusive: 6,
  /** No work from this hour. Section 7(3). */
  nightBarFromHour: 19,
  /** ...until this one. Section 7(3). */
  nightBarToHour: 8,
  /** Section 7(4). Not a rate — a prohibition. */
  overtimePermitted: false,
  /** Section 7(5). */
  weeklyDaysOff: 1,
  /** The day off may not be changed more often than this. Section 7(5). */
  dayOffChangesPerQuarter: 1,
};

const CLASSIFICATION = {
  /** Below fourteen. Section 3 bars any occupation or process. */
  CHILD: 'CHILD',
  /** Fourteen to under eighteen. Section 3A bars the Schedule. */
  ADOLESCENT: 'ADOLESCENT',
  /** Eighteen and above. This module has nothing to say about them. */
  ADULT: 'ADULT',
};

/**
 * What the recorded age rests on.
 *
 * Section 10 makes the age determinable: where it is in question, the
 * certificate of the prescribed medical authority settles it. A date of birth
 * with nothing behind it is what an inspection asks about first, so the basis
 * is a stored field rather than an assumption — and `AGE_BASIS_STRENGTH`
 * below is what lets a finding say the record is weak without asserting the
 * person's age is wrong.
 */
const AGE_BASIS = {
  SELF_DECLARED: 'SELF_DECLARED',
  AADHAAR: 'AADHAAR',
  SCHOOL_CERTIFICATE: 'SCHOOL_CERTIFICATE',
  BIRTH_CERTIFICATE: 'BIRTH_CERTIFICATE',
  /** Section 10. The one that settles a dispute. */
  MEDICAL_CERTIFICATE: 'MEDICAL_CERTIFICATE',
};

const AGE_BASIS_STRENGTH = {
  [AGE_BASIS.SELF_DECLARED]: 0,
  [AGE_BASIS.AADHAAR]: 1,
  [AGE_BASIS.SCHOOL_CERTIFICATE]: 2,
  [AGE_BASIS.BIRTH_CERTIFICATE]: 3,
  [AGE_BASIS.MEDICAL_CERTIFICATE]: 4,
};

/**
 * The section 3 exceptions to the total bar on a child.
 *
 * Both are conditional and both have to be evidenced. "Helping in a family
 * enterprise" is not a job title somebody types; it is a claim about the
 * relationship, the hours and the schooling, and an unevidenced claim is a
 * finding of its own rather than a pass.
 */
const CHILD_EXCEPTION = {
  /** After school hours or during vacations, in a non-hazardous occupation. */
  FAMILY_ENTERPRISE: 'FAMILY_ENTERPRISE',
  /** An artist in an audio-visual entertainment, with the safeguards. */
  AUDIO_VISUAL_ARTIST: 'AUDIO_VISUAL_ARTIST',
};

/**
 * The Schedule under section 3A, as it stands after the 2016 amendment.
 *
 * Cut substantially in 2016 — it was a long list of occupations and processes
 * before that — so this is a seed with an effective date rather than a
 * constant. The section 2(cb) reference is deliberate: the hazardous processes
 * of the Factories Act are incorporated rather than restated, and restating
 * them here would leave two lists to keep in step.
 */
const HAZARDOUS_SCHEDULE = {
  effectiveFrom: '2016-09-01',
  occupations: ['MINES', 'INFLAMMABLE_SUBSTANCES', 'EXPLOSIVES'],
  /** Incorporated by reference from section 2(cb) of the Factories Act, 1948. */
  processesReference: 'Factories Act, 1948, section 2(cb)',
  processes: [
    'FACTORIES_ACT_HAZARDOUS_PROCESS',
    'ASBESTOS',
    'CHROMATE',
    'LEAD',
    'MERCURY',
    'PESTICIDES',
    'RADIOACTIVE_SUBSTANCES',
  ],
};

const FINDING = {
  CHILD_EMPLOYED: 'CHILD_EMPLOYED',
  CHILD_EXCEPTION_UNEVIDENCED: 'CHILD_EXCEPTION_UNEVIDENCED',
  CHILD_EXCEPTION_SCHOOLING: 'CHILD_EXCEPTION_SCHOOLING',
  ADOLESCENT_IN_HAZARDOUS_OCCUPATION: 'ADOLESCENT_IN_HAZARDOUS_OCCUPATION',
  SPELL_EXCEEDS_LIMIT: 'SPELL_EXCEEDS_LIMIT',
  INTERVAL_SHORT: 'INTERVAL_SHORT',
  DAY_EXCEEDS_LIMIT: 'DAY_EXCEEDS_LIMIT',
  NIGHT_WORK: 'NIGHT_WORK',
  OVERTIME_WORKED: 'OVERTIME_WORKED',
  NO_WEEKLY_DAY_OFF: 'NO_WEEKLY_DAY_OFF',
  DAY_OFF_CHANGED_TOO_OFTEN: 'DAY_OFF_CHANGED_TOO_OFTEN',
  AGE_BASIS_WEAK: 'AGE_BASIS_WEAK',
  NOT_IN_REGISTER: 'NOT_IN_REGISTER',
  TURNS_EIGHTEEN_IN_PERIOD: 'TURNS_EIGHTEEN_IN_PERIOD',
  NO_DATE_OF_BIRTH: 'NO_DATE_OF_BIRTH',
  ROSTER_NIGHT_SHIFT: 'ROSTER_NIGHT_SHIFT',
  ROSTER_MAX_DAILY_HOURS: 'ROSTER_MAX_DAILY_HOURS',
  ROSTER_INTERVAL_SHORT: 'ROSTER_INTERVAL_SHORT',
  ROSTER_DOUBLE_SHIFT: 'ROSTER_DOUBLE_SHIFT',
  ROSTER_MULTIPLE_ESTABLISHMENTS: 'ROSTER_MULTIPLE_ESTABLISHMENTS',
};

const FINDING_SECTION = {
  [FINDING.CHILD_EMPLOYED]: 'Section 3',
  [FINDING.CHILD_EXCEPTION_UNEVIDENCED]: 'Section 3, proviso',
  [FINDING.CHILD_EXCEPTION_SCHOOLING]: 'Section 3, proviso',
  [FINDING.ADOLESCENT_IN_HAZARDOUS_OCCUPATION]: 'Section 3A and the Schedule',
  [FINDING.SPELL_EXCEEDS_LIMIT]: 'Section 7(1)',
  [FINDING.INTERVAL_SHORT]: 'Section 7(1)',
  [FINDING.DAY_EXCEEDS_LIMIT]: 'Section 7(2)',
  [FINDING.NIGHT_WORK]: 'Section 7(3)',
  [FINDING.OVERTIME_WORKED]: 'Section 7(4)',
  [FINDING.NO_WEEKLY_DAY_OFF]: 'Section 7(5)',
  [FINDING.DAY_OFF_CHANGED_TOO_OFTEN]: 'Section 7(5), proviso',
  [FINDING.AGE_BASIS_WEAK]: 'Section 10',
  [FINDING.NOT_IN_REGISTER]: 'Section 11',
  [FINDING.TURNS_EIGHTEEN_IN_PERIOD]: 'Section 2(i)',
  [FINDING.NO_DATE_OF_BIRTH]: 'Section 10 and section 11',
  [FINDING.ROSTER_NIGHT_SHIFT]: 'Factories Act, Section 71(1)(b)',
  [FINDING.ROSTER_MAX_DAILY_HOURS]: 'Factories Act, Section 71(1)(a)',
  [FINDING.ROSTER_INTERVAL_SHORT]: 'Factories Act, Section 71(1)',
  [FINDING.ROSTER_DOUBLE_SHIFT]: 'Factories Act, Section 71(4)',
  [FINDING.ROSTER_MULTIPLE_ESTABLISHMENTS]: 'Factories Act, Section 71(5)',
};

const SEVERITY = {
  /** A prohibition was breached. There is no lawful version of this. */
  PROHIBITED: 'PROHIBITED',
  /** A regulation was breached. The work is permitted; this instance was not. */
  BREACH: 'BREACH',
  /** Worth a reader's attention and not itself a failure. */
  INFORMATIONAL: 'INFORMATIONAL',
};

const FINDING_SEVERITY = {
  [FINDING.CHILD_EMPLOYED]: SEVERITY.PROHIBITED,
  [FINDING.CHILD_EXCEPTION_UNEVIDENCED]: SEVERITY.PROHIBITED,
  [FINDING.CHILD_EXCEPTION_SCHOOLING]: SEVERITY.PROHIBITED,
  [FINDING.ADOLESCENT_IN_HAZARDOUS_OCCUPATION]: SEVERITY.PROHIBITED,
  [FINDING.SPELL_EXCEEDS_LIMIT]: SEVERITY.BREACH,
  [FINDING.INTERVAL_SHORT]: SEVERITY.BREACH,
  [FINDING.DAY_EXCEEDS_LIMIT]: SEVERITY.BREACH,
  [FINDING.NIGHT_WORK]: SEVERITY.BREACH,
  [FINDING.OVERTIME_WORKED]: SEVERITY.BREACH,
  [FINDING.NO_WEEKLY_DAY_OFF]: SEVERITY.BREACH,
  [FINDING.DAY_OFF_CHANGED_TOO_OFTEN]: SEVERITY.BREACH,
  [FINDING.AGE_BASIS_WEAK]: SEVERITY.INFORMATIONAL,
  [FINDING.NOT_IN_REGISTER]: SEVERITY.BREACH,
  [FINDING.TURNS_EIGHTEEN_IN_PERIOD]: SEVERITY.INFORMATIONAL,
  [FINDING.NO_DATE_OF_BIRTH]: SEVERITY.BREACH,
  [FINDING.ROSTER_NIGHT_SHIFT]: SEVERITY.PROHIBITED,
  [FINDING.ROSTER_MAX_DAILY_HOURS]: SEVERITY.PROHIBITED,
  [FINDING.ROSTER_INTERVAL_SHORT]: SEVERITY.PROHIBITED,
  [FINDING.ROSTER_DOUBLE_SHIFT]: SEVERITY.PROHIBITED,
  [FINDING.ROSTER_MULTIPLE_ESTABLISHMENTS]: SEVERITY.PROHIBITED,
};

// --- Dates and age ----------------------------------------------------------

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
 * Completed years between two dates.
 *
 * Calendar arithmetic rather than days divided by 365.25. A person born on
 * 29 February turns eighteen on 28 February in a common year under the general
 * rule that an age is attained on the day before the anniversary; the divide-
 * by-365.25 form gets that and every leap-year birthday wrong by a day, and a
 * day is the whole question on the boundary.
 *
 * @param {Date} dateOfBirth
 * @param {Date} on
 * @returns {number}
 */
function completedYears(dateOfBirth, on) {
  let years = on.getUTCFullYear() - dateOfBirth.getUTCFullYear();

  const monthDelta = on.getUTCMonth() - dateOfBirth.getUTCMonth();
  const dayDelta = on.getUTCDate() - dateOfBirth.getUTCDate();

  if (monthDelta < 0 || (monthDelta === 0 && dayDelta < 0)) years -= 1;

  return years;
}

/**
 * The date somebody attains an age.
 *
 * Needed because the limits fall away on a date rather than at the end of a
 * period, and a roster that straddles that date is lawful on one side of it and
 * not on the other.
 *
 * @param {Date|string} dateOfBirth
 * @param {number} age
 * @returns {Date|null}
 */
function attainsAgeOn(dateOfBirth, age) {
  const dob = toUtcDate(dateOfBirth);
  if (!dob) return null;

  return new Date(
    Date.UTC(dob.getUTCFullYear() + age, dob.getUTCMonth(), dob.getUTCDate()),
  );
}

/**
 * What a person is, on a date.
 *
 * Recomputed per date rather than stored on the person. Somebody engaged
 * lawfully as an adolescent turns eighteen during their employment and the
 * section 7 limits stop applying on that day — not at the end of the month, and
 * not when somebody remembers to update a field.
 *
 * @param {object} input
 * @param {Date|string} input.dateOfBirth
 * @param {Date|string} input.on
 * @param {object} [input.rules]
 * @returns {{classification: string|null, ageYears: number|null, known: boolean}}
 */
function classifyOn({ dateOfBirth, on, rules = EMPLOYMENT_RULES }) {
  const dob = toUtcDate(dateOfBirth);
  const date = toUtcDate(on);

  if (!dob || !date) {
    return { classification: null, ageYears: null, known: false };
  }

  const ageYears = completedYears(dob, date);

  if (ageYears < rules.childBelowAge) {
    return { classification: CLASSIFICATION.CHILD, ageYears, known: true };
  }
  if (ageYears < rules.adolescentBelowAge) {
    return { classification: CLASSIFICATION.ADOLESCENT, ageYears, known: true };
  }
  return { classification: CLASSIFICATION.ADULT, ageYears, known: true };
}

// --- Precedence -------------------------------------------------------------

/**
 * Whether the adult overtime computation applies to a person.
 *
 * Stated in code rather than left to the caller, because the caller's default
 * is `workingHoursCompliance.js` and that engine's answer to an excess hour is
 * to pay for it. For anybody under eighteen there is no rate that makes the
 * hour lawful, and a function that quietly returned a figure would be the
 * product asserting there is one.
 *
 * @param {string|null} classification
 * @returns {{applies: boolean, reason: string}}
 */
function overtimeTreatment(classification) {
  if (
    classification === CLASSIFICATION.CHILD ||
    classification === CLASSIFICATION.ADOLESCENT
  ) {
    return {
      applies: false,
      reason:
        'Section 7(4) prohibits overtime for a person under eighteen. There is no rate at which the hour becomes lawful, so the section 59 double-rate computation does not apply and no amount is produced.',
    };
  }

  return {
    applies: true,
    reason:
      'Eighteen or above. The Factories Act limits and the section 59 overtime rate apply as usual.',
  };
}

// --- The prohibitions -------------------------------------------------------

/**
 * Whether an occupation or process is in the Schedule under section 3A.
 *
 * Matches on the recorded codes rather than on free text. A role described as
 * "helper, furnace" is in a hazardous process and a substring search would not
 * know it; a code is a determination somebody made, which is the thing an
 * inspection can review.
 *
 * @param {object} input
 * @param {string} [input.occupation]
 * @param {Array<string>} [input.processes]
 * @param {object} [input.schedule]
 * @returns {{hazardous: boolean, matched: Array<string>}}
 */
function scheduleMatch({
  occupation,
  processes = [],
  schedule = HAZARDOUS_SCHEDULE,
}) {
  const matched = [];

  if (occupation && schedule.occupations.includes(occupation)) {
    matched.push(occupation);
  }

  for (const process of processes) {
    if (schedule.processes.includes(process)) matched.push(process);
  }

  return { hazardous: matched.length > 0, matched };
}

/**
 * The engagement test — may this person be engaged in this work at all.
 *
 * Returns findings and never a permission. A caller that wants "is this
 * lawful" reads `findings.length === 0`, which forces it to look at what the
 * findings are rather than at a boolean somebody could invert.
 *
 * @param {object} input
 * @param {object} input.person
 * @param {object} input.engagement
 * @param {Date|string} input.on
 * @param {object} [input.schedule]
 * @param {object} [input.rules]
 * @returns {{classification: string|null, findings: Array<object>}}
 */
function assessEngagement({
  person,
  engagement,
  on,
  schedule = HAZARDOUS_SCHEDULE,
  rules = EMPLOYMENT_RULES,
}) {
  const findings = [];
  const { classification, ageYears, known } = classifyOn({
    dateOfBirth: person?.dateOfBirth,
    on,
    rules,
  });

  if (!known) {
    findings.push({
      code: FINDING.NO_DATE_OF_BIRTH,
      note: 'No date of birth on record. The prohibition turns on age and cannot be evaluated at all, which is not the same as the engagement being lawful.',
    });
    return { classification: null, ageYears: null, findings };
  }

  // Section 10. Recorded as informational: a weak basis does not make the
  // person younger, it makes the record indefensible on inspection.
  const basis = person?.ageBasis || AGE_BASIS.SELF_DECLARED;
  if (
    classification !== CLASSIFICATION.ADULT &&
    (AGE_BASIS_STRENGTH[basis] ?? 0) <
      AGE_BASIS_STRENGTH[AGE_BASIS.SCHOOL_CERTIFICATE]
  ) {
    findings.push({
      code: FINDING.AGE_BASIS_WEAK,
      basis,
      note: 'The age of a person under eighteen rests on a self-declaration or an Aadhaar record. Section 10 makes the certificate of the prescribed medical authority the thing that settles a dispute.',
    });
  }

  if (classification === CLASSIFICATION.CHILD) {
    const exception = engagement?.childException;

    if (!exception) {
      findings.push({
        code: FINDING.CHILD_EMPLOYED,
        ageYears,
        occupation: engagement?.occupation,
        note: 'Section 3 bars the employment of a child in any occupation or process. There is no lawful amount and no permitted variant of this engagement.',
      });
      return { classification, ageYears, findings };
    }

    if (!CHILD_EXCEPTION[exception]) {
      findings.push({
        code: FINDING.CHILD_EMPLOYED,
        ageYears,
        note: 'An exception was claimed that is not one of the two the proviso allows.',
      });
      return { classification, ageYears, findings };
    }

    // Both exceptions are claims about a relationship and about schooling, not
    // job titles. An unevidenced claim is a finding rather than a pass.
    if (!engagement?.exceptionEvidence) {
      findings.push({
        code: FINDING.CHILD_EXCEPTION_UNEVIDENCED,
        exception,
        note: 'The exception is claimed and nothing supports it. Helping in a family enterprise is a claim about the relationship, the hours and the schooling; an audio-visual engagement requires the prescribed safeguards.',
      });
    }

    if (engagement?.interferesWithSchooling) {
      findings.push({
        code: FINDING.CHILD_EXCEPTION_SCHOOLING,
        exception,
        note: 'Both exceptions are conditional on the work not interfering with schooling. Where it does, the exception is unavailable and section 3 applies in full.',
      });
    }

    // A family enterprise exception does not reach a hazardous occupation.
    const scheduleResult = scheduleMatch({
      occupation: engagement?.occupation,
      processes: engagement?.processes,
      schedule,
    });

    if (
      exception === CHILD_EXCEPTION.FAMILY_ENTERPRISE &&
      scheduleResult.hazardous
    ) {
      findings.push({
        code: FINDING.CHILD_EMPLOYED,
        ageYears,
        matched: scheduleResult.matched,
        note: 'The family enterprise exception reaches non-hazardous occupations only.',
      });
    }

    return { classification, ageYears, findings };
  }

  if (classification === CLASSIFICATION.ADOLESCENT) {
    const scheduleResult = scheduleMatch({
      occupation: engagement?.occupation,
      processes: engagement?.processes,
      schedule,
    });

    if (scheduleResult.hazardous) {
      findings.push({
        code: FINDING.ADOLESCENT_IN_HAZARDOUS_OCCUPATION,
        ageYears,
        matched: scheduleResult.matched,
        note: 'Section 3A bars an adolescent from the occupations and processes in the Schedule. Outside the Schedule the engagement is permitted, under the section 7 limits.',
      });
    }

    const eighteenth = attainsAgeOn(
      person?.dateOfBirth,
      rules.adolescentBelowAge,
    );
    findings.push({
      code: FINDING.TURNS_EIGHTEEN_IN_PERIOD,
      attainsOn: eighteenth,
      note: 'The section 7 limits fall away on this date and the ordinary adult limits begin. A roster straddling it is lawful on one side and not on the other.',
    });
  }

  return { classification, ageYears, findings };
}

// --- Section 7 --------------------------------------------------------------

/**
 * Minutes from midnight for an `HH:MM` string.
 *
 * @param {string} value
 * @returns {number|null}
 */
function minutesOf(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 24 || minutes > 59) return null;

  return hours * 60 + minutes;
}

/**
 * A day of work against section 7.
 *
 * The six-hour ceiling is **inclusive of the interval and any waiting time**,
 * which is the part that catches people out: six hours of work plus the
 * one-hour interval the Act requires is a seven-hour day and is over the limit.
 * So the day is measured from the first start to the last end rather than by
 * adding the spells.
 *
 * @param {object} input
 * @param {Date|string} input.date
 * @param {Array<{start: string, end: string}>} input.shifts
 * @param {number} [input.waitingMinutes]
 * @param {object} [input.rules]
 * @returns {{findings: Array<object>, spans: Array<object>, dayMinutes: number}}
 */
function assessDay({
  date,
  shifts,
  waitingMinutes = 0,
  rules = EMPLOYMENT_RULES,
}) {
  const findings = [];

  const spans = (shifts || [])
    .map((shift) => ({
      start: minutesOf(shift?.start),
      end: minutesOf(shift?.end),
    }))
    .filter((span) => span.start !== null && span.end !== null)
    .map((span) => ({
      ...span,
      // A shift ending after midnight is expressed as an end before its start.
      // Normalising here rather than rejecting it keeps the night-work finding
      // reachable, which is the finding such a shift most needs.
      end: span.end <= span.start ? span.end + 24 * 60 : span.end,
    }))
    .sort((a, b) => a.start - b.start);

  if (spans.length === 0) {
    return { findings, spans, dayMinutes: 0 };
  }

  for (const span of spans) {
    const minutes = span.end - span.start;

    if (minutes > rules.maxSpellHours * 60) {
      findings.push({
        code: FINDING.SPELL_EXCEEDS_LIMIT,
        date,
        minutes,
        limitMinutes: rules.maxSpellHours * 60,
        note: 'Section 7(1) allows no spell longer than three hours before an interval of at least one hour.',
      });
    }

    // Section 7(3). The bar runs from 7 p.m. to 8 a.m., so a span touches it if
    // it starts before 8 a.m., ends after 7 p.m., or runs past midnight.
    const startsEarly = span.start < rules.nightBarToHour * 60;
    const endsLate = span.end > rules.nightBarFromHour * 60;

    if (startsEarly || endsLate) {
      findings.push({
        code: FINDING.NIGHT_WORK,
        date,
        start: span.start,
        end: span.end,
        note: 'Section 7(3) prohibits work between 7 p.m. and 8 a.m. for a person under eighteen.',
      });
    }
  }

  for (let index = 1; index < spans.length; index += 1) {
    const gap = spans[index].start - spans[index - 1].end;

    if (gap < rules.minIntervalHours * 60) {
      findings.push({
        code: FINDING.INTERVAL_SHORT,
        date,
        gapMinutes: Math.max(0, gap),
        requiredMinutes: rules.minIntervalHours * 60,
        note: 'Section 7(1) requires an interval of at least one hour between spells.',
      });
    }
  }

  // First start to last end, plus recorded waiting time. Not the sum of the
  // spells — the interval counts against the ceiling.
  const dayMinutes =
    spans[spans.length - 1].end - spans[0].start + Math.max(0, waitingMinutes);

  if (dayMinutes > rules.maxDayHoursInclusive * 60) {
    findings.push({
      code: FINDING.DAY_EXCEEDS_LIMIT,
      date,
      minutes: dayMinutes,
      limitMinutes: rules.maxDayHoursInclusive * 60,
      note: 'Section 7(2) caps the day at six hours including the interval and any waiting time. Six hours of work plus the required one-hour interval is already over.',
    });
  }

  // Section 7(4). Not a rate. `overtimeTreatment` says why no amount follows.
  if (
    !rules.overtimePermitted &&
    dayMinutes > rules.maxDayHoursInclusive * 60
  ) {
    findings.push({
      code: FINDING.OVERTIME_WORKED,
      date,
      minutes: dayMinutes - rules.maxDayHoursInclusive * 60,
      note: 'Section 7(4) prohibits overtime outright. The section 59 double rate does not apply and there is no amount that makes these minutes lawful.',
    });
  }

  return { findings, spans, dayMinutes };
}

/**
 * A week against section 7(5).
 *
 * @param {object} input
 * @param {Array<{date: Date|string, worked: boolean}>} input.days
 * @param {Array<{changedOn: Date|string}>} [input.dayOffChanges]
 * @param {object} [input.rules]
 * @returns {{findings: Array<object>, daysWorked: number}}
 */
function assessWeek({ days, dayOffChanges = [], rules = EMPLOYMENT_RULES }) {
  const findings = [];

  const worked = (days || []).filter((day) => day.worked).length;
  const total = (days || []).length;

  if (total >= 7 && total - worked < rules.weeklyDaysOff) {
    findings.push({
      code: FINDING.NO_WEEKLY_DAY_OFF,
      daysWorked: worked,
      note: 'Section 7(5) requires a whole day off each week, on a day fixed and notified in advance.',
    });
  }

  if (dayOffChanges.length > rules.dayOffChangesPerQuarter) {
    findings.push({
      code: FINDING.DAY_OFF_CHANGED_TOO_OFTEN,
      changes: dayOffChanges.length,
      limit: rules.dayOffChangesPerQuarter,
      note: 'The proviso to section 7(5) allows the notified day to be changed once a quarter.',
    });
  }

  return { findings, daysWorked: worked };
}

// --- Assessment -------------------------------------------------------------

/**
 * Validates a scheduled shift roster for an adolescent under Section 71 of the Factories Act, 1948.
 *
 * @param {object} input
 * @param {Date|string} input.date
 * @param {Array<{start: string, end: string}>} input.shifts
 * @param {object} input.person
 * @param {Map} [input.personWorkDates]
 * @returns {Array<object>} array of violation findings
 */
function validateRosterShift({ date, shifts, person, personWorkDates }) {
  const findings = [];
  const dob = person?.dateOfBirth;
  if (!dob) return findings;

  const { classification } = classifyOn({ dateOfBirth: dob, on: date });
  if (classification !== CLASSIFICATION.ADOLESCENT && classification !== CLASSIFICATION.CHILD) {
    return findings;
  }

  const spans = (shifts || [])
    .map((shift) => ({
      start: minutesOf(shift?.start),
      end: minutesOf(shift?.end),
    }))
    .filter((span) => span.start !== null && span.end !== null)
    .map((span) => ({
      ...span,
      end: span.end <= span.start ? span.end + 24 * 60 : span.end,
    }))
    .sort((a, b) => a.start - b.start);

  if (spans.length === 0) {
    return findings;
  }

  // 1. Night shift: 10 PM (22:00) to 6 AM (06:00).
  for (const span of spans) {
    const startsInNight = span.start < 6 * 60;
    const endsInNight = span.end > 22 * 60;

    if (startsInNight || endsInNight) {
      findings.push({
        code: FINDING.ROSTER_NIGHT_SHIFT,
        date,
        note: 'Adolescents are prohibited from night shifts between 10 PM and 6 AM.',
      });
    }
  }

  // 2. Max work hours: 4.5 hours (270 minutes) per day.
  let totalWorkMinutes = 0;
  for (const span of spans) {
    totalWorkMinutes += (span.end - span.start);
  }

  if (totalWorkMinutes > 4.5 * 60) {
    findings.push({
      code: FINDING.ROSTER_MAX_DAILY_HOURS,
      date,
      minutes: totalWorkMinutes,
      limitMinutes: 4.5 * 60,
      note: 'Total daily work hours for an adolescent cannot exceed 4.5 hours.',
    });
  }

  // 3. Mandatory rest interval of at least 1 hour (60 minutes).
  for (let i = 1; i < spans.length; i++) {
    const gap = spans[i].start - spans[i - 1].end;
    if (gap < 60) {
      findings.push({
        code: FINDING.ROSTER_INTERVAL_SHORT,
        date,
        gapMinutes: gap,
        requiredMinutes: 60,
        note: 'Mandatory rest interval of at least 1 hour is required between shifts.',
      });
    }
  }

  // 4. Double shifts check.
  if (spans.length > 1) {
    findings.push({
      code: FINDING.ROSTER_DOUBLE_SHIFT,
      date,
      note: 'Adolescents are prohibited from working double shifts.',
    });
  }

  // 5. Multiple establishments check.
  if (personWorkDates) {
    const dateStr = new Date(date).toISOString().split('T')[0];
    const estSet = personWorkDates.get(String(person.personId || person._id))?.get(dateStr);
    if (estSet && estSet.size > 1) {
      findings.push({
        code: FINDING.ROSTER_MULTIPLE_ESTABLISHMENTS,
        date,
        note: `Adolescent worker scheduled in multiple establishments on the same day: ${Array.from(estSet).join(', ')}.`,
      });
    }
  }

  return findings;
}

// --- Assessment -------------------------------------------------------------

/**
 * Everything for one person over a period.
 *
 * @param {object} input
 * @param {object} input.person
 * @param {object} input.engagement
 * @param {Array<object>} [input.days]
 * @param {Array<object>} [input.dayOffChanges]
 * @param {boolean} [input.inRegister]
 * @param {Map} [input.personWorkDates]
 * @param {object} [input.schedule]
 * @param {object} [input.rules]
 * @returns {object}
 */
function assessPerson({
  person,
  engagement,
  days = [],
  dayOffChanges = [],
  inRegister = false,
  personWorkDates,
  schedule = HAZARDOUS_SCHEDULE,
  rules = EMPLOYMENT_RULES,
}) {
  const engagementResult = assessEngagement({
    person,
    engagement,
    on: engagement?.engagedOn || days[0]?.date || new Date(),
    schedule,
    rules,
  });

  const findings = [...engagementResult.findings];

  // Section 7 reaches only a person under eighteen, and only on the days they
  // were under eighteen. Somebody who turned eighteen mid-period is measured
  // against these limits for the earlier days and against the adult engine's
  // for the later ones — which is why the classification is recomputed per day.
  for (const day of days) {
    const onDay = classifyOn({
      dateOfBirth: person?.dateOfBirth,
      on: day.date,
      rules,
    });

    if (
      onDay.classification !== CLASSIFICATION.CHILD &&
      onDay.classification !== CLASSIFICATION.ADOLESCENT
    ) {
      continue;
    }

    const dayResult = assessDay({
      date: day.date,
      shifts: day.shifts,
      waitingMinutes: day.waitingMinutes,
      rules,
    });

    findings.push(...dayResult.findings);

    const rosterViolations = validateRosterShift({
      date: day.date,
      shifts: day.shifts,
      person,
      personWorkDates,
    });

    findings.push(...rosterViolations);
  }

  const weekResult = assessWeek({ days, dayOffChanges, rules });
  findings.push(...weekResult.findings);

  // Section 11. The register's subject is who these people are, which the
  // attendance ledger cannot answer — it records whether somebody came in.
  if (
    !inRegister &&
    (engagementResult.classification === CLASSIFICATION.CHILD ||
      engagementResult.classification === CLASSIFICATION.ADOLESCENT)
  ) {
    findings.push({
      code: FINDING.NOT_IN_REGISTER,
      note: 'Section 11 requires a register of the children and adolescents employed, kept at the establishment, with the date of birth, hours, intervals and the nature of the work.',
    });
  }

  return {
    personId: person?.personId,
    name: person?.name,
    dateOfBirth: person?.dateOfBirth,
    ageBasis: person?.ageBasis || AGE_BASIS.SELF_DECLARED,
    classification: engagementResult.classification,
    ageYears: engagementResult.ageYears,
    /** Stated per person so the caller cannot reach the adult engine by default. */
    overtime: overtimeTreatment(engagementResult.classification),
    daysWorked: weekResult.daysWorked,
    findings: findings.map((finding) => ({
      ...finding,
      section: FINDING_SECTION[finding.code],
      severity: FINDING_SEVERITY[finding.code],
    })),
  };
}

/**
 * Assert that nothing in a result carries a money field.
 *
 * Exported so the unit suite can hold the property the module exists for. A
 * future change adding a "penalty estimate" or an "exposure" to any finding is
 * the change this catches — and that change would put a price on employing a
 * child, in a number some report would then add up.
 *
 * @param {*} value
 * @returns {Array<string>} The offending paths, empty when clean.
 */
function assertNoAmounts(value, path = '') {
  const banned =
    /^(amount|amounts|cost|costs|penalty|penalties|fine|fines|exposure|liability|payable|provision|value|rupees|inr)$/i;
  const offenders = [];

  const walk = (node, at) => {
    if (node === null || typeof node !== 'object') return;

    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${at}[${index}]`));
      return;
    }

    for (const [key, child] of Object.entries(node)) {
      if (banned.test(key)) offenders.push(`${at}.${key}`);
      walk(child, `${at}.${key}`);
    }
  };

  walk(value, path || '$');
  return offenders;
}

/**
 * Assess an establishment.
 *
 * The prohibited findings are returned first and separately from the regulated
 * ones. A page that mixed them would let "an adolescent worked a seven-hour
 * day" and "a child is on the payroll" sort next to each other by date, and
 * only one of those has a lawful version.
 *
 * @param {object} input
 * @param {Array<object>} input.people
 * @param {object} [input.schedule]
 * @param {object} [input.rules]
 * @returns {object}
 */
function assessEstablishment({ people, schedule, rules } = {}) {
  const resolvedRules = { ...EMPLOYMENT_RULES, ...(rules || {}) };
  const resolvedSchedule = schedule || HAZARDOUS_SCHEDULE;

  const assessed = (people || []).map((entry) =>
    assessPerson({
      person: entry.person || entry,
      engagement: entry.engagement || {},
      days: entry.days || [],
      dayOffChanges: entry.dayOffChanges || [],
      inRegister: entry.inRegister,
      schedule: resolvedSchedule,
      rules: resolvedRules,
    }),
  );

  const findings = assessed.flatMap((row) =>
    row.findings.map((finding) => ({
      ...finding,
      personId: row.personId,
      name: row.name,
      classification: row.classification,
    })),
  );

  const prohibited = findings.filter(
    (finding) => finding.severity === SEVERITY.PROHIBITED,
  );

  const summary = new Map();
  for (const finding of findings) {
    const bucket = summary.get(finding.code) || {
      code: finding.code,
      section: finding.section,
      severity: finding.severity,
      count: 0,
      people: new Set(),
    };
    bucket.count += 1;
    bucket.people.add(String(finding.personId));
    summary.set(finding.code, bucket);
  }

  return {
    rules: resolvedRules,
    schedule: resolvedSchedule,
    people: assessed,

    /** Counts of people, never of rupees. */
    childrenEngaged: assessed.filter(
      (row) => row.classification === CLASSIFICATION.CHILD,
    ).length,
    adolescentsEngaged: assessed.filter(
      (row) => row.classification === CLASSIFICATION.ADOLESCENT,
    ).length,

    /**
     * The findings with no lawful version, kept apart from the regulated ones.
     * A child on the payroll does not belong in the same list as an adolescent
     * who worked a long day.
     */
    prohibited,
    findings,
    summary: [...summary.values()].map((bucket) => ({
      code: bucket.code,
      section: bucket.section,
      severity: bucket.severity,
      count: bucket.count,
      personCount: bucket.people.size,
    })),
  };

  // Deliberately no `estimatedPenalty`, no `exposure` and no total of any kind.
  // Section 14's fine is a criminal penalty on conviction, not a liability that
  // accrues, and a rupee figure here would be summed into a compliance
  // provision by the first report that read it. `assertNoAmounts` holds this.
}

module.exports = {
  EMPLOYMENT_RULES,
  CLASSIFICATION,
  AGE_BASIS,
  AGE_BASIS_STRENGTH,
  CHILD_EXCEPTION,
  HAZARDOUS_SCHEDULE,
  FINDING,
  FINDING_SECTION,
  FINDING_SEVERITY,
  SEVERITY,
  toUtcDate,
  completedYears,
  attainsAgeOn,
  classifyOn,
  overtimeTreatment,
  scheduleMatch,
  assessEngagement,
  minutesOf,
  assessDay,
  assessWeek,
  assessPerson,
  validateRosterShift,
  assertNoAmounts,
  assessEstablishment,
};
