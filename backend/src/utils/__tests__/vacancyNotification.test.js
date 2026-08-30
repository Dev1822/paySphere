/**
 * Employment Exchanges (CNV) Act, 1959 (#1879).
 *
 * The assertions that matter are the ones a checkbox on a requisition form
 * cannot make: that the fifteen-day window is computed from the intended fill
 * date rather than measured afterwards, that the threshold is evaluated as at
 * the date the requisition opened, that a section 3 exclusion is a recorded
 * determination which can be contradicted, and that ER-I is owed for a quarter
 * in which no vacancy arose at all.
 *
 * `NO_OBLIGATION_TO_RECRUIT` has its own block. Section 5 is the part everybody
 * gets wrong, and a compliance flag with no such note reads as a hiring
 * instruction.
 */

const {
  CNV_RULES,
  SECTOR,
  NOTIFIABILITY,
  EXCLUSION,
  RETURN_KIND,
  FINDING,
  SEVERITY,
  NO_OBLIGATION_TO_RECRUIT,
  daysBetween,
  quarterEndFor,
  quarterEndsBetween,
  applicability,
  notifiability,
  notificationWindow,
  erOneSchedule,
  erTwoSchedule,
  assessRequisition,
  assessEstablishment,
} = require('../vacancyNotification');

const utc = (iso) => new Date(`${iso}T00:00:00.000Z`);
const codesOf = (findings) => findings.map((finding) => finding.code);

describe('daysBetween', () => {
  it('is signed, because the sign is the answer', () => {
    // A window with three days left and one that closed three days ago are
    // different situations, and only one of them is a breach.
    expect(daysBetween(utc('2026-05-01'), utc('2026-05-04'))).toBe(3);
    expect(daysBetween(utc('2026-05-04'), utc('2026-05-01'))).toBe(-3);
  });
});

describe('quarterEndFor', () => {
  it('finds the last day of the quarter', () => {
    expect(quarterEndFor(utc('2026-02-10'))).toEqual(utc('2026-03-31'));
    expect(quarterEndFor(utc('2026-05-01'))).toEqual(utc('2026-06-30'));
    expect(quarterEndFor(utc('2026-11-30'))).toEqual(utc('2026-12-31'));
  });

  it('handles February without a leap-year branch', () => {
    expect(quarterEndFor(utc('2024-01-15'))).toEqual(utc('2024-03-31'));
  });
});

describe('quarterEndsBetween', () => {
  it('lists every quarter end in the range', () => {
    const ends = quarterEndsBetween('2026-01-01', '2026-12-31');
    expect(ends).toHaveLength(4);
    expect(ends[0]).toEqual(utc('2026-03-31'));
    expect(ends[3]).toEqual(utc('2026-12-31'));
  });

  it('excludes a quarter end before the range starts', () => {
    const ends = quarterEndsBetween('2026-04-01', '2026-12-31');
    expect(ends).toHaveLength(3);
  });

  it('is empty for an inverted range', () => {
    expect(quarterEndsBetween('2026-12-31', '2026-01-01')).toEqual([]);
  });
});

describe('applicability', () => {
  it('applies to the public sector regardless of headcount', () => {
    expect(
      applicability({ sector: SECTOR.PUBLIC, headcountOnDate: 3 }).applies,
    ).toBe(true);
  });

  it('applies to a private establishment at the threshold', () => {
    expect(
      applicability({ sector: SECTOR.PRIVATE, headcountOnDate: 25 }).applies,
    ).toBe(true);
    expect(
      applicability({ sector: SECTOR.PRIVATE, headcountOnDate: 24 }).applies,
    ).toBe(false);
  });

  it('carries the threshold and a reason', () => {
    const result = applicability({
      sector: SECTOR.PRIVATE,
      headcountOnDate: 24,
    });
    expect(result.threshold).toBe(CNV_RULES.privateSectorThreshold);
    expect(result.reason).toMatch(/below the threshold/);
  });
});

