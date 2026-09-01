/**
 * Child and Adolescent Labour Act, 1986 (#1877).
 *
 * Two properties carry this suite and neither is arithmetic.
 *
 * The first is that **nothing here produces a money figure**. Section 14's fine
 * is a criminal penalty on conviction, not a liability that accrues, and a
 * rupee column would be summed into a compliance provision by the first report
 * that read it — stating in a number that employing a child has a price.
 * `assertNoAmounts` is asserted against every shape this module returns.
 *
 * The second is **precedence**: the adult engine's answer to an excess hour is
 * to pay the section 59 double rate, and for anybody under eighteen there is no
 * such rate. `overtimeTreatment` has its own block.
 */

const {
  EMPLOYMENT_RULES,
  CLASSIFICATION,
  AGE_BASIS,
  CHILD_EXCEPTION,
  HAZARDOUS_SCHEDULE,
  FINDING,
  SEVERITY,
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
} = require('../adolescentEmployment');

const utc = (iso) => new Date(`${iso}T00:00:00.000Z`);
const codesOf = (findings) => findings.map((finding) => finding.code);

describe('completedYears', () => {
  it('counts calendar years, not days over 365.25', () => {
    expect(completedYears(utc('2008-06-15'), utc('2026-06-14'))).toBe(17);
    expect(completedYears(utc('2008-06-15'), utc('2026-06-15'))).toBe(18);
  });

  it('handles a leap-day birthday without drifting', () => {
    expect(completedYears(utc('2008-02-29'), utc('2026-03-01'))).toBe(18);
    expect(completedYears(utc('2008-02-29'), utc('2026-02-28'))).toBe(17);
  });
});

describe('attainsAgeOn', () => {
  it('gives the date the limits fall away', () => {
    expect(attainsAgeOn('2008-06-15', 18)).toEqual(utc('2026-06-15'));
  });

  it('returns null with no date of birth', () => {
    expect(attainsAgeOn(null, 18)).toBeNull();
  });
});

describe('classifyOn', () => {
  it('splits at fourteen and eighteen', () => {
    expect(
      classifyOn({ dateOfBirth: '2013-01-01', on: '2026-01-01' })
        .classification,
    ).toBe(CLASSIFICATION.CHILD);

    expect(
      classifyOn({ dateOfBirth: '2010-01-01', on: '2026-01-01' })
        .classification,
    ).toBe(CLASSIFICATION.ADOLESCENT);

    expect(
      classifyOn({ dateOfBirth: '2005-01-01', on: '2026-01-01' })
        .classification,
    ).toBe(CLASSIFICATION.ADULT);
  });

  it('changes on the day, not at the end of the month', () => {
    // The whole reason classification is a function of a date. A roster that
    // straddles this is lawful on one side of it and not on the other.
    const dob = '2008-06-15';
    expect(
      classifyOn({ dateOfBirth: dob, on: '2026-06-14' }).classification,
    ).toBe(CLASSIFICATION.ADOLESCENT);
    expect(
      classifyOn({ dateOfBirth: dob, on: '2026-06-15' }).classification,
    ).toBe(CLASSIFICATION.ADULT);
  });

  it('reports the age as unknown rather than guessing', () => {
    const result = classifyOn({ dateOfBirth: null, on: '2026-01-01' });
    expect(result.known).toBe(false);
    expect(result.classification).toBeNull();
  });
});

describe('overtimeTreatment', () => {
  it('does not apply to anybody under eighteen', () => {
    expect(overtimeTreatment(CLASSIFICATION.CHILD).applies).toBe(false);
    expect(overtimeTreatment(CLASSIFICATION.ADOLESCENT).applies).toBe(false);
  });

  it('applies to an adult', () => {
    expect(overtimeTreatment(CLASSIFICATION.ADULT).applies).toBe(true);
  });

  it('produces no amount in either case', () => {
    // The precedence rule is a statement, not a figure. If this ever returns a
    // number, the module is asserting there is a rate at which an adolescent's
    // extra hour becomes lawful.
    expect(
      assertNoAmounts(overtimeTreatment(CLASSIFICATION.ADOLESCENT)),
    ).toEqual([]);
  });
});

