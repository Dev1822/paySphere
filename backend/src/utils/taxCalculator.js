/**
 * Progressive slab arithmetic for the global tax engine (#586, corrected in
 * #616).
 *
 * `#586` walked the slab array subtracting band widths from a running remainder:
 *
 *     let remainingIncome = grossAnnualIncome;
 *     for (const bracket of taxConfig.brackets) {
 *       if (remainingIncome <= 0) break;
 *       const taxableInBracket = bracket.maxIncome
 *         ? Math.min(remainingIncome, bracket.maxIncome - bracket.minIncome)
 *         : remainingIncome;
 *       totalTax += taxableInBracket * (bracket.ratePercentage / 100) + bracket.fixedDeduction;
 *       remainingIncome -= taxableInBracket;
 *     }
 *
 * That produces the right answer only when the slabs happen to be stored in
 * ascending order, start at zero, are perfectly contiguous, and the top one is
 * open-ended. Break any of those and it is quietly wrong:
 *
 *   - The loop simply ends when the slabs run out, so income above a bounded
 *     top slab is taxed at nothing at all.
 *   - `brackets` is a plain subdocument array with no ordering guarantee, so a
 *     slab added later sits at the end. With `[500k–1000k @20%]` first, a gross
 *     of ₹3,00,000 is charged 20% on the whole amount — ₹60,000 against a
 *     correct ₹2,500.
 *   - `bracket.maxIncome ? ... : ...` is a truthiness test, so `maxIncome: 0`
 *     or `null` is read as "unbounded" and swallows the entire remainder.
 *   - `fixedDeduction` is added inside the loop, so it accumulates once per slab
 *     the income passes through rather than once.
 *
 * The fix is to stop tracking a remainder and slice the income at each slab's
 * own boundaries instead. Every slab then answers independently — "how much of
 * this income falls inside me?" — which makes the result impossible to affect
 * by array order and correct whatever the top slab looks like.
 *
 * Pure functions, no database: the arithmetic is the part that was wrong, so it
 * is the part that gets asserted directly. `#586` shipped with no tests.
 */

/**
 * Money is compared and reported to two decimal places.
 *
 * Shifted through a string rather than multiplied by 100, because
 * `14.375 * 100` is `1437.4999999999998` in binary floating point and rounds
 * down — so an effective rate of 14.375% reported as 14.37 rather than 14.38.
 * `Number("14.375e2")` is exactly 1437.5.
 */
function round2(n) {
  if (!Number.isFinite(n)) return 0;

  return Number(`${Math.round(Number(`${n}e2`))}e-2`);
}

/**
 * Is this an open-ended slab?
 *
 * Only `null` and `undefined` mean "no upper bound". `#586` used a truthiness
 * test, which also caught `0` — a slab bounded at zero was read as the top slab
 * and taxed everything above it at its own rate.
 *
 * @param {*} maxIncome
 * @returns {boolean}
 */
function isUnbounded(maxIncome) {
  return maxIncome === null || maxIncome === undefined;
}

/**
 * Slabs in the order income actually passes through them.
 *
 * Returns a new array; the caller's is a mongoose subdocument array and must
 * not be reordered in place.
 *
 * @param {object[]} brackets
 * @returns {object[]}
 */
function sortSlabs(brackets) {
  return [...(Array.isArray(brackets) ? brackets : [])]
    .filter((b) => b && Number.isFinite(Number(b.minIncome)))
    .sort((a, b) => Number(a.minIncome) - Number(b.minIncome));
}

/**
 * How much of `gross` falls inside this slab.
 *
 * The whole correction, in one expression: the slab's own floor and ceiling
 * decide, not a running remainder. A slab entirely above the income yields 0;
 * a slab entirely below it yields its full width.
 *
 * @param {{minIncome: number, maxIncome?: number|null}} slab
 * @param {number} gross
 * @returns {number}
 */
function taxableWithin(slab, gross) {
  const floor = Number(slab.minIncome) || 0;
  const ceiling = isUnbounded(slab.maxIncome) ? Infinity : Number(slab.maxIncome);

  return Math.max(0, Math.min(gross, ceiling) - floor);
}

/**
 * Structural problems with a slab table, as human-readable strings.
 *
 * Returns all of them rather than the first, so an administrator fixing a table
 * sees everything wrong with it at once.
 *
 * @param {object[]} brackets
 * @returns {string[]} empty when the table is usable
 */
