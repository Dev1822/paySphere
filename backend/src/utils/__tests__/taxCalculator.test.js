const {
  isUnbounded,
  sortSlabs,
  taxableWithin,
  validateSlabs,
  taxOn,
  taxOnBonus,
  effectiveRate,
} = require('../taxCalculator');

/**
 * The Indian old-regime shape, which is what `#586`'s field names describe.
 *
 *   0 – 2,50,000    @  0%
 *   2,50,000 – 5,00,000  @  5%
 *   5,00,000 – 10,00,000 @ 20%
 *   10,00,000 +          @ 30%
 */
const slabs = () => [
  { minIncome: 0, maxIncome: 250000, ratePercentage: 0 },
  { minIncome: 250000, maxIncome: 500000, ratePercentage: 5 },
  { minIncome: 500000, maxIncome: 1000000, ratePercentage: 20 },
  { minIncome: 1000000, maxIncome: null, ratePercentage: 30 },
];

/**
 * The same table with a *bounded* top slab, which is where #586 lost income:
 * its loop ended when the slabs ran out, so everything above ₹10,00,000 was
 * charged nothing.
 *
 * This is now rejected as a configuration rather than being given a rate —
 * what to charge above the cap is a policy question, and guessing at it is how
 * a payroll silently charges the wrong amount.
 */
const cappedSlabs = () => [
  { minIncome: 0, maxIncome: 250000, ratePercentage: 0 },
  { minIncome: 250000, maxIncome: 500000, ratePercentage: 5 },
  { minIncome: 500000, maxIncome: 1000000, ratePercentage: 20 },
];

describe('taxOn — the answers a progressive table should give (#616)', () => {
  test.each([
    ['below the exemption', 200000, 0],
    ['exactly at the exemption', 250000, 0],
    ['inside the 5% slab', 300000, 2500],
    ['at the top of the 5% slab', 500000, 12500],
    ['inside the 20% slab', 700000, 52500],
    ['at the top of the 20% slab', 1000000, 112500],
    ['inside the 30% slab', 1200000, 172500],
  ])('%s: %i → %i', (_label, gross, expected) => {
    expect(taxOn(gross, slabs()).totalTax).toBe(expected);
  });
});

/**
 * Each of these is a specific way `#586`'s running-remainder loop went wrong.
 * The comment on each records the number it produced.
 */
describe('taxOn — the four defects in #586 (#616)', () => {
  test('a table that would leave income untaxed is refused, not silently applied', () => {
    // #586 walked the slabs and stopped when they ran out, so ₹10,00,000 of a
    // ₹20,00,000 income was never taxed at all and it returned 112,500 with no
    // indication anything was missing. The table itself is the defect.
    expect(validateSlabs(cappedSlabs()).join(' ')).toMatch(
      /highest slab must be open-ended/,
    );
  });

  test('with an open-ended top slab, no income escapes', () => {
    const { totalTax, breakdown } = taxOn(2000000, slabs());
    const covered = breakdown.reduce((sum, row) => sum + row.taxableAmount, 0);

    expect(covered).toBe(2000000);
    expect(totalTax).toBe(112500 + 1000000 * 0.3);
  });

  test('the answer does not depend on the order the slabs are stored in', () => {
    const shuffled = [slabs()[2], slabs()[0], slabs()[3], slabs()[1]];

    // `brackets` is a plain subdocument array with no ordering guarantee. With
    // the 20% slab first, #586 charged 20% on the whole ₹3,00,000 — ₹60,000
    // against a correct ₹2,500, a 24× overcharge from nothing but row order.
    expect(taxOn(300000, shuffled).totalTax).toBe(2500);
    expect(taxOn(300000, shuffled).totalTax).toBe(taxOn(300000, slabs()).totalTax);
  });

  test('every ordering of the same table gives the same answer', () => {
    const table = slabs();
    const orderings = [
      [0, 1, 2, 3],
      [3, 2, 1, 0],
      [2, 0, 3, 1],
      [1, 3, 0, 2],
    ];

    const answers = orderings.map((order) =>
      taxOn(1200000, order.map((i) => table[i])).totalTax,
    );

    expect(new Set(answers).size).toBe(1);
    expect(answers[0]).toBe(172500);
  });

  test('a ceiling of 0 is a real ceiling, not "unbounded"', () => {
    const table = [
      { minIncome: 0, maxIncome: 0, ratePercentage: 40 },
      { minIncome: 0, maxIncome: null, ratePercentage: 10 },
    ];

    // #586 used `bracket.maxIncome ? ... : ...`, so the first slab was read as
    // the open-ended one and charged 40% on everything.
    expect(taxOn(100000, table).totalTax).toBe(10000);
  });

  test('fixedDeduction is charged once, on the slab the income lands in', () => {
    const table = [
      { minIncome: 0, maxIncome: 250000, ratePercentage: 0, fixedDeduction: 0 },
      { minIncome: 250000, maxIncome: 500000, ratePercentage: 5, fixedDeduction: 1000 },
      { minIncome: 500000, maxIncome: null, ratePercentage: 20, fixedDeduction: 5000 },
    ];

    // Income lands in the 20% slab, so it pays that slab's 5,000 — not the
    // 1,000 from the slab below it as well. #586 added it inside the loop and
    // charged 6,000.
    const { totalTax } = taxOn(700000, table);

    expect(totalTax).toBe(12500 + 40000 + 5000);
  });

  test('an income that never reaches a slab does not pay its fixed component', () => {
    const table = [
      { minIncome: 0, maxIncome: 250000, ratePercentage: 0, fixedDeduction: 0 },
      { minIncome: 250000, maxIncome: null, ratePercentage: 5, fixedDeduction: 9999 },
    ];

    expect(taxOn(200000, table).totalTax).toBe(0);
  });
});

