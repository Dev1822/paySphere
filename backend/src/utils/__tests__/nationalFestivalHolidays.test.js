/**
 * National and Festival Holidays Acts (#1970).
 *
 * The assertions that matter are the ones a configurable holiday list cannot
 * make: that the three national holidays are refused a substitution rather than
 * given one, that a holiday worked is a whole day regardless of hours and does
 * not touch the overtime quota, that the list obligation fires before the year
 * it governs, and that a forfeited holiday can be explained from the attendance
 * it was computed against.
 *
 * `HOLIDAY_WORK_IS_NOT_OVERTIME` has its own block. Routing a holiday worked
 * through the overtime multiplier underpays the short day *and* consumes a
 * statutory quota it should not touch, and both errors look like arithmetic
 * rather than like a category mistake.
 */

const {
  KIND,
  TREATMENT,
  FINDING,
  SEVERITY,
  HOLIDAY_WORK_IS_NOT_OVERTIME,
  NATIONAL_HOLIDAYS_ARE_NOT_SUBSTITUTABLE,
  daysBetween,
  resolveRules,
  nationalHolidaysFor,
  substitutionPermitted,
  eligibility,
  holidayWagePosition,
  listObligation,
  assessYear,
} = require('../nationalFestivalHolidays');

const utc = (iso) => new Date(`${iso}T00:00:00.000Z`);
const codesOf = (findings) => findings.map((finding) => finding.code);

describe('resolveRules', () => {
  it('returns the seeded rules for a state', () => {
    const rules = resolveRules('TN');
    expect(rules.festivalHolidayCount).toBe(4);
    expect(rules.absentEitherSideForfeits).toBe(true);
  });

  it('returns null for an unseeded state rather than a national default', () => {
    // The festival count, the qualifying-days condition and the forfeiture rule
    // genuinely differ. A default that got any of them wrong would change wages
    // with nothing objecting.
    expect(resolveRules('XX')).toBeNull();
  });

  it('lets an override extend a state that is not seeded', () => {
    const rules = resolveRules('XX', {
      XX: { state: 'XX', festivalHolidayCount: 6 },
    });
    expect(rules.festivalHolidayCount).toBe(6);
  });

  it('lets an override change one field of a seeded state', () => {
    const rules = resolveRules('TN', { TN: { festivalHolidayCount: 5 } });
    expect(rules.festivalHolidayCount).toBe(5);
    expect(rules.absentEitherSideForfeits).toBe(true);
  });
});

describe('nationalHolidaysFor', () => {
  it('is the same three dates every year', () => {
    const holidays = nationalHolidaysFor(2026);
    expect(holidays.map((h) => h.date.toISOString().slice(0, 10))).toEqual([
      '2026-01-26',
      '2026-08-15',
      '2026-10-02',
    ]);
  });

  it('marks all three as not substitutable', () => {
    expect(
      nationalHolidaysFor(2026).every((h) => h.substitutable === false),
    ).toBe(true);
  });
});

describe('substitutionPermitted', () => {
  it('refuses a national holiday even with an agreement', () => {
    // This is the whole reason the two kinds are different rows. A list where
    // they behave the same will eventually swap Independence Day for a Friday
    // before a long weekend.
    const result = substitutionPermitted({
      holiday: { kind: KIND.NATIONAL },
      agreement: { agreedOn: '2026-01-10' },
    });

    expect(result.permitted).toBe(false);
    expect(result.reason).toBe(NATIONAL_HOLIDAYS_ARE_NOT_SUBSTITUTABLE);
  });

  it('refuses a festival holiday without an agreement', () => {
    const result = substitutionPermitted({ holiday: { kind: KIND.FESTIVAL } });
    expect(result.permitted).toBe(false);
    expect(result.authority).toBe('Section 4');
  });

  it('permits a festival holiday with an agreement', () => {
    const result = substitutionPermitted({
      holiday: { kind: KIND.FESTIVAL },
      agreement: { agreedOn: '2026-03-01' },
    });
    expect(result.permitted).toBe(true);
  });
});