function validateSlabs(brackets) {
  const errors = [];
  const slabs = sortSlabs(brackets);

  if (slabs.length === 0) {
    errors.push('A tax table needs at least one slab');
    return errors;
  }

  slabs.forEach((slab, index) => {
    const min = Number(slab.minIncome);
    const rate = Number(slab.ratePercentage);

    if (min < 0) {
      errors.push(`Slab ${index + 1}: minIncome cannot be negative`);
    }

    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      errors.push(`Slab ${index + 1}: ratePercentage must be between 0 and 100`);
    }

    if (!isUnbounded(slab.maxIncome) && Number(slab.maxIncome) <= min) {
      errors.push(`Slab ${index + 1}: maxIncome must be greater than minIncome`);
    }
  });

  // Every slab but the last needs an upper bound, or the ones after it are
  // unreachable — the income is already inside the open-ended one.
  slabs.slice(0, -1).forEach((slab, index) => {
    if (isUnbounded(slab.maxIncome)) {
      errors.push(
        `Slab ${index + 1} is open-ended but is not the highest slab`,
      );
    }
  });

  // ...and the last one must *not* have an upper bound, or income above it
  // belongs to no slab and is charged nothing. That is the largest of #586's
  // defects: its loop simply ended when the slabs ran out, so a table capped at
  // ₹10,00,000 taxed a ₹20,00,000 income on half of it.
  //
  // Refusing the table is the right answer rather than extending the top rate
  // upwards: what should be charged above the cap is a policy question, and
  // guessing at it is how a payroll silently charges the wrong amount.
  if (!isUnbounded(slabs[slabs.length - 1].maxIncome)) {
    errors.push(
      'The highest slab must be open-ended, or income above it would be untaxed',
    );
  }

  for (let i = 1; i < slabs.length; i += 1) {
    const previous = slabs[i - 1];
    const current = slabs[i];
    if (isUnbounded(previous.maxIncome)) continue;

    const previousMax = Number(previous.maxIncome);
    const currentMin = Number(current.minIncome);

    if (currentMin < previousMax) {
      // Overlapping slabs tax the same rupee twice.
      errors.push(`Slabs ${i} and ${i + 1} overlap`);
    } else if (currentMin > previousMax) {
      // A gap is income nobody claims, which `#586`'s band-width arithmetic
      // silently under-taxed.
      errors.push(
        `Slabs ${i} and ${i + 1} leave a gap between ${previousMax} and ${currentMin}`,
      );
    }
  }

  return errors;
}

/**
 * Tax on a gross annual income, and the slabs that produced it.
 *
 * `fixedDeduction` is applied **once**, on the slab the income lands in — the
 * "₹12,500 + 20% of the amount over ₹5,00,000" form. `#586` added it inside the
 * loop, so an income reaching the fourth slab paid all four slabs' fixed
 * components.
 *
 * @param {number} gross annual income
 * @param {object[]} brackets slab table, in any order
 * @returns {{totalTax: number, breakdown: Array<{minIncome: number, maxIncome: number|null, ratePercentage: number, taxableAmount: number, tax: number}>}}
 */
function taxOn(gross, brackets) {
  const income = Number(gross);
  if (!Number.isFinite(income) || income <= 0) {
    return { totalTax: 0, breakdown: [] };
  }

  const slabs = sortSlabs(brackets);
  const breakdown = [];
  let totalTax = 0;
  let landedSlab = null;

  for (const slab of slabs) {
    const taxableAmount = taxableWithin(slab, income);
    if (taxableAmount <= 0) continue;

    const rate = Number(slab.ratePercentage) || 0;
    const tax = taxableAmount * (rate / 100);

    totalTax += tax;
    // The highest slab the income actually reaches into.
    landedSlab = slab;

    breakdown.push({
      minIncome: Number(slab.minIncome) || 0,
      maxIncome: isUnbounded(slab.maxIncome) ? null : Number(slab.maxIncome),
      ratePercentage: rate,
      taxableAmount: round2(taxableAmount),
      tax: round2(tax),
    });
  }

  if (landedSlab) {
    totalTax += Number(landedSlab.fixedDeduction) || 0;
  }

  return { totalTax: round2(Math.max(0, totalTax)), breakdown };
}

/**
 * The share of gross income taken by tax and contributions.
 *
 * `#586` computed `((totalTax + socialSecurity) / grossAnnualIncome) * 100`
 * unguarded, so a gross of zero — an employee who joined at the end of the
 * period, or is on unpaid leave — produced `0/0` = `NaN`, which
 * `JSON.stringify` renders as `null` with no indication anything went wrong.
 *
 * @param {number} totalTax
 * @param {number} socialSecurity
 * @param {number} gross
 * @returns {number} a percentage, 0 when there is no income to take a share of
 */
function effectiveRate(totalTax, socialSecurity, gross) {
  const income = Number(gross);
  if (!Number.isFinite(income) || income <= 0) return 0;

  // Scaled before the division, not after. `(172500 / 1200000) * 100` is
  // 14.374999999999998 in binary floating point and rounds down to 14.37;
  // `(172500 * 100) / 1200000` is exactly 14.375 and rounds to 14.38.
  return round2(((totalTax + socialSecurity) * 100) / income);
}

/**
 * Calculates tax specifically on a bonus using either the AGGREGATE or SUPPLEMENTAL method.
 *
 * @param {number} bonus The bonus amount
 * @param {number} baseAnnualIncome The annualized base salary (gross - deductions)
 * @param {object[]} brackets The tax slabs
 * @param {object} [options={}] Options { method: 'AGGREGATE' | 'SUPPLEMENTAL', supplementalRate: number }
 * @returns {number} The tax amount to withhold from the bonus
 */
function taxOnBonus(bonus, baseAnnualIncome, brackets, options = {}) {
  const method = options.method || 'AGGREGATE';
  
  if (method === 'SUPPLEMENTAL') {
    const rate = Number(options.supplementalRate) || 22; // default flat supplemental rate
    return round2(bonus * (rate / 100));
  } else {
    // AGGREGATE method:
    // Tax is (Tax on base + bonus) - (Tax on base)
    const baseIncomeTax = taxOn(baseAnnualIncome, brackets).totalTax;
    const combinedIncomeTax = taxOn(baseAnnualIncome + bonus, brackets).totalTax;
    return round2(Math.max(0, combinedIncomeTax - baseIncomeTax));
  }
}

module.exports = {
  round2,
  isUnbounded,
  sortSlabs,
  taxableWithin,
  validateSlabs,
  taxOn,
  taxOnBonus,
  effectiveRate,
};