describe('taxOn — degenerate inputs (#616)', () => {
  test.each([
    ['zero', 0],
    ['negative', -50000],
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['a non-number', 'lots'],
    ['undefined', undefined],
  ])('%s income owes nothing rather than producing a strange number', (_label, gross) => {
    const { totalTax } = taxOn(gross, slabs());

    expect(totalTax).toBe(0);
    expect(Number.isFinite(totalTax)).toBe(true);
  });

  test('an empty table owes nothing', () => {
    expect(taxOn(1200000, []).totalTax).toBe(0);
    expect(taxOn(1200000, undefined).totalTax).toBe(0);
  });

  test('the total is never negative', () => {
    expect(taxOn(300000, slabs()).totalTax).toBeGreaterThanOrEqual(0);
  });
});

describe('taxOn — the breakdown (#616)', () => {
  test('shows only the slabs the income actually reaches', () => {
    const { breakdown } = taxOn(300000, slabs());

    expect(breakdown).toHaveLength(2);
    expect(breakdown[1]).toMatchObject({
      minIncome: 250000,
      ratePercentage: 5,
      taxableAmount: 50000,
      tax: 2500,
    });
  });

  test('the parts sum to the total', () => {
    const { totalTax, breakdown } = taxOn(1200000, slabs());
    const summed = breakdown.reduce((acc, row) => acc + row.tax, 0);

    expect(summed).toBeCloseTo(totalTax, 2);
  });

  test('is in slab order regardless of how the table was stored', () => {
    const shuffled = [slabs()[3], slabs()[1], slabs()[2], slabs()[0]];
    const { breakdown } = taxOn(1200000, shuffled);

    expect(breakdown.map((r) => r.minIncome)).toEqual([0, 250000, 500000, 1000000]);
  });

  test('reports an open-ended slab as null rather than a number', () => {
    const { breakdown } = taxOn(1200000, slabs());

    expect(breakdown.at(-1).maxIncome).toBeNull();
  });
});

describe('taxOnBonus (#2086)', () => {
  test('SUPPLEMENTAL method applies a flat rate to the bonus', () => {
    expect(taxOnBonus(50000, 60000, slabs(), { method: 'SUPPLEMENTAL', supplementalRate: 22 })).toBe(11000);
  });

  test('SUPPLEMENTAL method defaults to 22% rate if not specified', () => {
    expect(taxOnBonus(10000, 50000, slabs(), { method: 'SUPPLEMENTAL' })).toBe(2200);
  });

  test('AGGREGATE method computes marginal tax accurately', () => {
    // Base salary = 6,00,000 (tax = 12500 + 100000 * 0.2 = 32500)
    // Base + Bonus = 6,50,000 (tax = 12500 + 150000 * 0.2 = 42500)
    // Bonus Tax = 42500 - 32500 = 10000 (which is exactly 20% on 50k)
    expect(taxOnBonus(50000, 600000, slabs(), { method: 'AGGREGATE' })).toBe(10000);
  });
});

describe('taxableWithin (#616)', () => {
  test('a slab entirely below the income yields its full width', () => {
    expect(taxableWithin({ minIncome: 0, maxIncome: 250000 }, 900000)).toBe(250000);
  });

  test('a slab the income stops inside yields the part it reaches', () => {
    expect(taxableWithin({ minIncome: 250000, maxIncome: 500000 }, 300000)).toBe(50000);
  });

  test('a slab entirely above the income yields nothing', () => {
    expect(taxableWithin({ minIncome: 500000, maxIncome: 1000000 }, 300000)).toBe(0);
  });

  test('an open-ended slab yields everything above its floor', () => {
    expect(taxableWithin({ minIncome: 1000000, maxIncome: null }, 1200000)).toBe(200000);
  });
});

describe('isUnbounded (#616)', () => {
  test('null and undefined mean open-ended', () => {
    expect(isUnbounded(null)).toBe(true);
    expect(isUnbounded(undefined)).toBe(true);
  });

  test('zero does not', () => {
    // The exact distinction #586's truthiness test lost.
    expect(isUnbounded(0)).toBe(false);
  });
});