describe('eligibility', () => {
  const rules = resolveRules('TN');

  const attendance = [
    { date: '2026-01-23', present: true, working: true },
    { date: '2026-01-24', present: true, working: true },
    { date: '2026-01-25', present: false, working: false },
    { date: '2026-01-27', present: true, working: true },
  ];

  it('forfeits where the employee was absent on both working days either side', () => {
    const result = eligibility({
      holiday: { date: '2026-01-26' },
      attendance: [
        { date: '2026-01-24', present: false, working: true },
        { date: '2026-01-25', present: false, working: false },
        { date: '2026-01-27', present: false, working: true },
      ],
      rules: { ...rules, qualifyingDaysInPrecedingPeriod: 0 },
    });

    expect(result.absentEitherSide).toBe(true);
    expect(result.entitled).toBe(false);
    // Returned so the deduction can be explained to the person who bore it.
    expect(result.dayBefore.date).toEqual(utc('2026-01-24'));
    expect(result.dayAfter.date).toEqual(utc('2026-01-27'));
  });

  it('looks at the working day either side rather than the calendar day', () => {
    // An employee whose weekly off falls the day before the holiday has not
    // been absent, and a calendar-day test would forfeit their wages for it.
    const result = eligibility({
      holiday: { date: '2026-01-26' },
      attendance,
      rules: { ...rules, qualifyingDaysInPrecedingPeriod: 0 },
    });

    expect(result.dayBefore.date).toEqual(utc('2026-01-24'));
    expect(result.absentEitherSide).toBe(false);
    expect(result.entitled).toBe(true);
  });

  it('applies the qualifying-days condition', () => {
    const result = eligibility({
      holiday: { date: '2026-01-26' },
      attendance,
      rules,
    });

    expect(result.qualified).toBe(false);
    expect(result.qualifyingDaysRequired).toBe(30);
    expect(result.reason).toMatch(/qualifying days/i);
  });

  it('does not forfeit in a state that has no forfeiture rule', () => {
    const result = eligibility({
      holiday: { date: '2026-01-26' },
      attendance: [
        { date: '2026-01-24', present: false, working: true },
        { date: '2026-01-27', present: false, working: true },
      ],
      rules: resolveRules('KA'),
    });

    expect(result.absentEitherSide).toBe(false);
  });
});

describe('holidayWagePosition', () => {
  const rules = resolveRules('TN');

  it('owes a whole day at double rate however few hours were worked', () => {
    const four = holidayWagePosition({
      holiday: { kind: KIND.NATIONAL, date: '2026-01-26' },
      dailyWage: 1000,
      hoursWorked: 4,
      rules,
    });
    const ten = holidayWagePosition({
      holiday: { kind: KIND.NATIONAL, date: '2026-01-26' },
      dailyWage: 1000,
      hoursWorked: 10,
      rules,
    });

    expect(four.wagesPayable).toBe(2000);
    expect(ten.wagesPayable).toBe(2000);
  });

  it('never consumes the overtime quota', () => {
    const result = holidayWagePosition({
      holiday: { kind: KIND.NATIONAL, date: '2026-01-26' },
      dailyWage: 1000,
      hoursWorked: 12,
      rules,
    });

    expect(result.consumesOvertimeQuota).toBe(false);
    expect(result.note).toBe(HOLIDAY_WORK_IS_NOT_OVERTIME);
  });

  it('owes ordinary wages and a substituted holiday where the state says so', () => {
    const result = holidayWagePosition({
      holiday: { kind: KIND.FESTIVAL, date: '2026-04-14' },
      dailyWage: 1000,
      hoursWorked: 8,
      rules: resolveRules('KL'),
    });

    expect(result.wagesPayable).toBe(1000);
    expect(result.substitutedHolidayDue).toBe(true);
    expect(result.satisfied).toBe(false);
    expect(result.substitutedHolidayDueBy).toEqual(utc('2026-05-14'));
  });

  it('is satisfied once the substituted holiday is granted in time', () => {
    const result = holidayWagePosition({
      holiday: { kind: KIND.FESTIVAL, date: '2026-04-14' },
      dailyWage: 1000,
      rules: resolveRules('KL'),
      substitutedHolidayGrantedOn: '2026-05-01',
    });

    expect(result.satisfied).toBe(true);
  });

  it('is not satisfied by a substituted holiday granted outside the period', () => {
    const result = holidayWagePosition({
      holiday: { kind: KIND.FESTIVAL, date: '2026-04-14' },
      dailyWage: 1000,
      rules: resolveRules('KL'),
      substitutedHolidayGrantedOn: '2026-07-01',
    });

    expect(result.satisfied).toBe(false);
  });
});