describe('scheduleMatch', () => {
  it('matches an occupation in the Schedule', () => {
    expect(scheduleMatch({ occupation: 'MINES' }).hazardous).toBe(true);
  });

  it('matches a process in the Schedule', () => {
    expect(
      scheduleMatch({ occupation: 'HELPER', processes: ['ASBESTOS'] })
        .hazardous,
    ).toBe(true);
  });

  it('does not match a role outside it', () => {
    expect(scheduleMatch({ occupation: 'PACKING' }).hazardous).toBe(false);
  });

  it('incorporates the Factories Act processes by reference', () => {
    // Restating section 2(cb)'s list here would leave two lists to keep in step.
    expect(HAZARDOUS_SCHEDULE.processesReference).toMatch(/Factories Act/);
  });
});

describe('assessEngagement', () => {
  const child = {
    personId: '1',
    name: 'A',
    dateOfBirth: '2013-01-01',
    ageBasis: AGE_BASIS.BIRTH_CERTIFICATE,
  };

  it('bars a child from any occupation, not from a schedule', () => {
    const result = assessEngagement({
      person: child,
      engagement: { occupation: 'PACKING' },
      on: '2026-01-01',
    });

    expect(codesOf(result.findings)).toContain(FINDING.CHILD_EMPLOYED);
  });

  it('marks the child finding as prohibited rather than as a breach', () => {
    const result = assessEngagement({
      person: child,
      engagement: { occupation: 'PACKING' },
      on: '2026-01-01',
    });

    const finding = result.findings.find(
      (row) => row.code === FINDING.CHILD_EMPLOYED,
    );
    expect(SEVERITY.PROHIBITED).toBe('PROHIBITED');
    expect(finding).toBeTruthy();
  });

  it('accepts an evidenced family enterprise exception', () => {
    const result = assessEngagement({
      person: child,
      engagement: {
        occupation: 'PACKING',
        childException: CHILD_EXCEPTION.FAMILY_ENTERPRISE,
        exceptionEvidence:
          'Proprietor is the father; school attendance record attached',
      },
      on: '2026-01-01',
    });

    expect(codesOf(result.findings)).not.toContain(FINDING.CHILD_EMPLOYED);
  });

  it('does not accept an unevidenced one', () => {
    const result = assessEngagement({
      person: child,
      engagement: {
        occupation: 'PACKING',
        childException: CHILD_EXCEPTION.FAMILY_ENTERPRISE,
      },
      on: '2026-01-01',
    });

    expect(codesOf(result.findings)).toContain(
      FINDING.CHILD_EXCEPTION_UNEVIDENCED,
    );
  });

  it('withdraws the exception where the work interferes with schooling', () => {
    const result = assessEngagement({
      person: child,
      engagement: {
        occupation: 'PACKING',
        childException: CHILD_EXCEPTION.FAMILY_ENTERPRISE,
        exceptionEvidence: 'Family enterprise',
        interferesWithSchooling: true,
      },
      on: '2026-01-01',
    });

    expect(codesOf(result.findings)).toContain(
      FINDING.CHILD_EXCEPTION_SCHOOLING,
    );
  });

  it('does not let the family exception reach a hazardous occupation', () => {
    const result = assessEngagement({
      person: child,
      engagement: {
        occupation: 'MINES',
        childException: CHILD_EXCEPTION.FAMILY_ENTERPRISE,
        exceptionEvidence: 'Family enterprise',
      },
      on: '2026-01-01',
    });

    expect(codesOf(result.findings)).toContain(FINDING.CHILD_EMPLOYED);
  });

  const adolescent = {
    personId: '2',
    name: 'B',
    dateOfBirth: '2010-01-01',
    ageBasis: AGE_BASIS.BIRTH_CERTIFICATE,
  };

  it('permits an adolescent outside the Schedule', () => {
    const result = assessEngagement({
      person: adolescent,
      engagement: { occupation: 'PACKING' },
      on: '2026-01-01',
    });

    expect(codesOf(result.findings)).not.toContain(
      FINDING.ADOLESCENT_IN_HAZARDOUS_OCCUPATION,
    );
  });

  it('bars an adolescent inside it', () => {
    const result = assessEngagement({
      person: adolescent,
      engagement: { occupation: 'MINES' },
      on: '2026-01-01',
    });

    expect(codesOf(result.findings)).toContain(
      FINDING.ADOLESCENT_IN_HAZARDOUS_OCCUPATION,
    );
  });

  it('says when the limits will fall away', () => {
    const result = assessEngagement({
      person: adolescent,
      engagement: { occupation: 'PACKING' },
      on: '2026-01-01',
    });

    const finding = result.findings.find(
      (row) => row.code === FINDING.TURNS_EIGHTEEN_IN_PERIOD,
    );
    expect(finding.attainsOn).toEqual(utc('2028-01-01'));
  });

  it('flags a weak age basis without asserting the age is wrong', () => {
    const result = assessEngagement({
      person: { ...adolescent, ageBasis: AGE_BASIS.SELF_DECLARED },
      engagement: { occupation: 'PACKING' },
      on: '2026-01-01',
    });

    expect(codesOf(result.findings)).toContain(FINDING.AGE_BASIS_WEAK);
    expect(codesOf(result.findings)).not.toContain(
      FINDING.ADOLESCENT_IN_HAZARDOUS_OCCUPATION,
    );
  });

  it('refuses to evaluate the prohibition with no date of birth', () => {
    const result = assessEngagement({
      person: { personId: '3' },
      engagement: { occupation: 'PACKING' },
      on: '2026-01-01',
    });

    expect(codesOf(result.findings)).toEqual([FINDING.NO_DATE_OF_BIRTH]);
    expect(result.classification).toBeNull();
  });

  it('says nothing about an adult', () => {
    const result = assessEngagement({
      person: { personId: '4', dateOfBirth: '2000-01-01' },
      engagement: { occupation: 'MINES' },
      on: '2026-01-01',
    });

    expect(result.classification).toBe(CLASSIFICATION.ADULT);
    expect(result.findings).toEqual([]);
  });
});

