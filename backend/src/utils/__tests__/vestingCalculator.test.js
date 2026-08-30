/**
 * ESOP vesting, perquisite valuation and pool accounting (#1073).
 *
 * The cases below are organised around the three things that are arithmetic
 * rather than opinion, because those are the ones that go wrong silently:
 *
 *   - tranches summing exactly to the grant,
 *   - nothing vesting before the cliff,
 *   - the perquisite flooring at zero when an option is underwater.
 *
 * Every date is fixed. The calculator takes `asOf` as an argument precisely so
 * these can be, and a suite that reached for `new Date()` would start failing on
 * a date nobody chose.
 */

'use strict';

const {
  round2,
  addMonths,
  daysBetween,
  normaliseTerms,
  buildVestingSchedule,
  vestedAsOf,
  computePerquisite,
  computeForfeitureOnExit,
  summarisePool,
  canGrant,
  calculateTenderAllocations,
  GRANT_STATUS,
} = require('../vestingCalculator');

/** A 1,000-option grant on the industry-standard 1-year cliff / 4-year monthly. */
const standardGrant = () => ({
  optionsGranted: 1000,
  exercisePrice: 10,
  grantDate: '2024-01-01T00:00:00.000Z',
  vestingStartDate: '2024-01-01T00:00:00.000Z',
  cliffMonths: 12,
  vestingDurationMonths: 48,
  vestingFrequency: 'monthly',
  optionsExercised: 0,
  optionsForfeited: 0,
});

describe('round2', () => {
  it('rounds to two decimals', () => {
    expect(round2(100.456)).toBe(100.46);
    expect(round2(100.454)).toBe(100.45);
  });

  it('returns 0 for values that are not finite numbers', () => {
    // Reached whenever a caller passes an unset field through. Returning NaN
    // would propagate into a stored money column.
    expect(round2(undefined)).toBe(0);
    expect(round2(null)).toBe(0);
    expect(round2('abc')).toBe(0);
    expect(round2(Infinity)).toBe(0);
  });
});

describe('addMonths', () => {
  it('adds whole months', () => {
    expect(addMonths('2024-01-15T00:00:00.000Z', 3).toISOString()).toContain(
      '2024-04-15',
    );
  });

  it('clamps rather than rolling over a short month', () => {
    // 31 January + 1 month is not 2 or 3 March. Left to the Date constructor it
    // would be, and a grant dated the 31st would vest on drifting dates for the
    // rest of its life.
    const result = addMonths('2024-01-31T00:00:00.000Z', 1);
    expect(result.toISOString()).toContain('2024-02-29'); // 2024 is a leap year
  });

  it('clamps to 28 February in a non-leap year', () => {
    const result = addMonths('2023-01-31T00:00:00.000Z', 1);
    expect(result.toISOString()).toContain('2023-02-28');
  });

  it('comes back to the 31st in the next long month', () => {
    // The clamp must not be sticky: 31 Jan + 2 months is 31 March, not 28/29.
    const result = addMonths('2024-01-31T00:00:00.000Z', 2);
    expect(result.toISOString()).toContain('2024-03-31');
  });

  it('returns an invalid date for an unparseable input rather than guessing', () => {
    expect(Number.isNaN(addMonths('not-a-date', 1).getTime())).toBe(true);
  });
});

describe('daysBetween', () => {
  it('counts whole days forwards', () => {
    expect(daysBetween('2024-01-01', '2024-01-31')).toBe(30);
  });

  it('is negative when the second date precedes the first', () => {
    expect(daysBetween('2024-01-31', '2024-01-01')).toBe(-30);
  });
});

