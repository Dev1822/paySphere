/**
 * Working hours compliance (#1702).
 *
 * The case worth stating first, because it is the whole reason the module
 * exists: a split shift of four hours in the morning and four in the evening is
 * eight hours of work and entirely lawful by sections 51 and 54. Start it at
 * 07:00 and end it at 20:00 and it is a thirteen-hour spread-over and an
 * offence. Nothing that checks hours worked can see it.
 *
 * The other boundaries:
 *
 *   - a gap too short to be a section 55 interval joining two sessions into one
 *     continuous stretch;
 *   - forty-eight and sixty being separate ceilings rather than one with an
 *     allowance;
 *   - the ten-consecutive-day rule seeing what the weekly test cannot;
 *   - the quarterly overtime ceiling reporting the day it was crossed;
 *   - and unlawful overtime still being payable.
 */

const {
  FACTORIES_ACT_LIMITS,
  FINDING,
  SEVERITY,
  startOfWeek,
  usableSessions,
  evaluateDay,
  evaluateConsecutiveDays,
  evaluateQuarterlyOvertime,
  overtimeEntitlement,
  assessEmployee,
  assessPeriod,
} = require('../workingHoursCompliance');

/** A session from `HH:MM` to `HH:MM` on a date, in UTC. */
const session = (date, from, to) => ({
  clockIn: new Date(`${date}T${from}:00Z`),
  clockOut: new Date(`${date}T${to}:00Z`),
});

const codesOf = (result) => result.findings.map((f) => f.code);

describe('sessions that can be assessed', () => {
  it('drops a session nobody clocked out of', () => {
    // Treating an open punch as running to midnight would manufacture a
    // spread-over breach out of a missing clock-out.
    const usable = usableSessions([
      { clockIn: new Date('2026-06-01T09:00:00Z'), clockOut: null },
      session('2026-06-01', '13:00', '17:00'),
    ]);

    expect(usable).toHaveLength(1);
  });

  it('drops a session that ends before it starts', () => {
    expect(
      usableSessions([session('2026-06-01', '17:00', '09:00')]),
    ).toHaveLength(0);
  });

  it('sorts by clock-in regardless of the order recorded', () => {
    const usable = usableSessions([
      session('2026-06-01', '14:00', '18:00'),
      session('2026-06-01', '07:00', '11:00'),
    ]);

    expect(usable[0].from.getUTCHours()).toBe(7);
  });
});

describe('the day', () => {
  it('the split shift nothing else catches', () => {
    // Eight hours worked, lawful by sections 51 and 54. Thirteen hours of
    // spread-over, and an offence under section 56.
    const result = evaluateDay({
      date: '2026-06-01',
      sessions: [
        session('2026-06-01', '07:00', '11:00'),
        session('2026-06-01', '16:00', '20:00'),
      ],
    });

    expect(result.hoursWorked).toBe(8);
    expect(codesOf(result)).not.toContain(FINDING.DAILY_HOURS);
    expect(result.spreadOverHours).toBe(13);
    expect(codesOf(result)).toContain(FINDING.SPREAD_OVER);
  });

  it('reports more than nine hours worked', () => {
    const result = evaluateDay({
      date: '2026-06-01',
      sessions: [
        session('2026-06-01', '08:00', '13:00'),
        session('2026-06-01', '14:00', '19:30'),
      ],
    });

    expect(result.hoursWorked).toBe(10.5);
    expect(codesOf(result)).toContain(FINDING.DAILY_HOURS);
  });

  it('is clean at exactly nine hours and ten and a half of spread-over', () => {
    // Boundaries are limits, not thresholds — the Act says "more than".
    const result = evaluateDay({
      date: '2026-06-01',
      sessions: [
        session('2026-06-01', '09:00', '13:00'),
        session('2026-06-01', '14:30', '19:30'),
      ],
    });

    expect(result.hoursWorked).toBe(9);
    expect(result.spreadOverHours).toBe(10.5);
    expect(result.findings).toEqual([]);
  });

  it('a thirty-minute break breaks the continuous stretch', () => {
    const result = evaluateDay({
      date: '2026-06-01',
      sessions: [
        session('2026-06-01', '09:00', '14:00'),
        session('2026-06-01', '14:30', '18:00'),
      ],
    });

    expect(result.longestContinuousHours).toBe(5);
    expect(codesOf(result)).not.toContain(FINDING.REST_INTERVAL);
  });

  it('a ten-minute gap does not', () => {
    // Two four-hour sessions ten minutes apart is an eight-hour continuous
    // stretch, not two lawful ones — a ten-minute gap is not a section 55
    // interval.
    const result = evaluateDay({
      date: '2026-06-01',
      sessions: [
        session('2026-06-01', '09:00', '13:00'),
        session('2026-06-01', '13:10', '17:10'),
      ],
    });

    expect(result.longestContinuousHours).toBe(8);
    expect(codesOf(result)).toContain(FINDING.REST_INTERVAL);
    expect(result.intervals[0].qualifies).toBe(false);
  });

  it('reports six hours straight with no break at all', () => {
    const result = evaluateDay({
      date: '2026-06-01',
      sessions: [session('2026-06-01', '09:00', '15:00')],
    });

    expect(codesOf(result)).toContain(FINDING.REST_INTERVAL);
  });

  it('a day with no usable sessions is not a worked day', () => {
    const result = evaluateDay({ date: '2026-06-01', sessions: [] });

    expect(result.worked).toBe(false);
    expect(result.findings).toEqual([]);
  });

  it('honours an establishment’s own limits over the statutory ones', () => {
    // The state Shops and Establishments Acts differ, which is why the limits
    // are a rule set rather than literals in the comparison.
    const result = evaluateDay({
      date: '2026-06-01',
      sessions: [session('2026-06-01', '09:00', '19:00')],
      limits: { maxDailyHours: 10.5, maxContinuousHours: 10.5 },
    });

    expect(result.hoursWorked).toBe(10);
    expect(result.findings).toEqual([]);
  });
});