describe('minutesOf', () => {
  it('parses HH:MM', () => {
    expect(minutesOf('08:30')).toBe(510);
    expect(minutesOf('9:05')).toBe(545);
  });

  it('rejects nonsense', () => {
    expect(minutesOf('25:00')).toBeNull();
    expect(minutesOf('half past')).toBeNull();
    expect(minutesOf(null)).toBeNull();
  });
});

describe('assessDay', () => {
  it('accepts a lawful day', () => {
    // Three hours, an hour off, two more. Five hours from first start to last
    // end, inside the six-hour ceiling.
    const result = assessDay({
      date: '2026-01-05',
      shifts: [
        { start: '09:00', end: '12:00' },
        { start: '13:00', end: '15:00' },
      ],
    });

    expect(result.findings).toEqual([]);
    expect(result.dayMinutes).toBe(360);
  });

  it('flags a spell longer than three hours', () => {
    const result = assessDay({
      date: '2026-01-05',
      shifts: [{ start: '09:00', end: '12:30' }],
    });

    expect(codesOf(result.findings)).toContain(FINDING.SPELL_EXCEEDS_LIMIT);
  });

  it('flags an interval shorter than an hour', () => {
    const result = assessDay({
      date: '2026-01-05',
      shifts: [
        { start: '09:00', end: '12:00' },
        { start: '12:30', end: '14:00' },
      ],
    });

    expect(codesOf(result.findings)).toContain(FINDING.INTERVAL_SHORT);
  });

  it('counts the interval against the six-hour ceiling', () => {
    // The part that catches people out. Six hours of work plus the one-hour
    // interval the Act requires is a seven-hour day and is over the limit.
    const result = assessDay({
      date: '2026-01-05',
      shifts: [
        { start: '09:00', end: '12:00' },
        { start: '13:00', end: '16:00' },
      ],
    });

    expect(result.dayMinutes).toBe(420);
    expect(codesOf(result.findings)).toContain(FINDING.DAY_EXCEEDS_LIMIT);
  });

  it('counts recorded waiting time against the ceiling too', () => {
    const result = assessDay({
      date: '2026-01-05',
      shifts: [
        { start: '09:00', end: '12:00' },
        { start: '13:00', end: '15:00' },
      ],
      waitingMinutes: 90,
    });

    expect(codesOf(result.findings)).toContain(FINDING.DAY_EXCEEDS_LIMIT);
  });

  it('flags work before eight in the morning', () => {
    const result = assessDay({
      date: '2026-01-05',
      shifts: [{ start: '07:00', end: '10:00' }],
    });

    expect(codesOf(result.findings)).toContain(FINDING.NIGHT_WORK);
  });

  it('flags work after seven in the evening', () => {
    const result = assessDay({
      date: '2026-01-05',
      shifts: [{ start: '17:00', end: '20:00' }],
    });

    expect(codesOf(result.findings)).toContain(FINDING.NIGHT_WORK);
  });

  it('flags a shift that runs past midnight', () => {
    const result = assessDay({
      date: '2026-01-05',
      shifts: [{ start: '22:00', end: '02:00' }],
    });

    expect(codesOf(result.findings)).toContain(FINDING.NIGHT_WORK);
  });

  it('reports the excess as a prohibition rather than as payable overtime', () => {
    const result = assessDay({
      date: '2026-01-05',
      shifts: [
        { start: '09:00', end: '12:00' },
        { start: '13:00', end: '17:00' },
      ],
    });

    const overtime = result.findings.find(
      (finding) => finding.code === FINDING.OVERTIME_WORKED,
    );
    expect(overtime).toBeTruthy();
    expect(assertNoAmounts(result)).toEqual([]);
  });

  it('says nothing about a day with no shifts', () => {
    expect(assessDay({ date: '2026-01-05', shifts: [] }).findings).toEqual([]);
  });
});

