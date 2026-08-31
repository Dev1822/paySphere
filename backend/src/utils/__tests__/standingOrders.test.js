/**
 * Industrial Employment (Standing Orders) Act, 1946 (#2029).
 *
 * Grouped around the four things a product gets wrong, and written so the
 * natural wrong answer fails:
 *
 *   - applicability must be dated from the first crossing, so an establishment
 *     that crossed in March and is at 140 today must not be dated from today;
 *   - an establishment that has since fallen below the threshold must stay
 *     applicable;
 *   - an uncertified establishment must come back MODEL and never NONE;
 *   - a modification inside six months must come back BARRED_UNILATERALLY and
 *     must clear on a recorded agreement.
 */

const {
  SCHEDULE_MATTERS,
  ORDERS_STATE,
  INSTRUMENT,
  MODIFICATION_VERDICT,
  STATE_RULES,
  resolveRules,
  applicability,
  submissionWindow,
  operationDate,
  governingInstrument,
  scheduleCoverage,
  assessModification,
  assessEstablishment,
  instrumentForMatter,
} = require('../standingOrders');

const d = (iso) => new Date(`${iso}T00:00:00.000Z`);
const CENTRAL = STATE_RULES.CENTRAL;
const MAHARASHTRA = STATE_RULES.MH;

describe('the state rules', () => {
  it('carries the states the product’s tenants are actually in', () => {
    expect(Object.keys(STATE_RULES).sort()).toEqual([
      'CENTRAL',
      'DL',
      'GJ',
      'KA',
      'MH',
      'TN',
    ]);
  });

  it('keeps the threshold state-made rather than assuming a hundred', () => {
    expect(CENTRAL.applicabilityThreshold).toBe(100);
    expect(MAHARASHTRA.applicabilityThreshold).toBe(50);
  });

  it('returns null for a state not on file rather than defaulting one', () => {
    expect(resolveRules('WB')).toBeNull();
    expect(resolveRules('')).toBeNull();
    expect(resolveRules(null)).toBeNull();
  });

  it('resolves case-insensitively', () => {
    expect(resolveRules('mh')).toBe(MAHARASHTRA);
  });
});