describe('section 66 night hours', () => {
  const night = [session('2026-06-01', '20:00', '23:00')];

  it('says nothing where the restriction does not apply', () => {
    expect(
      evaluateDay({ date: '2026-06-01', sessions: night }).findings,
    ).toEqual([]);
  });

  it('is a breach where the restriction applies and no exemption is on record', () => {
    const result = evaluateDay({
      date: '2026-06-01',
      sessions: night,
      nightHoursRestricted: true,
    });

    const entry = result.findings.find((f) => f.code === FINDING.NIGHT_HOURS);

    expect(entry.severity).toBe(SEVERITY.BREACH);
  });

  it('catches a shift that ends half an hour inside the window', () => {
    // The hour component of 19:30 is 19, so a whole-hour comparison against a
    // window starting at 19:00 misses the half hour that is actually in it.
    const result = evaluateDay({
      date: '2026-06-01',
      sessions: [session('2026-06-01', '11:00', '19:30')],
      nightHoursRestricted: true,
    });

    expect(result.findings.map((f) => f.code)).toContain(FINDING.NIGHT_HOURS);
  });

  it('leaves a shift that ends exactly on the boundary alone', () => {
    const result = evaluateDay({
      date: '2026-06-01',
      sessions: [
        session('2026-06-01', '10:30', '14:00'),
        session('2026-06-01', '14:45', '19:00'),
      ],
      nightHoursRestricted: true,
    });

    expect(result.findings).toEqual([]);
  });

  it('catches a shift that runs right up to six in the morning', () => {
    // The other boundary, and not symmetrical with the evening one: a shift
    // ending at exactly 06:00 worked right up to the window's close, while one
    // ending at exactly 19:00 never entered it.
    const result = evaluateDay({
      date: '2026-06-01',
      sessions: [session('2026-06-01', '02:00', '06:00')],
      nightHoursRestricted: true,
    });

    expect(result.findings.map((f) => f.code)).toContain(FINDING.NIGHT_HOURS);
  });

  it('catches an early-morning start inside the window', () => {
    const result = evaluateDay({
      date: '2026-06-01',
      sessions: [session('2026-06-01', '05:30', '13:00')],
      nightHoursRestricted: true,
    });

    expect(result.findings.map((f) => f.code)).toContain(FINDING.NIGHT_HOURS);
  });

  it('is informational, not silent, under a state exemption', () => {
    // The exemptions carry conditions on transport, group size and consent, and
    // those are what get inspected — so the shift is still worth surfacing.
    const result = evaluateDay({
      date: '2026-06-01',
      sessions: night,
      nightHoursRestricted: true,
      nightHoursExempt: true,
    });

    const entry = result.findings.find((f) => f.code === FINDING.NIGHT_HOURS);

    expect(entry.severity).toBe(SEVERITY.INFORMATIONAL);
    expect(entry.detail).toMatch(/transport, group size and consent/);
  });
});