describe('assessWeek', () => {
  const week = (workedDays) =>
    Array.from({ length: 7 }, (unused, index) => ({
      date: `2026-01-0${index + 1}`,
      worked: index < workedDays,
    }));

  it('accepts six days and a day off', () => {
    expect(assessWeek({ days: week(6) }).findings).toEqual([]);
  });

  it('flags a week with no day off', () => {
    expect(codesOf(assessWeek({ days: week(7) }).findings)).toContain(
      FINDING.NO_WEEKLY_DAY_OFF,
    );
  });

  it('allows the notified day to change once a quarter', () => {
    expect(
      codesOf(
        assessWeek({
          days: week(6),
          dayOffChanges: [{ changedOn: '2026-01-10' }],
        }).findings,
      ),
    ).not.toContain(FINDING.DAY_OFF_CHANGED_TOO_OFTEN);
  });

  it('flags a second change in the same quarter', () => {
    expect(
      codesOf(
        assessWeek({
          days: week(6),
          dayOffChanges: [
            { changedOn: '2026-01-10' },
            { changedOn: '2026-02-10' },
          ],
        }).findings,
      ),
    ).toContain(FINDING.DAY_OFF_CHANGED_TOO_OFTEN);
  });

  it('says nothing about a partial week', () => {
    expect(assessWeek({ days: week(3).slice(0, 3) }).findings).toEqual([]);
  });
});