describe('notifiability', () => {
  const applies = { applies: true };

  it('carries section 5 on every result', () => {
    // The part everybody gets wrong. An employer that reads a compliance flag
    // as "you must hire through the exchange" either stops notifying or holds
    // a role open for nothing.
    expect(
      notifiability({ requisition: {}, applicability: applies })
        .noObligationToRecruit,
    ).toBe(NO_OBLIGATION_TO_RECRUIT);

    expect(
      notifiability({ requisition: {}, applicability: { applies: false } })
        .noObligationToRecruit,
    ).toBe(NO_OBLIGATION_TO_RECRUIT);
  });

  it('says the obligation is only to notify', () => {
    expect(NO_OBLIGATION_TO_RECRUIT).toMatch(/no obligation to recruit/i);
    expect(NO_OBLIGATION_TO_RECRUIT).toMatch(/Section 5/);
  });

  it('is not applicable below the threshold', () => {
    expect(
      notifiability({
        requisition: { determinedOn: utc('2026-05-01') },
        applicability: { applies: false },
      }).status,
    ).toBe(NOTIFIABILITY.NOT_APPLICABLE);
  });

  it('is excluded on a recorded ground', () => {
    const result = notifiability({
      requisition: { exclusionGround: EXCLUSION.FILLED_BY_PROMOTION },
      applicability: applies,
    });

    expect(result.status).toBe(NOTIFIABILITY.EXCLUDED);
    expect(result.authority).toBe('Rule 4');
  });

  it('is undetermined rather than notifiable where nobody has looked', () => {
    // A requisition somebody has decided is notifiable is a deadline; one
    // nobody has looked at is a question. Reporting the second as the first is
    // how a queue fills with rows that turn out to be promotions.
    expect(
      notifiability({ requisition: {}, applicability: applies }).status,
    ).toBe(NOTIFIABILITY.UNDETERMINED);
  });

  it('suggests the duration ground without applying it', () => {
    const result = notifiability({
      requisition: { durationMonths: 2 },
      applicability: applies,
    });

    expect(result.status).toBe(NOTIFIABILITY.UNDETERMINED);
    expect(result.suggestedGround).toBe(EXCLUSION.LESS_THAN_THREE_MONTHS);
  });

  it('is notifiable once determined', () => {
    expect(
      notifiability({
        requisition: { determinedOn: utc('2026-05-01') },
        applicability: applies,
      }).status,
    ).toBe(NOTIFIABILITY.NOTIFIABLE);
  });
});

describe('notificationWindow', () => {
  it('computes the deadline from the intended fill date', () => {
    const window = notificationWindow({
      intendedFillDate: '2026-06-30',
      asAt: '2026-06-01',
    });

    expect(window.notifyBy).toEqual(utc('2026-06-15'));
    expect(window.daysRemaining).toBe(14);
    expect(window.missed).toBe(false);
  });

  it('reports a closed window as missed rather than as a count', () => {
    const window = notificationWindow({
      intendedFillDate: '2026-05-10',
      asAt: '2026-05-01',
    });

    expect(window.missed).toBe(true);
    expect(window.daysRemaining).toBeLessThan(0);
  });

  it('treats a notification exactly on the deadline as on time', () => {
    const window = notificationWindow({
      intendedFillDate: '2026-06-30',
      notifiedOn: '2026-06-15',
      asAt: '2026-06-20',
    });

    expect(window.onTime).toBe(true);
    expect(window.lateByDays).toBe(0);
  });

  it('measures how late a late notification was', () => {
    const window = notificationWindow({
      intendedFillDate: '2026-06-30',
      notifiedOn: '2026-06-20',
      asAt: '2026-06-25',
    });

    expect(window.onTime).toBe(false);
    expect(window.lateByDays).toBe(5);
  });

  it('says nothing useful without an intended fill date', () => {
    const window = notificationWindow({ intendedFillDate: null });
    expect(window.notifyBy).toBeNull();
  });
});