describe('the week', () => {
  /** Six nine-hour days from a Monday. */
  const week = (dates, hours = ['09:00', '18:30']) =>
    dates.map((date) => ({
      date,
      sessions: [
        session(date, hours[0], '13:00'),
        session(date, '13:30', hours[1]),
      ],
    }));

  /** A day off, as the attendance ledger records one: a row with no sessions. */
  const restDay = (date) => ({ date, sessions: [] });

  const employee = { employeeId: 'e1', name: 'A Kumar' };

  it('starts the week where the establishment says it does', () => {
    // Assuming Monday would move every boundary for an establishment whose week
    // starts on Sunday, and forty-eight hours over the wrong seven days is a
    // different number.
    const wednesday = new Date('2026-06-03T00:00:00Z');

    expect(startOfWeek(wednesday, 1).toISOString().slice(0, 10)).toBe(
      '2026-06-01',
    );
    expect(startOfWeek(wednesday, 0).toISOString().slice(0, 10)).toBe(
      '2026-05-31',
    );
  });

  it('reports more than forty-eight ordinary hours', () => {
    // Six days at nine hours is fifty-four.
    const result = assessEmployee({
      employee,
      days: week([
        '2026-06-01',
        '2026-06-02',
        '2026-06-03',
        '2026-06-04',
        '2026-06-05',
        '2026-06-06',
      ]),
    });

    expect(result.weeks[0].ordinaryHours).toBe(54);
    expect(result.findings.map((f) => f.code)).toContain(FINDING.WEEKLY_HOURS);
  });

  it('treats forty-eight and sixty as separate ceilings', () => {
    // Fifty-four ordinary hours breaches section 51 without approaching the
    // section 64 ceiling, which is why one is not an allowance on the other.
    const result = assessEmployee({
      employee,
      days: week([
        '2026-06-01',
        '2026-06-02',
        '2026-06-03',
        '2026-06-04',
        '2026-06-05',
        '2026-06-06',
      ]),
    });

    const codes = result.findings.map((f) => f.code);

    expect(codes).toContain(FINDING.WEEKLY_HOURS);
    expect(codes).not.toContain(FINDING.WEEKLY_HOURS_WITH_OVERTIME);
  });

  it('reports the sixty-hour ceiling once overtime is counted', () => {
    const days = week([
      '2026-06-01',
      '2026-06-02',
      '2026-06-03',
      '2026-06-04',
      '2026-06-05',
      '2026-06-06',
    ]).map((day) => ({ ...day, overtimeHours: 2 }));

    const result = assessEmployee({ employee, days });

    expect(result.weeks[0].totalHours).toBe(66);
    expect(result.findings.map((f) => f.code)).toContain(
      FINDING.WEEKLY_HOURS_WITH_OVERTIME,
    );
  });

  it('reports a week with no holiday and none substituted either side', () => {
    const result = assessEmployee({
      employee,
      days: week([
        '2026-06-01',
        '2026-06-02',
        '2026-06-03',
        '2026-06-04',
        '2026-06-05',
        '2026-06-06',
        '2026-06-07',
      ]),
    });

    expect(result.findings.map((f) => f.code)).toContain(
      FINDING.WEEKLY_HOLIDAY,
    );
  });

  it('accepts a holiday substituted inside the three days after', () => {
    // Section 52(1) permits the weekly holiday to be substituted by one of the
    // three days immediately before or after. A seven-day week with a rest day
    // on the Tuesday following is compliant, and reporting it would be
    // asserting a breach the Act expressly allows.
    //
    // 8 and 9 June are worked and 10 June is recorded with no sessions — three
    // days past the week that ended on the 7th, so inside the window.
    const result = assessEmployee({
      employee,
      days: [
        ...week([
          '2026-06-01',
          '2026-06-02',
          '2026-06-03',
          '2026-06-04',
          '2026-06-05',
          '2026-06-06',
          '2026-06-07',
        ]),
        ...week(['2026-06-08', '2026-06-09']),
        restDay('2026-06-10'),
      ],
    });

    const firstWeek = result.weeks[0];

    expect(firstWeek.workedDays).toBe(7);
    expect(firstWeek.holidaySubstituted).toBe(true);
    expect(firstWeek.findings.map((f) => f.code)).not.toContain(
      FINDING.WEEKLY_HOLIDAY,
    );
  });

  it('reports the week where nothing follows it in the record', () => {
    // A substitution needs positive evidence of a rest day. Seven recorded days
    // all worked is evidence that the week had no holiday; days that were never
    // recorded are not evidence that one was substituted.
    const result = assessEmployee({
      employee,
      days: week([
        '2026-06-01',
        '2026-06-02',
        '2026-06-03',
        '2026-06-04',
        '2026-06-05',
        '2026-06-06',
        '2026-06-07',
      ]),
    });

    expect(result.weeks[0].holidaySubstituted).toBe(false);
    expect(result.weeks[0].findings.map((f) => f.code)).toContain(
      FINDING.WEEKLY_HOLIDAY,
    );
  });

  it('does not accept a rest day beyond the substitution window', () => {
    // 8 to 11 June worked, so the recorded rest day is the 12th — five days
    // past the week that ended on the 7th, and outside the three-day window.
    const result = assessEmployee({
      employee,
      days: [
        ...week([
          '2026-06-01',
          '2026-06-02',
          '2026-06-03',
          '2026-06-04',
          '2026-06-05',
          '2026-06-06',
          '2026-06-07',
        ]),
        ...week(['2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11']),
        restDay('2026-06-12'),
      ],
    });

    expect(result.weeks[0].holidaySubstituted).toBe(false);
    expect(result.weeks[0].findings.map((f) => f.code)).toContain(
      FINDING.WEEKLY_HOLIDAY,
    );
  });
});