describe('sortSlabs (#616)', () => {
  test('orders by floor', () => {
    const shuffled = [slabs()[2], slabs()[0], slabs()[3], slabs()[1]];

    expect(sortSlabs(shuffled).map((s) => s.minIncome)).toEqual([
      0, 250000, 500000, 1000000,
    ]);
  });

  test('does not reorder the caller\'s array', () => {
    // It is a mongoose subdocument array; reordering it in place would mark the
    // document dirty and rewrite the stored table.
    const original = [slabs()[2], slabs()[0]];
    const before = original.map((s) => s.minIncome);

    sortSlabs(original);

    expect(original.map((s) => s.minIncome)).toEqual(before);
  });

  test('drops entries with no usable floor rather than throwing', () => {
    expect(sortSlabs([{ ratePercentage: 5 }, null, ...slabs()])).toHaveLength(4);
  });
});

describe('validateSlabs (#616)', () => {
  test('a well-formed table has no errors', () => {
    expect(validateSlabs(slabs())).toEqual([]);
  });

  test('an empty table is rejected', () => {
    expect(validateSlabs([])).toContain('A tax table needs at least one slab');
    expect(validateSlabs(undefined)).toHaveLength(1);
  });

  test('a rate outside 0–100 is rejected', () => {
    const table = slabs();
    table[1].ratePercentage = -5;

    expect(validateSlabs(table).join(' ')).toMatch(/between 0 and 100/);
  });

  test('a rate above 100 is rejected', () => {
    const table = slabs();
    table[1].ratePercentage = 900;

    expect(validateSlabs(table).join(' ')).toMatch(/between 0 and 100/);
  });

  test('a ceiling below the floor is rejected', () => {
    const table = slabs();
    table[1].maxIncome = 100000;

    expect(validateSlabs(table).join(' ')).toMatch(/greater than minIncome/);
  });

  test('a gap between slabs is rejected', () => {
    const table = slabs();
    table[2].minIncome = 600000;

    // #586 summed band widths, so the ₹1,00,000 nobody claimed was silently
    // under-taxed rather than reported.
    expect(validateSlabs(table).join(' ')).toMatch(/leave a gap between 500000 and 600000/);
  });

  test('overlapping slabs are rejected', () => {
    const table = slabs();
    table[2].minIncome = 400000;

    expect(validateSlabs(table).join(' ')).toMatch(/overlap/);
  });

  test('an open-ended slab that is not the highest is rejected', () => {
    const table = slabs();
    table[1].maxIncome = null;

    // Everything above it would be unreachable — the income is already inside
    // the open-ended slab.
    expect(validateSlabs(table).join(' ')).toMatch(/open-ended but is not the highest/);
  });

  test('a bounded top slab is rejected — income above it would escape', () => {
    expect(validateSlabs(cappedSlabs()).join(' ')).toMatch(
      /highest slab must be open-ended/,
    );
  });

  test('a single open-ended slab is a valid flat-rate table', () => {
    expect(validateSlabs([{ minIncome: 0, maxIncome: null, ratePercentage: 10 }])).toEqual(
      [],
    );
  });

  test('validates the table however it is ordered', () => {
    const shuffled = [slabs()[2], slabs()[0], slabs()[3], slabs()[1]];

    expect(validateSlabs(shuffled)).toEqual([]);
  });

  test('reports every problem at once', () => {
    const table = [
      { minIncome: 0, maxIncome: 100, ratePercentage: -1 },
      { minIncome: 500, maxIncome: 200, ratePercentage: 900 },
    ];

    expect(validateSlabs(table).length).toBeGreaterThanOrEqual(3);
  });
});

describe('effectiveRate (#616)', () => {
  test('is the share of gross taken by tax and contributions', () => {
    expect(effectiveRate(172500, 0, 1200000)).toBeCloseTo(14.38, 2);
  });

  test('includes social security', () => {
    expect(effectiveRate(100000, 20000, 1000000)).toBe(12);
  });

  test.each([
    ['zero income', 0],
    ['negative income', -1],
    ['NaN', NaN],
    ['undefined', undefined],
  ])('%s gives 0, not NaN', (_label, gross) => {
    const rate = effectiveRate(0, 0, gross);

    // `#586` computed `(0 + 0) / 0` = NaN, which JSON.stringify renders as
    // `null` — indistinguishable from a missing field.
    expect(rate).toBe(0);
    expect(Number.isNaN(rate)).toBe(false);
  });

  test('survives a round trip through JSON', () => {
    const payload = JSON.parse(JSON.stringify({ effectiveRate: effectiveRate(0, 0, 0) }));

    expect(payload.effectiveRate).toBe(0);
    expect(payload.effectiveRate).not.toBeNull();
  });
});