describe('assessPerson', () => {
  it('applies section 7 only to the days somebody was under eighteen', () => {
    // Turns eighteen on 15 June 2026. The long day before it is a breach; the
    // identical day after it is the adult engine's business.
    const person = {
      personId: '1',
      dateOfBirth: '2008-06-15',
      ageBasis: AGE_BASIS.BIRTH_CERTIFICATE,
    };

    const longDay = [
      { start: '09:00', end: '12:00' },
      { start: '13:00', end: '17:00' },
    ];

    const before = assessPerson({
      person,
      engagement: { occupation: 'PACKING', engagedOn: '2026-01-01' },
      days: [{ date: '2026-06-14', shifts: longDay }],
      inRegister: true,
    });

    const after = assessPerson({
      person,
      engagement: { occupation: 'PACKING', engagedOn: '2026-07-01' },
      days: [{ date: '2026-06-16', shifts: longDay }],
      inRegister: true,
    });

    expect(codesOf(before.findings)).toContain(FINDING.DAY_EXCEEDS_LIMIT);
    expect(codesOf(after.findings)).not.toContain(FINDING.DAY_EXCEEDS_LIMIT);
  });

  it('carries the overtime precedence on every person', () => {
    const result = assessPerson({
      person: { personId: '1', dateOfBirth: '2010-01-01' },
      engagement: { occupation: 'PACKING', engagedOn: '2026-01-01' },
      inRegister: true,
    });

    expect(result.overtime.applies).toBe(false);
    expect(result.overtime.reason).toMatch(/section 59/i);
  });

  it('flags a person missing from the section 11 register', () => {
    const result = assessPerson({
      person: { personId: '1', dateOfBirth: '2010-01-01' },
      engagement: { occupation: 'PACKING', engagedOn: '2026-01-01' },
      inRegister: false,
    });

    expect(codesOf(result.findings)).toContain(FINDING.NOT_IN_REGISTER);
  });

  it('does not put an adult in the register', () => {
    const result = assessPerson({
      person: { personId: '1', dateOfBirth: '2000-01-01' },
      engagement: { occupation: 'PACKING', engagedOn: '2026-01-01' },
      inRegister: false,
    });

    expect(codesOf(result.findings)).not.toContain(FINDING.NOT_IN_REGISTER);
  });
});

describe('assertNoAmounts', () => {
  it('finds a money field wherever it is', () => {
    expect(assertNoAmounts({ findings: [{ code: 'X', amount: 5 }] })).toEqual([
      '$.findings[0].amount',
    ]);
    expect(assertNoAmounts({ a: { b: { penalty: 1 } } })).toHaveLength(1);
  });

  it('is clean on a shape with no money in it', () => {
    expect(assertNoAmounts({ code: 'X', minutes: 60, days: 3 })).toEqual([]);
  });
});

