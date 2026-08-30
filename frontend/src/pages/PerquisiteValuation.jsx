import { useCallback, useEffect, useMemo, useState } from 'react';

import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../utils/formatLocale';

/**
 * Perquisite valuation under Rule 3 (#1770).
 *
 * The page leads with the multiplier, because it is the fact nothing else in the
 * product can tell anybody: for an employee in employer-owned accommodation, a
 * further ₹1,000 of taxable allowance costs ₹1,100 of taxable income. The
 * allowance is inside the base the accommodation perquisite is a percentage of,
 * so the two cannot be computed independently and a salary review that assumes
 * they can is under-costing every raise.
 *
 * Each employee's lines are shown with their **basis** rather than only their
 * value, because Form 12BA asks for both and because a value with no working is
 * exactly what a person disputes. "10% of ₹9,60,000, for a city of 1,20,00,000"
 * is answerable; "₹96,000" is not.
 *
 * The rules panel puts the State Bank of India rate first. It is the one figure
 * here that has to be recorded once a year and then left alone, it applies to
 * every concessional loan in the establishment, and a point too low understates
 * the perquisite for every borrower with nothing on any payslip to show it.
 */

const KIND_LABELS = {
  ACCOMMODATION: 'Accommodation',
  FURNITURE: 'Furniture',
  MOTOR_CAR: 'Motor car',
  CONCESSIONAL_LOAN: 'Concessional loan',
  ESOP: 'Exercised options',
};

const FINDING_LABELS = {
  ALLOWANCE_COMPOUNDS: 'An allowance costs more than the allowance',
  RECOVERY_EXCEEDS_VALUE: 'Rent recovered above the value — not a deduction',
  HOTEL_BELOW_THRESHOLD: 'A hotel stay within the fifteen-day threshold',
  LOAN_BELOW_EXEMPT_AGGREGATE: 'A loan that never exceeded ₹20,000',
  LOAN_MEDICAL_EXEMPT: 'A loan for a specified medical treatment',
  PART_YEAR_OCCUPATION: 'Provided for part of the year',
  NO_RATE_ON_RECORD: 'No 1 April State Bank of India rate on record',
};

const SEVERITY_TONE = {
  ADJUSTED: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
  INFORMATIONAL:
    'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
};

const RULE_FIELDS = [
  ['ownedHighPopulation', 'Large city, above', 'Rule 3(1)'],
  ['ownedHighPercent', 'Large city, %', 'Rule 3(1)'],
  ['ownedMidPopulation', 'Mid city, above', 'Rule 3(1)'],
  ['ownedMidPercent', 'Mid city, %', 'Rule 3(1)'],
  ['ownedLowPercent', 'Small city, %', 'Rule 3(1)'],
  ['leasedPercent', 'Leased, %', 'Rule 3(1)'],
  ['hotelPercent', 'Hotel, %', 'Rule 3(1)'],
  ['hotelExemptDays', 'Hotel threshold, days', 'Rule 3(1), proviso'],
  ['furniturePercent', 'Furniture, % a year', 'Explanation 2'],
  ['smallCarMonthly', 'Car ≤1.6L, a month', 'Rule 3(2)'],
  ['largeCarMonthly', 'Car >1.6L, a month', 'Rule 3(2)'],
  ['driverMonthly', 'Driver, a month', 'Rule 3(2)'],
  ['loanExemptAggregate', 'Loan exempt below', 'Rule 3(7)(i)'],
];

const describeError = (error, fallback) => {
  const response = error?.response;
  if (!response) return 'Could not reach the server. Check your connection.';
  if (response.status === 403) {
    return 'You do not have permission to view perquisite valuations.';
  }
  return response.data?.message || fallback;
};

/** The Indian previous year a date falls in. */
const currentPreviousYear = () => {
  const now = new Date();
  return now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
};

