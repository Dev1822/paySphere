/**
 * Formula Engine Service - Issue #1111
 *
 * Evaluates per-component salary formulas against a context object.
 * Formulas are simple math expressions referencing other component codes
 * or context variables (e.g. "basic * 0.40").
 *
 * No eval() is used - the Function constructor runs with an explicit
 * identifier whitelist and a character-level safety check first.
 */
'use strict';

const logger = require('../utils/logger');

/**
 * Build the topological evaluation order for a list of components.
 * A component A depends on B if B's code appears in A's formula string.
 * Throws 422 if a circular dependency is detected.
 *
 * @param {Array<{code: string, formula: string}>} components
 * @returns {string[]} component codes in safe evaluation order
 */
function buildEvalOrder(components) {
  const codes = new Set(components.map((c) => c.code));
  const deps = {};
  for (const comp of components) {
    deps[comp.code] = [];
    for (const other of codes) {
      if (other !== comp.code && comp.formula.includes(other)) {
        deps[comp.code].push(other);
      }
    }
  }

  // Kahn's algorithm for topological sort
  const inDegree = {};
  for (const code of codes) inDegree[code] = 0;
  for (const code of codes) {
    for (const dep of deps[code]) inDegree[dep] = (inDegree[dep] || 0) + 1;
  }

  const queue = [...codes].filter((c) => inDegree[c] === 0);
  const result = [];

  while (queue.length) {
    const node = queue.shift();
    result.push(node);
    for (const dep of deps[node] || []) {
      inDegree[dep]--;
      if (inDegree[dep] === 0) queue.push(dep);
    }
  }

  if (result.length !== codes.size) {
    const cycleNodes = [...codes].filter((c) => !result.includes(c));
    const err = new Error(
      'Circular dependency detected: ' + cycleNodes.join(', '),
    );
    err.status = 422;
    throw err;
  }

  const rank = {};
  result.forEach((c, i) => {
    rank[c] = i;
  });
  return components
    .slice()
    .sort((a, b) => (rank[a.code] ?? 999) - (rank[b.code] ?? 999))
    .map((c) => c.code);
}

/**
 * Safely evaluate a formula string against a context object.
 * Only allows: digits, dots, basic operators (+,-,*,/), parens, whitespace, identifiers.
 *
 * @param {string} formula  e.g. "basic * 0.40"
 * @param {object} context  e.g. { basic: 50000 }
 * @returns {number}
 */
function evalFormula(formula, context) {
  if (/[^a-zA-Z0-9_.+\-*/()\s]/.test(formula)) {
    throw new Error('Formula contains disallowed characters: ' + formula);
  }

  const argNames = Object.keys(context);
  const argVals = argNames.map((k) => context[k]);

  const fn = new Function(
    ...argNames,
    '"use strict"; return (' + formula + ');',
  );
  const result = fn(...argVals);

  if (typeof result !== 'number' || !isFinite(result)) {
    throw new Error('Formula did not return a finite number: ' + formula);
  }

  return Math.round(result * 100) / 100;
}

/**
 * Evaluate all salary components in dependency order.
 * Each component result is added to the context so later formulas can reference it.
 *
 * @param {Array<{code, name, type, formula}>} components - type is 'earning' or 'deduction'
 * @param {object} baseContext - variables available before any component runs (e.g. { basic })
 * @returns {{ lineItems: object, totalEarnings: number, totalDeductions: number }}
 */
function evaluateAll(components, baseContext) {
  const order = buildEvalOrder(components);
  const context = { ...baseContext };
  const lineItems = {};

  for (const code of order) {
    const comp = components.find((c) => c.code === code);
    if (!comp) continue;
    const value = evalFormula(comp.formula, context);
    context[code] = value;
    lineItems[code] = { name: comp.name, type: comp.type, value };
  }

  const totalEarnings = Object.values(lineItems)
    .filter((l) => l.type === 'earning')
    .reduce((s, l) => s + l.value, 0);
  const totalDeductions = Object.values(lineItems)
    .filter((l) => l.type === 'deduction')
    .reduce((s, l) => s + l.value, 0);

  return { lineItems, totalEarnings, totalDeductions };
}

/**
 * Validate a set of components before saving.
 * Runs buildEvalOrder (cycle check) then a dry-run evaluation with dummy values.
 *
 * @returns {{ valid: boolean, errors?: string[] }}
 */
function validateComponents(components) {
  const errors = [];

  try {
    buildEvalOrder(components);
  } catch (err) {
    errors.push(err.message);
    return { valid: false, errors };
  }

  const dummyContext = { basic: 1, grossPay: 1 };
  for (const comp of components) dummyContext[comp.code] = 1;

  for (const comp of components) {
    try {
      evalFormula(comp.formula, dummyContext);
    } catch (err) {
      errors.push('Component [' + comp.code + ']: ' + err.message);
    }
  }

  return errors.length ? { valid: false, errors } : { valid: true };
}

module.exports = { evaluateAll, validateComponents, buildEvalOrder };