describe('erOneSchedule', () => {
  it('is built from quarter ends and not from requisitions', () => {
    // ER-I is a return about employment. An establishment that opened no
    // vacancy at all still owes it, so the schedule cannot come from the
    // requisition table.
    const schedule = erOneSchedule({
      from: '2026-01-01',
      to: '2026-12-31',
      asAt: '2027-02-01',
    });

    expect(schedule).toHaveLength(4);
    expect(schedule.every((row) => row.kind === RETURN_KIND.ER_I)).toBe(true);
  });

  it('is due thirty days after the quarter end', () => {
    const [first] = erOneSchedule({
      from: '2026-01-01',
      to: '2026-03-31',
      asAt: '2026-04-01',
    });

    expect(first.asOn).toEqual(utc('2026-03-31'));
    expect(first.dueOn).toEqual(utc('2026-04-30'));
  });

  it('marks a return overdue only after the due date', () => {
    const before = erOneSchedule({
      from: '2026-01-01',
      to: '2026-03-31',
      asAt: '2026-04-10',
    });
    const after = erOneSchedule({
      from: '2026-01-01',
      to: '2026-03-31',
      asAt: '2026-05-10',
    });

    expect(before[0].overdue).toBe(false);
    expect(after[0].overdue).toBe(true);
  });

  it('records a filing against its quarter', () => {
    const schedule = erOneSchedule({
      from: '2026-01-01',
      to: '2026-03-31',
      filings: [
        {
          kind: RETURN_KIND.ER_I,
          asOn: '2026-03-31',
          filedOn: '2026-04-20',
        },
      ],
      asAt: '2026-06-01',
    });

    expect(schedule[0].filed).toBe(true);
    expect(schedule[0].overdue).toBe(false);
    expect(schedule[0].lateByDays).toBe(0);
  });

  it('measures a late filing', () => {
    const schedule = erOneSchedule({
      from: '2026-01-01',
      to: '2026-03-31',
      filings: [
        {
          kind: RETURN_KIND.ER_I,
          asOn: '2026-03-31',
          filedOn: '2026-05-15',
        },
      ],
      asAt: '2026-06-01',
    });

    expect(schedule[0].lateByDays).toBe(15);
  });

  it('does not count an ER-II filing against an ER-I quarter', () => {
    const schedule = erOneSchedule({
      from: '2026-01-01',
      to: '2026-03-31',
      filings: [
        { kind: RETURN_KIND.ER_II, asOn: '2026-03-31', filedOn: '2026-04-20' },
      ],
      asAt: '2026-06-01',
    });

    expect(schedule[0].filed).toBe(false);
  });
});

describe('erTwoSchedule', () => {
  it('runs every two years from the anchor', () => {
    const schedule = erTwoSchedule({
      anchor: '2022-03-31',
      to: '2026-12-31',
      asAt: '2027-01-01',
    });

    expect(schedule.map((row) => row.asOn)).toEqual([
      utc('2022-03-31'),
      utc('2024-03-31'),
      utc('2026-03-31'),
    ]);
  });

  it('does not shift when the range widens', () => {
    // Anchored rather than derived from the range's start, so the schedule does
    // not move every time somebody changes the view.
    const narrow = erTwoSchedule({
      anchor: '2022-03-31',
      to: '2024-12-31',
      asAt: '2025-01-01',
    });
    const wide = erTwoSchedule({
      anchor: '2022-03-31',
      to: '2026-12-31',
      asAt: '2027-01-01',
    });

    expect(wide[0].asOn).toEqual(narrow[0].asOn);
  });

  it('is empty for an inverted range', () => {
    expect(erTwoSchedule({ anchor: '2026-03-31', to: '2020-01-01' })).toEqual(
      [],
    );
  });
});