describe('the section 52 proviso on consecutive days', () => {
  const worked = (date) => ({
    date: new Date(`${date}T00:00:00Z`),
    worked: true,
  });
  const off = (date) => ({
    date: new Date(`${date}T00:00:00Z`),
    worked: false,
  });

  const days = (from, count) =>
    Array.from({ length: count }, (_, index) => {
      const date = new Date(`${from}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + index);
      return worked(date.toISOString().slice(0, 10));
    });

  it('is silent at ten', () => {
    expect(
      evaluateConsecutiveDays(days('2026-06-01', 10), FACTORIES_ACT_LIMITS),
    ).toEqual([]);
  });

  it('reports eleven', () => {
    const findings = evaluateConsecutiveDays(
      days('2026-06-01', 11),
      FACTORIES_ACT_LIMITS,
    );

    expect(findings[0].code).toBe(FINDING.CONSECUTIVE_DAYS);
    expect(findings[0].days).toBe(11);
  });

  it('sees what the weekly test cannot', () => {
    // Off on the Monday of one week and the Sunday of the next: a holiday in
    // each week, and twelve days worked in a row across the boundary.
    const series = [
      off('2026-06-01'),
      ...days('2026-06-02', 12),
      off('2026-06-14'),
    ];

    const findings = evaluateConsecutiveDays(series, FACTORIES_ACT_LIMITS);

    expect(findings).toHaveLength(1);
    expect(findings[0].days).toBe(12);
  });

  it('a rest day resets the run', () => {
    const series = [
      ...days('2026-06-01', 8),
      off('2026-06-09'),
      ...days('2026-06-10', 8),
    ];

    expect(evaluateConsecutiveDays(series, FACTORIES_ACT_LIMITS)).toEqual([]);
  });

  it('a gap in the record breaks the run rather than extending it', () => {
    // Missing days are missing evidence. Asserting a run across a fortnight
    // nobody recorded would be a finding built out of absence.
    const series = [...days('2026-06-01', 6), ...days('2026-06-20', 6)];

    expect(evaluateConsecutiveDays(series, FACTORIES_ACT_LIMITS)).toEqual([]);
  });
});

describe('the quarterly overtime ceiling', () => {
  const day = (date, overtimeHours) => ({
    date: new Date(`${date}T00:00:00Z`),
    overtimeHours,
  });

  it('is a running total across the quarter, not a weekly one', () => {
    // Ten weeks at six hours is sixty, and no single week is anywhere near the
    // ceiling.
    const days = Array.from({ length: 10 }, (_, index) => {
      const date = new Date('2026-04-06T00:00:00Z');
      date.setUTCDate(date.getUTCDate() + index * 7);
      return day(date.toISOString().slice(0, 10), 6);
    });

    const result = evaluateQuarterlyOvertime(days, FACTORIES_ACT_LIMITS);

    expect(result.quarters[0].overtimeHours).toBe(60);
    expect(result.findings).toHaveLength(1);
  });

  it('reports the day the ceiling was crossed', () => {
    // The fact an inspection asks for, and one no end-of-quarter total carries.
    const days = [
      day('2026-04-10', 30),
      day('2026-05-10', 20),
      day('2026-06-10', 5),
    ];

    const result = evaluateQuarterlyOvertime(days, FACTORIES_ACT_LIMITS);

    expect(result.findings[0].crossedOn.toISOString().slice(0, 10)).toBe(
      '2026-06-10',
    );
  });

  it('is silent at exactly fifty', () => {
    const result = evaluateQuarterlyOvertime(
      [day('2026-04-10', 25), day('2026-05-10', 25)],
      FACTORIES_ACT_LIMITS,
    );

    expect(result.findings).toEqual([]);
  });

  it('does not carry a total across a quarter boundary', () => {
    const result = evaluateQuarterlyOvertime(
      [day('2026-03-31', 40), day('2026-04-01', 40)],
      FACTORIES_ACT_LIMITS,
    );

    expect(result.quarters).toHaveLength(2);
    expect(result.findings).toEqual([]);
  });
});

describe('section 59 overtime pay', () => {
  it('is twice the ordinary rate, not one and a half', () => {
    // 1.5× is the figure most people remember and it under-pays every overtime
    // hour by a third.
    const result = overtimeEntitlement({
      overtimeHours: 10,
      ordinaryHourlyRate: 200,
      paid: 3000,
    });

    expect(result.multiplier).toBe(2);
    expect(result.entitlement).toBe(4000);
    expect(result.shortfall).toBe(1000);
  });

  it('reports nothing where the entitlement was met', () => {
    const result = overtimeEntitlement({
      overtimeHours: 10,
      ordinaryHourlyRate: 200,
      paid: 4000,
    });

    expect(result.shortfall).toBe(0);
    expect(result.findings).toEqual([]);
  });

  it('never reports a negative shortfall where more was paid', () => {
    expect(
      overtimeEntitlement({
        overtimeHours: 10,
        ordinaryHourlyRate: 200,
        paid: 9000,
      }).shortfall,
    ).toBe(0);
  });

  it('marks the finding as an underpayment rather than a breach', () => {
    const result = overtimeEntitlement({
      overtimeHours: 10,
      ordinaryHourlyRate: 200,
      paid: 0,
    });

    expect(result.findings[0].severity).toBe(SEVERITY.UNDERPAYMENT);
  });
});

describe('a whole workforce', () => {
  const splitShift = (date) => ({
    date,
    sessions: [
      session(date, '07:00', '11:00'),
      session(date, '16:00', '20:00'),
    ],
  });

  const workforce = [
    {
      employee: {
        employeeId: 'a',
        name: 'A Kumar',
        ordinaryHourlyRate: 200,
        overtimePaid: 0,
      },
      days: [splitShift('2026-06-01'), splitShift('2026-06-02')],
    },
    {
      employee: {
        employeeId: 'b',
        name: 'B Rao',
        ordinaryHourlyRate: 150,
        overtimePaid: 0,
      },
      days: [splitShift('2026-06-01')],
    },
  ];

  it('groups findings by section rather than listing them flat', () => {
    // A hundred spread-over findings across one shift pattern is one problem,
    // and a flat list makes it look like a hundred.
    const result = assessPeriod({ employees: workforce });

    const spread = result.bySection.find(
      (entry) => entry.code === FINDING.SPREAD_OVER,
    );

    expect(spread.count).toBe(3);
    expect(spread.employeeCount).toBe(2);
  });

  it('tags every finding with the employee it belongs to', () => {
    const result = assessPeriod({ employees: workforce });

    for (const entry of result.findings) {
      expect(entry.employeeId).toBeDefined();
      expect(entry.employeeName).toBeTruthy();
    }
  });

  it('still prices unlawful overtime', () => {
    // Section 59 does not stop applying because section 64 was breached. An
    // engine that refused to price unlawful hours would under-pay the employee
    // to flatter the employer.
    const result = assessPeriod({
      employees: [
        {
          employee: {
            employeeId: 'c',
            name: 'C Iyer',
            ordinaryHourlyRate: 100,
            overtimePaid: 0,
          },
          days: [{ ...splitShift('2026-06-01'), overtimeHours: 80 }],
        },
      ],
    });

    const codes = result.findings.map((f) => f.code);

    expect(codes).toContain(FINDING.QUARTERLY_OVERTIME);
    expect(result.overtimeShortfall).toBe(16000);
  });

  it('is compliant where there is nothing to report', () => {
    const result = assessPeriod({
      employees: [
        {
          employee: {
            employeeId: 'd',
            name: 'D Bose',
            ordinaryHourlyRate: 100,
          },
          days: [
            {
              date: '2026-06-01',
              sessions: [
                session('2026-06-01', '09:00', '13:00'),
                session('2026-06-01', '13:45', '18:00'),
              ],
            },
          ],
        },
      ],
    });

    expect(result.compliant).toBe(true);
    expect(result.breachCount).toBe(0);
  });

  it('an empty workforce is compliant rather than an error', () => {
    expect(assessPeriod({ employees: [] }).compliant).toBe(true);
  });
});