describe('normaliseTerms', () => {
  it('accepts a standard grant', () => {
    expect(normaliseTerms(standardGrant()).valid).toBe(true);
  });

  it('rejects a cliff longer than the vesting duration', () => {
    // Two individually reasonable numbers that together describe a grant which
    // never vests anything. Only the combination shows it, which is why this
    // check cannot live on the schema.
    const result = normaliseTerms({
      ...standardGrant(),
      cliffMonths: 60,
      vestingDurationMonths: 48,
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/exceeds vestingDurationMonths/);
  });

  it('rejects a cliff that does not land on a period boundary', () => {
    // A 10-month cliff on a quarterly schedule lands mid-period, and there is
    // no defensible answer for how much of that period has vested.
    const result = normaliseTerms({
      ...standardGrant(),
      cliffMonths: 10,
      vestingFrequency: 'quarterly',
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(
      /whole number of quarterly periods/,
    );
  });

  it('accepts a 12-month cliff on a quarterly schedule', () => {
    // 12 months is exactly four quarters, so this one is fine — the check above
    // must not be "cliff must equal the period".
    expect(
      normaliseTerms({
        ...standardGrant(),
        cliffMonths: 12,
        vestingFrequency: 'quarterly',
      }).valid,
    ).toBe(true);
  });

  it('rejects a non-positive grant size', () => {
    expect(
      normaliseTerms({ ...standardGrant(), optionsGranted: 0 }).valid,
    ).toBe(false);
  });

  it('rejects an unknown vesting frequency', () => {
    const result = normaliseTerms({
      ...standardGrant(),
      vestingFrequency: 'fortnightly',
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/vestingFrequency must be one of/);
  });

  it('reports every problem at once rather than the first', () => {
    const result = normaliseTerms({
      optionsGranted: -5,
      vestingDurationMonths: 0,
      vestingFrequency: 'weekly',
      vestingStartDate: 'nonsense',
    });

    expect(result.errors.length).toBeGreaterThan(3);
  });
});

describe('buildVestingSchedule', () => {
  it('produces a cliff tranche plus one per remaining month', () => {
    const schedule = buildVestingSchedule(standardGrant());

    // 48 monthly periods, 12 of them absorbed into the cliff → 1 + 36.
    expect(schedule.tranches).toHaveLength(37);
    expect(schedule.tranches[0].isCliff).toBe(true);
    expect(schedule.tranches[0].periodsCovered).toBe(12);
  });

  it('sums exactly to the granted quantity', () => {
    // The property the whole design of this function exists to hold. 1000/48
    // floors to 20; 48 × 20 is 960, and the missing 40 must be somewhere.
    const schedule = buildVestingSchedule(standardGrant());
    const total = schedule.tranches.reduce((sum, t) => sum + t.options, 0);

    expect(total).toBe(1000);
    expect(schedule.totalOptions).toBe(1000);
  });

  it('puts the whole rounding remainder in the final tranche', () => {
    const schedule = buildVestingSchedule(standardGrant());
    const last = schedule.tranches[schedule.tranches.length - 1];

    expect(last.options).toBe(60); // 20 base + 40 remainder
  });

  it('sums exactly for a grant size that divides evenly too', () => {
    // The remainder path must not disturb the clean case.
    const schedule = buildVestingSchedule({
      ...standardGrant(),
      optionsGranted: 4800,
    });
    const total = schedule.tranches.reduce((sum, t) => sum + t.options, 0);

    expect(total).toBe(4800);
    expect(schedule.tranches[schedule.tranches.length - 1].options).toBe(100);
  });

  it('dates the cliff tranche at start + cliffMonths', () => {
    const schedule = buildVestingSchedule(standardGrant());

    expect(schedule.tranches[0].vestDate.toISOString()).toContain('2025-01-01');
  });

  it('ends on the vesting end date', () => {
    const schedule = buildVestingSchedule(standardGrant());
    const last = schedule.tranches[schedule.tranches.length - 1];

    expect(last.vestDate.toISOString()).toContain('2028-01-01');
  });

  it('keeps a running cumulative total', () => {
    const schedule = buildVestingSchedule(standardGrant());

    let running = 0;
    for (const tranche of schedule.tranches) {
      running += tranche.options;
      expect(tranche.cumulativeOptions).toBe(running);
    }
  });

  it('emits no cliff tranche when there is no cliff', () => {
    const schedule = buildVestingSchedule({
      ...standardGrant(),
      cliffMonths: 0,
      vestingDurationMonths: 12,
    });

    expect(schedule.tranches).toHaveLength(12);
    expect(schedule.tranches.every((t) => t.isCliff === false)).toBe(true);
    // First tranche is at start + 1 month, not at the start. Nothing has been
    // earned on day one.
    expect(schedule.tranches[0].vestDate.toISOString()).toContain('2024-02-01');
  });

  it('handles a quarterly schedule', () => {
    const schedule = buildVestingSchedule({
      ...standardGrant(),
      vestingFrequency: 'quarterly',
    });

    // 16 quarters, 4 of them in the cliff → 1 + 12.
    expect(schedule.tranches).toHaveLength(13);
    expect(schedule.tranches.reduce((s, t) => s + t.options, 0)).toBe(1000);
  });

  it('handles a duration that is not a whole number of periods', () => {
    // 50 months quarterly is 16 full quarters plus two months. The short final
    // period still vests in full, and on the end date rather than past it.
    const schedule = buildVestingSchedule({
      ...standardGrant(),
      cliffMonths: 0,
      vestingDurationMonths: 50,
      vestingFrequency: 'quarterly',
    });

    const last = schedule.tranches[schedule.tranches.length - 1];

    expect(schedule.tranches.reduce((s, t) => s + t.options, 0)).toBe(1000);
    expect(last.vestDate.toISOString()).toContain('2028-03-01'); // start + 50 months
  });

  it('reports the errors and no tranches for invalid terms', () => {
    const schedule = buildVestingSchedule({
      ...standardGrant(),
      optionsGranted: 0,
    });

    expect(schedule.valid).toBe(false);
    expect(schedule.tranches).toEqual([]);
  });
});

describe('vestedAsOf', () => {
  it('vests nothing the day before the cliff', () => {
    const position = vestedAsOf(standardGrant(), '2024-12-31T00:00:00.000Z');

    expect(position.vested).toBe(0);
    expect(position.unvested).toBe(1000);
    expect(position.percentVested).toBe(0);
  });

  it('vests the whole cliff amount on the cliff date', () => {
    const position = vestedAsOf(standardGrant(), '2025-01-01T00:00:00.000Z');

    expect(position.vested).toBe(240); // 12 × 20
    expect(position.percentVested).toBe(24);
  });

  it('vests everything at the end of the term', () => {
    const position = vestedAsOf(standardGrant(), '2028-01-01T00:00:00.000Z');

    expect(position.vested).toBe(1000);
    expect(position.unvested).toBe(0);
    expect(position.percentVested).toBe(100);
  });

  it('vests nothing extra after the term ends', () => {
    const position = vestedAsOf(standardGrant(), '2035-01-01T00:00:00.000Z');

    expect(position.vested).toBe(1000);
  });

  it('reports the next vesting date and its size', () => {
    const position = vestedAsOf(standardGrant(), '2025-01-01T00:00:00.000Z');

    expect(position.nextVestDate.toISOString()).toContain('2025-02-01');
    expect(position.nextVestOptions).toBe(20);
  });

  it('reports no next date once fully vested', () => {
    expect(vestedAsOf(standardGrant(), '2028-06-01').nextVestDate).toBeNull();
  });

  it('nets already-exercised options out of the exercisable count', () => {
    // `vested` alone would tell an employee they can exercise options they took
    // up last year.
    const position = vestedAsOf(
      { ...standardGrant(), optionsExercised: 100 },
      '2025-01-01T00:00:00.000Z',
    );

    expect(position.vested).toBe(240);
    expect(position.exercised).toBe(100);
    expect(position.exercisable).toBe(140);
  });

  it('never reports a negative exercisable count', () => {
    // A data-entry error recording more exercises than have vested must not
    // produce a negative number that a caller then treats as a limit.
    const position = vestedAsOf(
      { ...standardGrant(), optionsExercised: 900 },
      '2025-01-01T00:00:00.000Z',
    );

    expect(position.exercisable).toBe(0);
  });

  it('reports invalid terms rather than a zero position', () => {
    const position = vestedAsOf(
      { ...standardGrant(), cliffMonths: 99 },
      '2026-01-01',
    );

    expect(position.valid).toBe(false);
    expect(position.errors.length).toBeGreaterThan(0);
  });
});

describe('computePerquisite — s.17(2)(vi)', () => {
  it('values the spread between FMV and strike', () => {
    const result = computePerquisite({
      optionsExercised: 100,
      fmvPerShare: 250,
      exercisePrice: 10,
      taxRatePercent: 30,
    });

    expect(result.spreadPerShare).toBe(240);
    expect(result.perquisiteValue).toBe(24000);
    expect(result.tdsWithheld).toBe(7200);
    expect(result.underwater).toBe(false);
  });

  it('floors an underwater option at zero rather than emitting a negative', () => {
    // A negative perquisite fed into payroll is a refund of tax that was never
    // withheld. It is also the sort of wrong that reconciles to nothing.
    const result = computePerquisite({
      optionsExercised: 100,
      fmvPerShare: 5,
      exercisePrice: 10,
    });

    expect(result.spreadPerShare).toBe(-5);
    expect(result.underwater).toBe(true);
    expect(result.perquisiteValue).toBe(0);
    expect(result.tdsWithheld).toBe(0);
  });

  it('treats an at-the-money exercise as zero perquisite, not underwater', () => {
    const result = computePerquisite({
      optionsExercised: 100,
      fmvPerShare: 10,
      exercisePrice: 10,
    });

    expect(result.perquisiteValue).toBe(0);
    expect(result.underwater).toBe(false);
  });

  it('makes the whole FMV taxable on a nil-cost grant', () => {
    // RSU-style grants at zero strike are real, and s.17(2)(vi) makes the
    // entire fair market value the perquisite.
    const result = computePerquisite({
      optionsExercised: 50,
      fmvPerShare: 100,
      exercisePrice: 0,
    });

    expect(result.perquisiteValue).toBe(5000);
    expect(result.exerciseCost).toBe(0);
  });

  it('carries the FMV forward as the capital-gains cost basis', () => {
    // Without this the same gain is taxed twice: once as a perquisite at
    // exercise and again as a capital gain on sale.
    const result = computePerquisite({
      optionsExercised: 100,
      fmvPerShare: 250,
      exercisePrice: 10,
    });

    expect(result.capitalGainsCostBasis).toBe(25000);
    expect(result.exerciseCost).toBe(1000);
  });

  it('defaults the withholding rate to 30 per cent', () => {
    const result = computePerquisite({
      optionsExercised: 10,
      fmvPerShare: 110,
      exercisePrice: 10,
    });

    expect(result.taxRatePercent).toBe(30);
    expect(result.tdsWithheld).toBe(300);
  });

  it('floors a fractional option count', () => {
    const result = computePerquisite({
      optionsExercised: 10.9,
      fmvPerShare: 20,
      exercisePrice: 10,
    });

    expect(result.optionsExercised).toBe(10);
    expect(result.perquisiteValue).toBe(100);
  });
});

describe('computeForfeitureOnExit', () => {
  it('lapses the unvested and retains the vested', () => {
    const outcome = computeForfeitureOnExit(
      standardGrant(),
      '2025-01-01T00:00:00.000Z',
      90,
    );

    expect(outcome.optionsForfeited).toBe(760);
    expect(outcome.optionsRetained).toBe(240);
    expect(outcome.resultingStatus).toBe(GRANT_STATUS.ACTIVE);
  });

  it('reports the date the exercise window closes', () => {
    // The single most useful thing to be able to tell a leaver, and the reason
    // this is returned rather than computed internally.
    const outcome = computeForfeitureOnExit(
      standardGrant(),
      '2025-01-01T00:00:00.000Z',
      90,
    );

    expect(outcome.exerciseWindowClosesOn.toISOString()).toContain(
      '2025-04-01',
    );
  });

  it('forfeits everything when the holder leaves before the cliff', () => {
    const outcome = computeForfeitureOnExit(standardGrant(), '2024-06-01', 90);

    expect(outcome.optionsForfeited).toBe(1000);
    expect(outcome.optionsRetained).toBe(0);
    expect(outcome.resultingStatus).toBe(GRANT_STATUS.FORFEITED);
  });

  it('flags a zero-day window as an immediate lapse', () => {
    // "retained: 240, window: 0 days" is otherwise easy to read as good news.
    const outcome = computeForfeitureOnExit(standardGrant(), '2025-01-01', 0);

    expect(outcome.optionsRetained).toBe(240);
    expect(outcome.lapsesImmediately).toBe(true);
  });

  it('does not flag an immediate lapse when nothing was retained', () => {
    const outcome = computeForfeitureOnExit(standardGrant(), '2024-06-01', 0);

    expect(outcome.lapsesImmediately).toBe(false);
  });

  it('excludes already-exercised options from what is retained', () => {
    const outcome = computeForfeitureOnExit(
      { ...standardGrant(), optionsExercised: 100 },
      '2025-01-01',
      90,
    );

    expect(outcome.optionsRetained).toBe(140);
    expect(outcome.optionsAlreadyExercised).toBe(100);
  });
});

describe('summarisePool', () => {
  const scheme = { authorisedPool: 10000 };

  it('nets forfeitures back into the available pool', () => {
    // Forfeited options return to the pool, which is why this cannot be a
    // running counter on the scheme document.
    const pool = summarisePool(scheme, [
      { optionsGranted: 4000, optionsExercised: 1000, optionsForfeited: 500 },
      { optionsGranted: 2000, optionsExercised: 0, optionsForfeited: 0 },
    ]);

    expect(pool.optionsGranted).toBe(6000);
    expect(pool.optionsForfeited).toBe(500);
    expect(pool.optionsCommitted).toBe(5500);
    expect(pool.optionsAvailable).toBe(4500);
    expect(pool.overCommitted).toBe(false);
  });

  it('flags over-commitment rather than reporting a negative balance', () => {
    const pool = summarisePool(scheme, [
      { optionsGranted: 12000, optionsExercised: 0, optionsForfeited: 0 },
    ]);

    expect(pool.overCommitted).toBe(true);
    expect(pool.overCommitmentBy).toBe(2000);
    expect(pool.optionsAvailable).toBe(0);
  });

  it('reports an empty scheme cleanly', () => {
    const pool = summarisePool(scheme, []);

    expect(pool.optionsAvailable).toBe(10000);
    expect(pool.utilisationPercent).toBe(0);
  });

  it('does not divide by zero on an unauthorised scheme', () => {
    expect(summarisePool({ authorisedPool: 0 }, []).utilisationPercent).toBe(0);
  });
});

describe('canGrant', () => {
  const scheme = { authorisedPool: 1000 };

  it('allows a grant the pool can absorb', () => {
    expect(canGrant(scheme, [], 500).allowed).toBe(true);
  });

  it('allows a grant that exactly exhausts the pool', () => {
    // Off-by-one guard: the boundary is inclusive.
    expect(canGrant(scheme, [], 1000).allowed).toBe(true);
  });

  it('refuses one option past the pool, with the numbers in the reason', () => {
    const result = canGrant(scheme, [], 1001);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('1000 options available');
    expect(result.reason).toContain('1001 requested');
  });

  it('refuses a non-positive request', () => {
    expect(canGrant(scheme, [], 0).allowed).toBe(false);
    expect(canGrant(scheme, [], -50).allowed).toBe(false);
  });

  it('counts existing grants against the pool', () => {
    const grants = [
      { optionsGranted: 800, optionsExercised: 0, optionsForfeited: 0 },
    ];

    expect(canGrant(scheme, grants, 200).allowed).toBe(true);
    expect(canGrant(scheme, grants, 201).allowed).toBe(false);
  });

  it('frees a forfeited grant back up for re-granting', () => {
    const grants = [
      { optionsGranted: 800, optionsExercised: 0, optionsForfeited: 800 },
    ];

    expect(canGrant(scheme, grants, 1000).allowed).toBe(true);
  });
});

describe('calculateTenderAllocations', () => {
  const tenderOffer = {
    totalPoolShares: 1000,
    offerPricePerShare: 150,
    totalBudget: 150000,
    defaultTaxRatePercent: 20,
  };

  it('allocates 100% of bids when not oversubscribed', () => {
    const bids = [
      { employeeId: 'emp1', sharesOffered: 400, costBasisPerShare: 50 },
      { employeeId: 'emp2', sharesOffered: 500, costBasisPerShare: 50 },
    ];

    const result = calculateTenderAllocations(tenderOffer, bids);
    expect(result.isOversubscribed).toBe(false);
    expect(result.totalSharesBid).toBe(900);
    expect(result.totalSharesAllocated).toBe(900);

    const alloc1 = result.allocations[0];
    expect(alloc1.sharesAllocated).toBe(400);
    expect(alloc1.grossProceeds).toBe(60000); // 400 * 150
    expect(alloc1.capitalGainsTax).toBe(8000); // (60000 - 20000) * 0.20
    expect(alloc1.netProceeds).toBe(52000);
  });

  it('scales down allocations pro-rata when oversubscribed', () => {
    const bids = [
      { employeeId: 'emp1', sharesOffered: 1000, costBasisPerShare: 50 },
      { employeeId: 'emp2', sharesOffered: 1000, costBasisPerShare: 50 },
    ]; // 2000 bid vs 1000 pool -> 50% allocation

    const result = calculateTenderAllocations(tenderOffer, bids);
    expect(result.isOversubscribed).toBe(true);
    expect(result.totalSharesBid).toBe(2000);
    expect(result.totalSharesAllocated).toBe(1000);

    expect(result.allocations[0].sharesAllocated).toBe(500);
    expect(result.allocations[1].sharesAllocated).toBe(500);
  });
});