describe('assessRequisition', () => {
  const notifiableRequisition = {
    requisitionId: 'a',
    title: 'Fitter',
    openedOn: '2026-05-01',
    intendedFillDate: '2026-06-30',
    determinedOn: '2026-05-01',
  };

  it('raises an open window as a deadline rather than a breach', () => {
    const result = assessRequisition({
      requisition: notifiableRequisition,
      headcountOnOpen: 40,
      sector: SECTOR.PRIVATE,
      asAt: '2026-06-01',
    });

    const finding = result.findings.find(
      (row) => row.code === FINDING.NOTIFICATION_DUE,
    );
    expect(finding.severity).toBe(SEVERITY.DUE);
  });

  it('raises a closed window as a breach', () => {
    const result = assessRequisition({
      requisition: notifiableRequisition,
      headcountOnOpen: 40,
      sector: SECTOR.PRIVATE,
      asAt: '2026-06-20',
    });

    const finding = result.findings.find(
      (row) => row.code === FINDING.NOTIFICATION_WINDOW_MISSED,
    );
    expect(finding.severity).toBe(SEVERITY.BREACH);
  });

  it('raises filling without notification as a breach', () => {
    const result = assessRequisition({
      requisition: { ...notifiableRequisition, filledOn: '2026-06-25' },
      headcountOnOpen: 40,
      sector: SECTOR.PRIVATE,
      asAt: '2026-07-01',
    });

    expect(codesOf(result.findings)).toContain(
      FINDING.FILLED_WITHOUT_NOTIFICATION,
    );
  });

  it('does not claim the appointment is invalid', () => {
    // The Act creates no such consequence, and a product asserting one would be
    // making up a remedy.
    const result = assessRequisition({
      requisition: { ...notifiableRequisition, filledOn: '2026-06-25' },
      headcountOnOpen: 40,
      sector: SECTOR.PRIVATE,
      asAt: '2026-07-01',
    });

    const finding = result.findings.find(
      (row) => row.code === FINDING.FILLED_WITHOUT_NOTIFICATION,
    );
    expect(finding.note).toMatch(/not invalidated/i);
  });

  it('raises nothing for a requisition below the threshold', () => {
    const result = assessRequisition({
      requisition: notifiableRequisition,
      headcountOnOpen: 12,
      sector: SECTOR.PRIVATE,
      asAt: '2026-07-01',
    });

    expect(result.notifiability.status).toBe(NOTIFIABILITY.NOT_APPLICABLE);
    expect(result.findings).toEqual([]);
  });

  it('raises an undetermined requisition as a question', () => {
    const result = assessRequisition({
      requisition: { ...notifiableRequisition, determinedOn: undefined },
      headcountOnOpen: 40,
      sector: SECTOR.PRIVATE,
      asAt: '2026-06-01',
    });

    expect(codesOf(result.findings)).toEqual([FINDING.DETERMINATION_MISSING]);
  });

  it('raises nothing about a notification for an excluded requisition', () => {
    const result = assessRequisition({
      requisition: {
        ...notifiableRequisition,
        exclusionGround: EXCLUSION.FILLED_BY_PROMOTION,
      },
      headcountOnOpen: 40,
      sector: SECTOR.PRIVATE,
      asAt: '2026-07-01',
    });

    expect(result.findings).toEqual([]);
  });

  it('flags a duration exclusion the facts contradict', () => {
    // Exactly the record an inspection asks about, which is why the ground is
    // stored rather than computed away.
    const result = assessRequisition({
      requisition: {
        ...notifiableRequisition,
        exclusionGround: EXCLUSION.LESS_THAN_THREE_MONTHS,
        durationMonths: 2,
        actualDurationMonths: 12,
      },
      headcountOnOpen: 40,
      sector: SECTOR.PRIVATE,
      asAt: '2027-06-01',
    });

    expect(codesOf(result.findings)).toContain(FINDING.EXCLUSION_CONTRADICTED);
  });

  it('reports a section 25H preference as a separate obligation', () => {
    const result = assessRequisition({
      requisition: {
        ...notifiableRequisition,
        notifiedOn: '2026-06-10',
        category: 'Fitter',
        retrenchedPreferenceInCategory: true,
      },
      headcountOnOpen: 40,
      sector: SECTOR.PRIVATE,
      asAt: '2026-06-20',
    });

    const finding = result.findings.find(
      (row) => row.code === FINDING.SECTION_25H_PREFERENCE_ALSO_DUE,
    );
    expect(finding.note).toMatch(/does not discharge the other/);
  });
});