const PerquisiteValuation = () => {
  const [previousYear, setPreviousYear] = useState(currentPreviousYear());

  const [result, setResult] = useState(null);
  const [rules, setRules] = useState(null);
  const [draft, setDraft] = useState(null);
  const [statements, setStatements] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [showRules, setShowRules] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);

  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const [previewRes, statementsRes] = await Promise.all([
        api.get('/api/perquisites/preview', { params: { previousYear } }),
        api.get('/api/perquisites/statements'),
      ]);

      setResult(previewRes.data?.result || null);
      setRules(previewRes.data?.rules || null);
      setDraft(previewRes.data?.rules || null);
      setStatements(
        Array.isArray(statementsRes.data?.statements)
          ? statementsRes.data.statements
          : [],
      );
    } catch (error) {
      setLoadError(
        describeError(error, 'Could not load the perquisite valuation.'),
      );
    } finally {
      setLoading(false);
    }
  }, [previousYear]);

  useEffect(() => {
    load();
  }, [load]);

  const commit = async () => {
    setBusy(true);
    try {
      await api.post('/api/perquisites/statements', { previousYear });
      toast('Form 12BA position committed.', 'success');
      await load();
    } catch (error) {
      toast(describeError(error, 'Could not commit the statement.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveRules = async (event) => {
    event.preventDefault();
    setBusy(true);

    try {
      await api.put('/api/perquisites/rules', { ...draft, previousYear });
      toast('Rules saved.', 'success');
      setShowRules(false);
      await load();
    } catch (error) {
      toast(describeError(error, 'Could not save the rules.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const setDraftField = (key) => (event) =>
    setDraft((previous) => ({
      ...previous,
      [key]: Number(event.target.value),
    }));

  /** Employees an allowance compounds for, first. */
  const employees = useMemo(() => {
    const rows = [...(result?.employees || [])];

    return rows.sort((a, b) => {
      const multiplier = (row) => row.marginalAllowanceMultiplier || 1;
      if (multiplier(a) !== multiplier(b)) {
        return multiplier(b) - multiplier(a);
      }
      return (b.total || 0) - (a.total || 0);
    });
  }, [result]);

  if (loading) {
    return (
      <div className="p-4 sm:p-8">
        <p className="text-sm text-gray-500 dark:text-slate-500">
          Loading the perquisite valuation…
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-serif text-gray-900 dark:text-white">
            Perquisites
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-500 mt-1 max-w-2xl">
            Accommodation is a percentage of salary, and salary includes every
            taxable allowance — so the two cannot be valued independently.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm text-gray-700 dark:text-slate-300">
            Previous year
            <select
              value={previousYear}
              onChange={(event) => setPreviousYear(Number(event.target.value))}
              className="mt-1 block p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
            >
              {[0, 1, 2, 3].map((back) => {
                const year = currentPreviousYear() - back;
                return (
                  <option key={year} value={year}>
                    {year}&ndash;{String(year + 1).slice(2)}
                  </option>
                );
              })}
            </select>
          </label>

          <button
            type="button"
            onClick={() => setShowRules((previous) => !previous)}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-700 text-sm text-gray-700 dark:text-slate-300"
          >
            {showRules ? 'Hide rules' : 'Rules'}
          </button>

          <button
            type="button"
            onClick={commit}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Commit Form 12BA'}
          </button>
        </div>
      </div>

      {loadError && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
          {loadError}
        </div>
      )}

      {showRules && draft && (
        <form
          onSubmit={saveRules}
          className="mb-8 p-5 rounded-xl border border-gray-200 dark:border-slate-800"
        >
          <h2 className="text-lg font-serif text-gray-900 dark:text-white mb-1">
            The notified figures for {previousYear}&ndash;
            {String(previousYear + 1).slice(2)}
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-500 mb-4 max-w-2xl">
            The bands were rewritten by Notification 65/2023 with effect from 1
            September 2023 — the old ones were 25 lakh and 10 lakh at 15% and
            10%. A valuation for an earlier year needs the earlier figures.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {RULE_FIELDS.map(([key, label, citation]) => (
              <label
                key={key}
                className="text-sm text-gray-700 dark:text-slate-300"
              >
                {label}
                <span className="block text-xs text-gray-400 dark:text-slate-600">
                  {citation}
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={draft[key] ?? ''}
                  onChange={setDraftField(key)}
                  className="mt-1 block w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
                />
              </label>
            ))}
          </div>

          <div className="mt-5 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20">
            <p className="text-sm text-amber-900 dark:text-amber-200 font-medium">
              State Bank of India rates as on 1 April {previousYear}
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-300/90 mt-1 mb-3">
              Frozen for the whole year and applied to every concessional loan
              in the establishment. A point too low understates the perquisite
              for every borrower, and nothing on a payslip would show it.
            </p>

            <label className="block text-sm text-amber-900 dark:text-amber-200">
              Where the rates were taken from
              <input
                type="text"
                value={draft.sbiRateSource ?? ''}
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    sbiRateSource: event.target.value,
                  }))
                }
                placeholder="e.g. sbi.co.in interest rates page, retrieved 2 April"
                className="mt-1 block w-full p-2 border border-amber-300 dark:border-amber-900/50 rounded-lg bg-transparent text-gray-900 dark:text-white"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="mt-4 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm disabled:opacity-50"
          >
            Save rules
          </button>
        </form>
      )}

      {result && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <div className="p-4 rounded-xl border border-gray-200 dark:border-slate-800">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
                Carrying a perquisite
              </p>
              <p className="text-2xl font-serif text-gray-900 dark:text-white mt-1">
                {result.withPerquisites}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                Employees with something to value under Rule 3.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-gray-200 dark:border-slate-800">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
                Total perquisite value
              </p>
              <p className="text-2xl font-serif text-gray-900 dark:text-white mt-1">
                {formatCurrency(result.total)}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                Added to salary before tax is computed.
              </p>
            </div>

            <div
              className={`p-4 rounded-xl border ${
                result.compoundingCount > 0
                  ? 'border-amber-300 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20'
                  : 'border-gray-200 dark:border-slate-800'
              }`}
            >
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
                Allowances compound for
              </p>
              <p
                className={`text-2xl font-serif mt-1 ${
                  result.compoundingCount > 0
                    ? 'text-amber-800 dark:text-amber-200'
                    : 'text-gray-900 dark:text-white'
                }`}
              >
                {result.compoundingCount}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                Employees for whom ₹1,000 of allowance costs more than ₹1,000 of
                taxable income.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-gray-200 dark:border-slate-800">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
                Largest component
              </p>
              <p className="text-2xl font-serif text-gray-900 dark:text-white mt-1">
                {formatCurrency(
                  Math.max(0, ...(result.byKind || []).map((k) => k.value)),
                )}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                {KIND_LABELS[
                  [...(result.byKind || [])].sort(
                    (a, b) => b.value - a.value,
                  )[0]?.kind
                ] || '—'}
              </p>
            </div>
          </div>

          <h2 className="text-lg font-serif text-gray-900 dark:text-white mb-3">
            Employees
          </h2>

          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800 mb-8">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-900/40 text-left">
                <tr className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
                  <th className="p-3">Employee</th>
                  <th className="p-3 text-right">Rule 3 salary</th>
                  <th className="p-3 text-right">₹1,000 of allowance costs</th>
                  <th className="p-3 text-right">Perquisite value</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => {
                  const key = String(employee.employeeId);
                  const multiplier = employee.marginalAllowanceMultiplier || 1;
                  const open = expanded === key;

                  return (
                    <tr
                      key={key}
                      className="border-t border-gray-100 dark:border-slate-800/60 align-top"
                    >
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => setExpanded(open ? null : key)}
                          className="text-left text-gray-900 dark:text-white hover:underline"
                        >
                          {employee.employeeName || 'Unnamed'}
                        </button>

                        {open && (
                          <div className="mt-3 space-y-2">
                            {/* Value *and* basis, because Form 12BA asks for
                                both and a value alone is what gets disputed. */}
                            {(employee.items || []).map((item, index) => (
                              <div
                                key={`${item.kind}-${index}`}
                                className="text-xs"
                              >
                                <div className="flex items-baseline justify-between gap-3">
                                  <span className="text-gray-700 dark:text-slate-300">
                                    {KIND_LABELS[item.kind] || item.kind}
                                    <span className="text-gray-400 dark:text-slate-600">
                                      {' '}
                                      · {item.rule}
                                    </span>
                                  </span>
                                  <span className="whitespace-nowrap text-gray-900 dark:text-white">
                                    {formatCurrency(item.value)}
                                  </span>
                                </div>
                                {item.basis && (
                                  <p className="text-gray-500 dark:text-slate-500 mt-0.5">
                                    {item.basis}
                                  </p>
                                )}
                              </div>
                            ))}

                            {(employee.findings || []).map((entry, index) => (
                              <p
                                key={`${entry.code}-${index}`}
                                className={`p-2 rounded text-xs ${SEVERITY_TONE[entry.severity]}`}
                              >
                                {entry.message}
                              </p>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="p-3 text-right text-gray-700 dark:text-slate-300 whitespace-nowrap">
                        {formatCurrency(employee.ruleThreeSalary)}
                        {employee.ruleThreeMonths < 12 && (
                          <span className="block text-xs text-gray-400 dark:text-slate-600">
                            over {employee.ruleThreeMonths} months
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-right whitespace-nowrap">
                        {multiplier > 1 ? (
                          <span className="text-amber-700 dark:text-amber-300">
                            {formatCurrency(1000 * multiplier)}
                            <span className="block text-xs text-gray-400 dark:text-slate-600">
                              ×{multiplier}
                            </span>
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-slate-600">
                            {formatCurrency(1000)}
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-right text-gray-900 dark:text-white whitespace-nowrap">
                        {formatCurrency(employee.total)}
                      </td>
                    </tr>
                  );
                })}

                {employees.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="p-6 text-center text-sm text-gray-500 dark:text-slate-500"
                    >
                      Nothing to value. Record what employees have been provided
                      to see it here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {result.summary.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-serif text-gray-900 dark:text-white mb-3">
                Across the year
              </h2>
              <div className="flex flex-wrap gap-2">
                {result.summary.map((entry) => (
                  <span
                    key={entry.code}
                    className={`px-3 py-1.5 rounded-lg text-xs ${SEVERITY_TONE[entry.severity]}`}
                  >
                    {FINDING_LABELS[entry.code] || entry.code} ·{' '}
                    {entry.employeeCount} employee
                    {entry.employeeCount === 1 ? '' : 's'} · {entry.rule}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <h2 className="text-lg font-serif text-gray-900 dark:text-white mb-3">
        Committed statements
      </h2>

      <div className="rounded-xl border border-gray-200 dark:border-slate-800 divide-y divide-gray-100 dark:divide-slate-800/60">
        {statements.map((entry) => (
          <div
            key={entry._id}
            className="p-3 flex flex-wrap items-baseline justify-between gap-3"
          >
            <div>
              <p className="text-sm text-gray-900 dark:text-white">
                {entry.previousYear}&ndash;
                {String(entry.previousYear + 1).slice(2)}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-500">
                {entry.withPerquisites} employees
                {entry.compoundingCount > 0 &&
                  ` · ${entry.compoundingCount} with compounding allowances`}
              </p>
            </div>

            <span className="text-sm text-gray-900 dark:text-white">
              {formatCurrency(entry.total)}
            </span>
          </div>
        ))}

        {statements.length === 0 && (
          <p className="p-6 text-center text-sm text-gray-500 dark:text-slate-500">
            No statement has been committed yet.
          </p>
        )}
      </div>
    </div>
  );
};

export default PerquisiteValuation;