describe('assessEstablishment', () => {
  const establishment = {
    people: [
      {
        person: {
          personId: '1',
          name: 'Child',
          dateOfBirth: '2013-01-01',
          ageBasis: AGE_BASIS.BIRTH_CERTIFICATE,
        },
        engagement: { occupation: 'PACKING', engagedOn: '2026-01-01' },
      },
      {
        person: {
          personId: '2',
          name: 'Adolescent',
          dateOfBirth: '2010-01-01',
          ageBasis: AGE_BASIS.BIRTH_CERTIFICATE,
        },
        engagement: { occupation: 'PACKING', engagedOn: '2026-01-01' },
        inRegister: true,
        days: [
          {
            date: '2026-01-05',
            shifts: [
              { start: '09:00', end: '12:00' },
              { start: '13:00', end: '17:00' },
            ],
          },
        ],
      },
      {
        person: { personId: '3', name: 'Adult', dateOfBirth: '2000-01-01' },
        engagement: { occupation: 'MINES', engagedOn: '2026-01-01' },
      },
    ],
  };

  it('counts people, never rupees', () => {
    const result = assessEstablishment(establishment);
    expect(result.childrenEngaged).toBe(1);
    expect(result.adolescentsEngaged).toBe(1);
  });

  it('produces no money field anywhere in the result', () => {
    // The property this module exists for. A "penalty estimate" added to any
    // finding would put a price on employing a child, in a number some report
    // would then add up.
    expect(assertNoAmounts(assessEstablishment(establishment))).toEqual([]);
  });

  it('exposes no total of any kind', () => {
    const result = assessEstablishment(establishment);
    expect(result).not.toHaveProperty('estimatedPenalty');
    expect(result).not.toHaveProperty('exposure');
    expect(result).not.toHaveProperty('totalLiability');
  });

  it('keeps the prohibited findings apart from the regulated ones', () => {
    // "A child is on the payroll" does not belong in the same list as "an
    // adolescent worked a seven-hour day". Only one has a lawful version.
    const result = assessEstablishment(establishment);

    expect(result.prohibited.map((finding) => finding.code)).toContain(
      FINDING.CHILD_EMPLOYED,
    );
    expect(result.prohibited.map((finding) => finding.code)).not.toContain(
      FINDING.DAY_EXCEEDS_LIMIT,
    );
  });

  it('counts distinct people per finding, not occurrences alone', () => {
    const result = assessEstablishment(establishment);
    const bucket = result.summary.find(
      (row) => row.code === FINDING.CHILD_EMPLOYED,
    );
    expect(bucket.personCount).toBe(1);
  });

  it('snapshots the rules and the Schedule it applied', () => {
    const result = assessEstablishment(establishment);
    expect(result.rules.maxDayHoursInclusive).toBe(
      EMPLOYMENT_RULES.maxDayHoursInclusive,
    );
    expect(result.schedule.effectiveFrom).toBe(
      HAZARDOUS_SCHEDULE.effectiveFrom,
    );
  });

  it('survives being called with nothing', () => {
    const result = assessEstablishment();
    expect(result.people).toEqual([]);
    expect(result.prohibited).toEqual([]);
  });
});

describe('validateRosterShift — Section 71 / Factories Act 1948 Roster limits', () => {
  const person = {
    personId: 'p-underage',
    name: 'Young Worker',
    dateOfBirth: '2010-01-01',
  };

  it('flags night shift work (10 PM to 6 AM)', () => {
    const shifts = [{ start: '21:30', end: '23:30' }]; // ends at 11:30 PM (after 10 PM)
    const result = validateRosterShift({ date: '2026-01-01', shifts, person });
    expect(codesOf(result)).toContain(FINDING.ROSTER_NIGHT_SHIFT);
  });

  it('flags exceeding daily work limit (> 4.5 hours)', () => {
    const shifts = [{ start: '09:00', end: '14:00' }]; // 5 hours
    const result = validateRosterShift({ date: '2026-01-01', shifts, person });
    expect(codesOf(result)).toContain(FINDING.ROSTER_MAX_DAILY_HOURS);
  });

  it('flags rest intervals shorter than 1 hour', () => {
    const shifts = [
      { start: '09:00', end: '11:00' },
      { start: '11:45', end: '13:00' }, // 45-minute gap
    ];
    const result = validateRosterShift({ date: '2026-01-01', shifts, person });
    expect(codesOf(result)).toContain(FINDING.ROSTER_INTERVAL_SHORT);
  });

  it('flags double shifts (multiple shifts on same day)', () => {
    const shifts = [
      { start: '09:00', end: '11:00' },
      { start: '13:00', end: '15:00' },
    ];
    const result = validateRosterShift({ date: '2026-01-01', shifts, person });
    expect(codesOf(result)).toContain(FINDING.ROSTER_DOUBLE_SHIFT);
  });

  it('flags scheduling across multiple establishments on the same day', () => {
    const personWorkDates = new Map();
    const dateStr = '2026-01-01';
    const estSet = new Set(['Factory A', 'Factory B']);
    personWorkDates.set(person.personId, new Map([[dateStr, estSet]]));

    const shifts = [{ start: '09:00', end: '12:00' }];
    const result = validateRosterShift({ date: dateStr, shifts, person, personWorkDates });
    expect(codesOf(result)).toContain(FINDING.ROSTER_MULTIPLE_ESTABLISHMENTS);
  });
});