describe('assessEstablishment', () => {
  const establishment = {
    sector: SECTOR.PRIVATE,
    headcounts: [
      { asOn: '2026-01-01', headcount: 20 },
      { asOn: '2026-04-01', headcount: 40 },
    ],
    requisitions: [
      {
        requisitionId: 'a',
        title: 'Before the threshold',
        openedOn: '2026-02-01',
        intendedFillDate: '2026-02-20',
        determinedOn: '2026-02-01',
      },
      {
        requisitionId: 'b',
        title: 'After the threshold',
        openedOn: '2026-05-01',
        intendedFillDate: '2026-05-10',
        determinedOn: '2026-05-01',
      },
      {
        requisitionId: 'c',
        title: 'Promotion',
        openedOn: '2026-05-01',
        intendedFillDate: '2026-06-30',
        exclusionGround: EXCLUSION.FILLED_BY_PROMOTION,
        determinedOn: '2026-05-01',
      },
    ],
    period: { from: '2026-01-01', to: '2026-08-28' },
    asAt: '2026-08-28',
  };

  it('evaluates the threshold as at the date the requisition opened', () => {
    // The requisition in February is outside the Act and the one in May is
    // inside it, on the same establishment.
    const result = assessEstablishment(establishment);

    const february = result.requisitions.find(
      (row) => row.requisitionId === 'a',
    );
    const may = result.requisitions.find((row) => row.requisitionId === 'b');

    expect(february.notifiability.status).toBe(NOTIFIABILITY.NOT_APPLICABLE);
    expect(may.notifiability.status).toBe(NOTIFIABILITY.NOTIFIABLE);
  });

  it('says when the establishment crossed the threshold', () => {
    const result = assessEstablishment(establishment);
    const finding = result.findings.find(
      (row) => row.code === FINDING.THRESHOLD_CROSSED,
    );

    expect(finding.asOn).toEqual(utc('2026-04-01'));
  });

  it('counts the excluded rather than filtering them away', () => {
    // A queue that hides the excluded ones cannot explain why it is short.
    const result = assessEstablishment(establishment);

    expect(result.notifiableCount).toBe(1);
    expect(result.excludedCount).toBe(1);
    expect(result.requisitions).toHaveLength(3);
  });

  it('owes ER-I for a quarter with no requisition in it', () => {
    const result = assessEstablishment({
      sector: SECTOR.PRIVATE,
      headcounts: [{ asOn: '2026-01-01', headcount: 40 }],
      requisitions: [],
      period: { from: '2026-01-01', to: '2026-08-28' },
      asAt: '2026-08-28',
    });

    expect(result.returns.erOne.length).toBeGreaterThan(0);
    expect(codesOf(result.findings)).toContain(FINDING.ER_I_OVERDUE);
  });

  it('carries section 5 at the top level', () => {
    expect(assessEstablishment(establishment).noObligationToRecruit).toBe(
      NO_OBLIGATION_TO_RECRUIT,
    );
  });

  it('produces no ER-II schedule without an anchor', () => {
    expect(assessEstablishment(establishment).returns.erTwo).toEqual([]);
  });

  it('produces one with an anchor', () => {
    const result = assessEstablishment({
      ...establishment,
      erTwoAnchor: '2024-03-31',
    });

    expect(result.returns.erTwo.length).toBeGreaterThan(0);
  });

  it('does not invent an obligation where no headcount is known', () => {
    // An unknown headcount defaulting to today's figure would invent an
    // obligation for every requisition predating the threshold being crossed.
    const result = assessEstablishment({
      sector: SECTOR.PRIVATE,
      headcounts: [],
      requisitions: [
        {
          requisitionId: 'a',
          openedOn: '2026-05-01',
          intendedFillDate: '2026-05-10',
          determinedOn: '2026-05-01',
        },
      ],
      period: { from: '2026-05-01', to: '2026-05-31' },
      asAt: '2026-05-20',
    });

    expect(result.requisitions[0].notifiability.status).toBe(
      NOTIFIABILITY.NOT_APPLICABLE,
    );
  });

  it('survives being called with nothing', () => {
    const result = assessEstablishment();
    expect(result.requisitions).toEqual([]);
    expect(result.returns.erOne).toEqual([]);
  });
});