describe('listObligation', () => {
  const rules = resolveRules('TN');

  it('is due before the year it governs', () => {
    // An employer who fixes the list in March has already defaulted. An
    // obligation that only fires during the year can never be met.
    const result = listObligation({
      year: 2027,
      settledOn: null,
      rules,
      asAt: '2026-12-01',
    });

    expect(result.dueOn).toEqual(utc('2026-12-31'));
    expect(result.daysRemaining).toBe(30);
    expect(result.late).toBe(false);
  });

  it('is late once the date has passed unsettled', () => {
    const result = listObligation({
      year: 2027,
      settledOn: null,
      rules,
      asAt: '2027-03-01',
    });

    expect(result.late).toBe(true);
    expect(result.daysRemaining).toBeNull();
    expect(result.lateByDays).toBe(
      daysBetween(utc('2026-12-31'), utc('2027-03-01')),
    );
  });

  it('records a list settled late as late even though it is settled', () => {
    const result = listObligation({
      year: 2027,
      settledOn: '2027-02-01',
      rules,
      asAt: '2027-06-01',
    });

    expect(result.late).toBe(true);
    expect(result.lateByDays).toBe(32);
  });

  it('is not late where it was settled in time', () => {
    const result = listObligation({
      year: 2027,
      settledOn: '2026-12-15',
      rules,
      asAt: '2027-06-01',
    });

    expect(result.late).toBe(false);
  });
});