describe('the Schedule', () => {
  it('holds eleven matters, uniquely numbered', () => {
    const matters = Object.values(SCHEDULE_MATTERS);
    expect(matters).toHaveLength(11);
    const numbers = matters.map((m) => m.item);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it('names the two matters existing modules read', () => {
    expect(SCHEDULE_MATTERS.SHIFT_WORKING.readBy).toBe('noticeOfChange');
    expect(SCHEDULE_MATTERS.SUSPENSION_AND_MISCONDUCT.readBy).toBe(
      'subsistenceAllowance',
    );
  });
});

describe('applicability', () => {
  it('dates the obligation from the first crossing, not from today', () => {
    const result = applicability(
      [
        { on: d('2025-11-01'), workmen: 80 },
        { on: d('2026-03-14'), workmen: 104 },
        { on: d('2026-08-01'), workmen: 140 },
      ],
      CENTRAL,
    );
    expect(result.applicable).toBe(true);
    expect(result.applicableFrom.toISOString().slice(0, 10)).toBe('2026-03-14');
    expect(result.strengthAtCrossing).toBe(104);
  });

  it('keeps an establishment applicable after strength falls below', () => {
    const result = applicability(
      [
        { on: d('2024-02-01'), workmen: 130 },
        { on: d('2026-06-01'), workmen: 72 },
      ],
      CENTRAL,
    );
    expect(result.applicable).toBe(true);
    expect(result.stillApplicableDespiteFall).toBe(true);
    expect(result.reason).toMatch(/continues to apply/);
  });

  it('does not flag a fall that never happened', () => {
    const result = applicability(
      [{ on: d('2026-01-01'), workmen: 210 }],
      CENTRAL,
    );
    expect(result.stillApplicableDespiteFall).toBe(false);
  });

  it('applies the state threshold rather than the central one', () => {
    const history = [{ on: d('2026-04-01'), workmen: 61 }];
    expect(applicability(history, CENTRAL).applicable).toBe(false);
    expect(applicability(history, MAHARASHTRA).applicable).toBe(true);
  });

  it('treats the threshold itself as a crossing', () => {
    const result = applicability(
      [{ on: d('2026-04-01'), workmen: 100 }],
      CENTRAL,
    );
    expect(result.applicable).toBe(true);
  });

  it('reports the highest strength when the Act has never applied', () => {
    const result = applicability(
      [
        { on: d('2026-01-01'), workmen: 40 },
        { on: d('2026-05-01'), workmen: 92 },
      ],
      CENTRAL,
    );
    expect(result.applicable).toBe(false);
    expect(result.highestStrength).toBe(92);
  });

  it('sorts a history given out of order', () => {
    const result = applicability(
      [
        { on: d('2026-08-01'), workmen: 140 },
        { on: d('2026-03-14'), workmen: 104 },
      ],
      CENTRAL,
    );
    expect(result.applicableFrom.toISOString().slice(0, 10)).toBe('2026-03-14');
  });

  it('cannot answer without rules, and says so rather than assuming', () => {
    const result = applicability([{ on: d('2026-01-01'), workmen: 300 }], null);
    expect(result.applicable).toBeNull();
    expect(result.reason).toMatch(/defaulting it/);
  });

  it('ignores rows with no date or no number', () => {
    const result = applicability(
      [
        { on: null, workmen: 500 },
        { on: d('2026-02-01'), workmen: NaN },
        { on: d('2026-03-01'), workmen: 120 },
      ],
      CENTRAL,
    );
    expect(result.applicableFrom.toISOString().slice(0, 10)).toBe('2026-03-01');
  });
});

describe('submissionWindow', () => {
  it('runs six months from applicability', () => {
    const result = submissionWindow(
      d('2026-03-14'),
      null,
      d('2026-04-01'),
      CENTRAL,
    );
    expect(result.dueBy.toISOString().slice(0, 10)).toBe('2026-09-12');
    expect(result.state).toBe(ORDERS_STATE.DRAFT_DUE);
    expect(result.daysRemaining).toBeGreaterThan(0);
  });

  it('reports an overdue draft as a section 13(1) default', () => {
    const result = submissionWindow(
      d('2025-01-01'),
      null,
      d('2026-04-01'),
      CENTRAL,
    );
    expect(result.state).toBe(ORDERS_STATE.DRAFT_OVERDUE);
    expect(result.lateByDays).toBeGreaterThan(0);
    expect(result.reason).toMatch(
      /Model Standing Orders have governed throughout/,
    );
  });

  it('records a late submission as submitted, not as still overdue', () => {
    const result = submissionWindow(
      d('2025-01-01'),
      d('2025-10-01'),
      d('2026-04-01'),
      CENTRAL,
    );
    expect(result.state).toBe(ORDERS_STATE.DRAFT_SUBMITTED);
    expect(result.lateByDays).toBeGreaterThan(0);
    expect(result.reason).toMatch(/does not undo the submission/);
  });

  it('reports an in-time submission with no lateness', () => {
    const result = submissionWindow(
      d('2026-03-14'),
      d('2026-05-01'),
      d('2026-06-01'),
      CENTRAL,
    );
    expect(result.lateByDays).toBe(0);
  });

  it('has no deadline without an applicability date', () => {
    const result = submissionWindow(null, null, d('2026-04-01'), CENTRAL);
    expect(result.dueBy).toBeNull();
  });
});

describe('operationDate', () => {
  it('runs thirty days from the date authenticated copies were sent', () => {
    const result = operationDate(
      { authenticatedCopiesSentOn: d('2026-05-01') },
      d('2026-06-05'),
      CENTRAL,
    );
    expect(result.operativeFrom.toISOString().slice(0, 10)).toBe('2026-05-31');
    expect(result.state).toBe(ORDERS_STATE.OPERATIVE);
  });

  it('holds a certified set out of operation until the thirty days run', () => {
    const result = operationDate(
      { authenticatedCopiesSentOn: d('2026-05-01') },
      d('2026-05-20'),
      CENTRAL,
    );
    expect(result.state).toBe(ORDERS_STATE.CERTIFIED_NOT_YET_OPERATIVE);
    expect(result.daysUntilOperative).toBe(11);
    expect(result.reason).toMatch(/previous instrument governs/);
  });

  it('uses seven days from the appellate decision, not thirty', () => {
    const result = operationDate(
      {
        authenticatedCopiesSentOn: d('2026-05-01'),
        appealPreferred: true,
        appellateDecisionSentOn: d('2026-07-10'),
      },
      d('2026-07-20'),
      CENTRAL,
    );
    expect(result.lagDays).toBe(7);
    expect(result.ranFromAppeal).toBe(true);
    expect(result.operativeFrom.toISOString().slice(0, 10)).toBe('2026-07-17');
  });

  it('cannot bring orders into operation while an appeal is pending', () => {
    const result = operationDate(
      { authenticatedCopiesSentOn: d('2026-05-01'), appealPreferred: true },
      d('2026-09-01'),
      CENTRAL,
    );
    expect(result.state).toBe(ORDERS_STATE.APPEALED);
    expect(result.operativeFrom).toBeNull();
  });

  it('refuses to compute from the certificate date when no dispatch is recorded', () => {
    const result = operationDate(
      { certifiedOn: d('2026-05-01') },
      d('2026-09-01'),
      CENTRAL,
    );
    expect(result.state).toBe(ORDERS_STATE.UNDER_CERTIFICATION);
    expect(result.reason).toMatch(/not from the date on the certificate/);
  });
});

describe('governingInstrument', () => {
  const applicableFrom = d('2025-01-01');

  it('returns MODEL, never NONE, for an uncertified establishment', () => {
    const result = governingInstrument(
      { applicable: true, applicableFrom, current: null },
      d('2026-04-01'),
      CENTRAL,
    );
    expect(result.instrument).toBe(INSTRUMENT.MODEL);
    expect(result.reason).toMatch(
      /deems the prescribed Model Standing Orders adopted/,
    );
  });

  it('returns CERTIFIED once the section 7 period has run', () => {
    const result = governingInstrument(
      {
        applicable: true,
        applicableFrom,
        current: { authenticatedCopiesSentOn: d('2026-01-01') },
      },
      d('2026-04-01'),
      CENTRAL,
    );
    expect(result.instrument).toBe(INSTRUMENT.CERTIFIED);
  });

  it('keeps the previous set governing while a superseding one is not operative', () => {
    const result = governingInstrument(
      {
        applicable: true,
        applicableFrom,
        previous: { authenticatedCopiesSentOn: d('2024-01-01') },
        current: { authenticatedCopiesSentOn: d('2026-03-25') },
      },
      d('2026-04-01'),
      CENTRAL,
    );
    expect(result.instrument).toBe(INSTRUMENT.PREVIOUS_CERTIFIED);
    expect(result.supersededBy.toISOString().slice(0, 10)).toBe('2026-04-24');
  });

  it('returns NOT_APPLICABLE where the Act has never applied', () => {
    const result = governingInstrument(
      { applicable: false },
      d('2026-04-01'),
      CENTRAL,
    );
    expect(result.instrument).toBe(INSTRUMENT.NOT_APPLICABLE);
  });
});

describe('scheduleCoverage', () => {
  it('reports a gap per matter rather than condemning the whole set', () => {
    const result = scheduleCoverage([
      'CLASSIFICATION',
      'WORKING_HOURS',
      'SUSPENSION_AND_MISCONDUCT',
    ]);
    expect(result.complete).toBe(false);
    expect(result.gaps).toHaveLength(8);
    expect(
      result.matters.find((m) => m.key === 'CLASSIFICATION').governedBy,
    ).toBe(INSTRUMENT.CERTIFIED);
    expect(
      result.matters.find((m) => m.key === 'SHIFT_WORKING').governedBy,
    ).toBe(INSTRUMENT.MODEL);
  });

  it('reports a complete set as complete', () => {
    const result = scheduleCoverage(Object.keys(SCHEDULE_MATTERS));
    expect(result.complete).toBe(true);
    expect(result.gaps).toEqual([]);
  });

  it('treats an empty set as covering nothing', () => {
    expect(scheduleCoverage([]).gaps).toHaveLength(11);
    expect(scheduleCoverage(undefined).gaps).toHaveLength(11);
  });
});

describe('assessModification', () => {
  const operativeFrom = d('2026-01-15');

  it('bars a unilateral modification inside six months, and says unilateral', () => {
    const result = assessModification({
      operativeFrom,
      proposedOn: d('2026-04-01'),
      rules: CENTRAL,
    });
    expect(result.verdict).toBe(MODIFICATION_VERDICT.BARRED_UNILATERALLY);
    expect(result.barLiftsOn.toISOString().slice(0, 10)).toBe('2026-07-15');
    expect(result.reason).toMatch(/agreed with the workmen/);
  });

  it('permits the same modification on a recorded agreement', () => {
    const result = assessModification({
      operativeFrom,
      proposedOn: d('2026-04-01'),
      agreement: {
        party: 'the recognised union',
        reference: 'memorandum of settlement dated 2026-03-20',
      },
      rules: CENTRAL,
    });
    expect(result.verdict).toBe(MODIFICATION_VERDICT.PERMITTED_BY_AGREEMENT);
    expect(result.reason).toMatch(/memorandum of settlement/);
  });

  it('refuses a half-recorded agreement', () => {
    const result = assessModification({
      operativeFrom,
      proposedOn: d('2026-04-01'),
      agreement: { party: 'the union' },
      rules: CENTRAL,
    });
    expect(result.verdict).toBe(MODIFICATION_VERDICT.BARRED_UNILATERALLY);
    expect(result.reason).toMatch(/is an assertion/);
  });

  it('permits a modification once the bar has lifted', () => {
    const result = assessModification({
      operativeFrom,
      proposedOn: d('2026-08-01'),
      rules: CENTRAL,
    });
    expect(result.verdict).toBe(MODIFICATION_VERDICT.PERMITTED);
    expect(result.reason).toMatch(/section 10\(2\)/);
  });

  it('counts calendar months, clamping a short month', () => {
    // Six months from 31 August is 28 February, not 3 March.
    const result = assessModification({
      operativeFrom: d('2025-08-31'),
      proposedOn: d('2026-03-01'),
      rules: CENTRAL,
    });
    expect(result.barLiftsOn.toISOString().slice(0, 10)).toBe('2026-02-28');
    expect(result.verdict).toBe(MODIFICATION_VERDICT.PERMITTED);
  });

  it('has nothing to modify where nothing is certified', () => {
    const result = assessModification({
      operativeFrom: null,
      proposedOn: d('2026-04-01'),
      rules: CENTRAL,
    });
    expect(result.verdict).toBe(MODIFICATION_VERDICT.NOTHING_TO_MODIFY);
    expect(result.reason).toMatch(/certification under section 3/);
  });
});

describe('assessEstablishment', () => {
  const establishment = {
    name: 'Pune Unit II',
    state: 'MH',
    headcountHistory: [
      { on: d('2025-06-01'), workmen: 44 },
      { on: d('2025-09-12'), workmen: 53 },
      { on: d('2026-05-01'), workmen: 71 },
    ],
    draftSubmittedOn: null,
    current: null,
  };

  it('puts a Maharashtra establishment inside the Act at 53 workmen', () => {
    const result = assessEstablishment(establishment, {
      asOf: d('2026-06-01'),
    });
    expect(result.applicability.applicable).toBe(true);
    expect(result.applicability.applicableFrom.toISOString().slice(0, 10)).toBe(
      '2025-09-12',
    );
  });

  it('reports the draft as overdue and the Model orders as governing', () => {
    const result = assessEstablishment(establishment, {
      asOf: d('2026-06-01'),
    });
    expect(result.submission.state).toBe(ORDERS_STATE.DRAFT_OVERDUE);
    expect(result.governing.instrument).toBe(INSTRUMENT.MODEL);
  });

  it('has nothing to modify while the Model orders govern', () => {
    const result = assessEstablishment(establishment, {
      asOf: d('2026-06-01'),
    });
    expect(result.modification.verdict).toBe(
      MODIFICATION_VERDICT.NOTHING_TO_MODIFY,
    );
  });

  it('returns the whole position for a certified establishment', () => {
    const result = assessEstablishment(
      {
        ...establishment,
        draftSubmittedOn: d('2025-11-01'),
        current: {
          authenticatedCopiesSentOn: d('2026-01-10'),
          coveredMatters: ['CLASSIFICATION', 'SHIFT_WORKING', 'TERMINATION'],
        },
      },
      { asOf: d('2026-06-01') },
    );
    expect(result.governing.instrument).toBe(INSTRUMENT.CERTIFIED);
    expect(result.orders.state).toBe(ORDERS_STATE.OPERATIVE);
    expect(result.schedule.complete).toBe(false);
    // Operative from 9 February; the six-month bar therefore runs to 9 August
    // and 1 June is inside it. The bar is measured from operation, not from
    // certification, which is the whole reason the two dates are kept apart.
    expect(result.modification.verdict).toBe(
      MODIFICATION_VERDICT.BARRED_UNILATERALLY,
    );
    expect(result.modification.barLiftsOn.toISOString().slice(0, 10)).toBe(
      '2026-08-09',
    );
  });

  it('says nothing beyond not-applicable for an establishment under the threshold', () => {
    const result = assessEstablishment(
      { ...establishment, state: 'DL' },
      { asOf: d('2026-06-01') },
    );
    expect(result.governing.instrument).toBe(INSTRUMENT.NOT_APPLICABLE);
    expect(result.submission).toBeNull();
    expect(result.modification).toBeNull();
  });

  it('carries the four notes a reader needs', () => {
    const result = assessEstablishment(establishment, {
      asOf: d('2026-06-01'),
    });
    expect(Object.keys(result.notes)).toHaveLength(4);
  });
});

describe('instrumentForMatter', () => {
  const certified = assessEstablishment(
    {
      name: 'Pune Unit II',
      state: 'MH',
      headcountHistory: [{ on: d('2025-09-12'), workmen: 53 }],
      draftSubmittedOn: d('2025-11-01'),
      current: {
        authenticatedCopiesSentOn: d('2026-01-10'),
        coveredMatters: ['SUSPENSION_AND_MISCONDUCT', 'CLASSIFICATION'],
      },
    },
    { asOf: d('2026-06-01') },
  );

  it('answers the question #1828 actually asks', () => {
    const result = instrumentForMatter(certified, 'SUSPENSION_AND_MISCONDUCT');
    expect(result.instrument).toBe(INSTRUMENT.CERTIFIED);
  });

  it('falls a silent matter back to the Model orders on its own', () => {
    // The establishment plainly has certified standing orders. Shift working is
    // still on the Model orders, which is the answer a boolean cannot give.
    const result = instrumentForMatter(certified, 'SHIFT_WORKING');
    expect(result.instrument).toBe(INSTRUMENT.MODEL);
    expect(result.reason).toMatch(/silent on/);
  });

  it('rejects a matter that is not in the Schedule', () => {
    const result = instrumentForMatter(certified, 'CANTEEN');
    expect(result.instrument).toBeNull();
    expect(result.matters).toContain('SHIFT_WORKING');
  });

  it('returns MODEL for every matter where nothing is certified', () => {
    const uncertified = assessEstablishment(
      {
        name: 'Nashik Unit',
        state: 'MH',
        headcountHistory: [{ on: d('2025-09-12'), workmen: 53 }],
      },
      { asOf: d('2026-06-01') },
    );
    expect(instrumentForMatter(uncertified, 'SHIFT_WORKING').instrument).toBe(
      INSTRUMENT.MODEL,
    );
    expect(instrumentForMatter(uncertified, 'TERMINATION').instrument).toBe(
      INSTRUMENT.MODEL,
    );
  });
});