describe('assessYear', () => {
  const fullList = [
    { kind: KIND.NATIONAL, name: 'Republic Day', date: '2026-01-26' },
    { kind: KIND.NATIONAL, name: 'Independence Day', date: '2026-08-15' },
    { kind: KIND.NATIONAL, name: 'Gandhi Jayanti', date: '2026-10-02' },
    { kind: KIND.FESTIVAL, name: 'Pongal', date: '2026-01-14' },
    { kind: KIND.FESTIVAL, name: 'Tamil New Year', date: '2026-04-14' },
    { kind: KIND.FESTIVAL, name: 'Deepavali', date: '2026-11-08' },
    { kind: KIND.FESTIVAL, name: 'Christmas', date: '2026-12-25' },
  ];

  it('reports an unseeded state as a gap and computes nothing', () => {
    const result = assessYear({ state: 'XX', year: 2026 });

    expect(codesOf(result.findings)).toEqual([FINDING.STATE_RULES_UNKNOWN]);
    expect(result.rules).toBeNull();
    expect(result.national).toEqual([]);
  });

  it('flags a national holiday missing from the employer’s list', () => {
    // Built from the constant and matched against the list, never read out of
    // it. A list missing one is a finding rather than a shorter list.
    const result = assessYear({
      state: 'TN',
      year: 2026,
      holidays: fullList.filter((h) => h.date !== '2026-08-15'),
      listSettledOn: '2025-12-15',
      asAt: '2026-06-01',
    });

    const finding = result.findings.find(
      (f) => f.code === FINDING.NATIONAL_HOLIDAY_MISSING,
    );
    expect(finding.name).toBe('Independence Day');
    expect(finding.severity).toBe(SEVERITY.BREACH);
  });

  it('flags a festival shortfall against the state’s count', () => {
    const result = assessYear({
      state: 'KL',
      year: 2026,
      holidays: fullList,
      listSettledOn: '2025-12-15',
      asAt: '2026-06-01',
    });

    const finding = result.findings.find(
      (f) => f.code === FINDING.FESTIVAL_HOLIDAY_SHORTFALL,
    );
    expect(finding.declared).toBe(4);
    expect(finding.required).toBe(9);
  });

  it('flags a substituted national holiday as a breach', () => {
    const result = assessYear({
      state: 'TN',
      year: 2026,
      holidays: fullList,
      substitutions: [
        {
          holidayDate: '2026-08-15',
          substitutedDate: '2026-08-14',
          agreement: { agreedOn: '2026-07-01' },
        },
      ],
      listSettledOn: '2025-12-15',
      asAt: '2026-09-01',
    });

    expect(codesOf(result.findings)).toContain(
      FINDING.NATIONAL_HOLIDAY_SUBSTITUTED,
    );
  });

  it('flags a festival substitution with no agreement', () => {
    const result = assessYear({
      state: 'TN',
      year: 2026,
      holidays: fullList,
      substitutions: [
        { holidayDate: '2026-04-14', substitutedDate: '2026-04-15' },
      ],
      listSettledOn: '2025-12-15',
      asAt: '2026-09-01',
    });

    expect(codesOf(result.findings)).toContain(
      FINDING.SUBSTITUTION_WITHOUT_AGREEMENT,
    );
  });

  it('flags a short day on a holiday paid as if it were hours', () => {
    // Four hours on 26 January owes two full days' wages. Under the overtime
    // engine it owes nothing at all.
    const result = assessYear({
      state: 'TN',
      year: 2026,
      holidays: fullList,
      worked: [
        {
          employeeId: 'e1',
          holidayDate: '2026-01-26',
          dailyWage: 1000,
          hoursWorked: 4,
          paid: 500,
        },
      ],
      listSettledOn: '2025-12-15',
      asAt: '2026-02-01',
    });

    const finding = result.findings.find(
      (f) => f.code === FINDING.HOLIDAY_WORKED_UNDERPAID,
    );
    expect(finding.payable).toBe(2000);
    expect(finding.paid).toBe(500);
  });

  it('is quiet where the holiday worked was paid in full', () => {
    const result = assessYear({
      state: 'TN',
      year: 2026,
      holidays: fullList,
      worked: [
        {
          employeeId: 'e1',
          holidayDate: '2026-01-26',
          dailyWage: 1000,
          hoursWorked: 8,
          paid: 2000,
        },
      ],
      listSettledOn: '2025-12-15',
      asAt: '2026-02-01',
    });

    expect(codesOf(result.findings)).not.toContain(
      FINDING.HOLIDAY_WORKED_UNDERPAID,
    );
  });

  it('flags a substituted holiday that was never granted', () => {
    const result = assessYear({
      state: 'KL',
      year: 2026,
      holidays: fullList,
      worked: [
        {
          employeeId: 'e1',
          holidayDate: '2026-04-14',
          dailyWage: 1000,
          hoursWorked: 8,
          paid: 1000,
        },
      ],
      listSettledOn: '2025-12-15',
      asAt: '2026-09-01',
    });

    expect(codesOf(result.findings)).toContain(
      FINDING.SUBSTITUTED_HOLIDAY_NOT_GRANTED,
    );
  });

  it('raises the list obligation before the year rather than during it', () => {
    const result = assessYear({
      state: 'TN',
      year: 2027,
      holidays: [],
      listSettledOn: null,
      asAt: '2026-12-01',
    });

    const finding = result.findings.find(
      (f) => f.code === FINDING.LIST_NOT_SETTLED,
    );
    expect(finding.severity).toBe(SEVERITY.DUE);
    expect(finding.daysRemaining).toBe(30);
  });

  it('carries both notes on every assessment', () => {
    const result = assessYear({
      state: 'TN',
      year: 2026,
      holidays: fullList,
      listSettledOn: '2025-12-15',
      asAt: '2026-06-01',
    });

    expect(result.notes.holidayWorkIsNotOvertime).toBe(
      HOLIDAY_WORK_IS_NOT_OVERTIME,
    );
    expect(result.notes.nationalHolidaysAreNotSubstitutable).toBe(
      NATIONAL_HOLIDAYS_ARE_NOT_SUBSTITUTABLE,
    );
  });
});

describe('HOLIDAY_WORK_IS_NOT_OVERTIME', () => {
  it('says it is a whole day and that the quota is untouched', () => {
    expect(HOLIDAY_WORK_IS_NOT_OVERTIME).toMatch(/whole-day/i);
    expect(HOLIDAY_WORK_IS_NOT_OVERTIME).toMatch(/overtime quota/i);
  });

  it('travels on every wage position', () => {
    const result = holidayWagePosition({
      holiday: { kind: KIND.FESTIVAL, date: '2026-04-14' },
      dailyWage: 900,
      rules: resolveRules('MH'),
    });

    expect(result.note).toBe(HOLIDAY_WORK_IS_NOT_OVERTIME);
    expect(result.treatment).toBe(TREATMENT.DOUBLE_WAGES);
  });
});
