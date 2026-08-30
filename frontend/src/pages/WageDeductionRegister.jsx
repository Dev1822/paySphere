import { useCallback, useEffect, useMemo, useState } from 'react';

import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDate } from '../utils/formatLocale';

/**
 * Payment of Wages Act, 1936 (#1767).
 *
 * The page leads with the ceiling per employee rather than with a list of
 * findings, because the finding is never about a deduction. Five lawful
 * deductions summing to fifty-one per cent produce one breach and no culprit,
 * and a list of findings would show a row saying "deductions exceed the
 * ceiling" with nothing to click on. What a person actually needs is the stack:
 * which deductions, in what order they gave way, and what carried forward.
 *
 * The bar per employee is drawn against the ceiling and not against the wage,
 * because fifty per cent is where the line is and a bar to a hundred puts the
 * only number that matters in the middle of the track.
 *
 * Deferred balances get their own panel rather than sitting inside the register
 * they came from. A balance deferred once is a busy month; the same balance
 * deferred four times is somebody being recovered from faster than the Act
 * allows, and that is only visible across periods.
 */

const FINDING_LABELS = {
  AGGREGATE_CEILING: 'Deductions above the section 7(3) ceiling',
  ACT_NOT_APPLICABLE: 'Above the wage the Act applies to',
  UNAUTHORISED_DEDUCTION: 'A deduction not authorised by section 7(2)',
  FINE_CEILING: 'Fines above three per cent of the period',
  FINE_UNAPPROVED_ACT: 'A fine for an act not on the approved list',
  FINE_ON_MINOR: 'A fine on an employee under fifteen',
  FINE_TIME_BARRED: 'A fine recovered more than sixty days after the act',
  FINE_IN_INSTALMENTS: 'A fine recovered by instalments',
  DAMAGE_EXCEEDS_LOSS: 'A deduction larger than the damage assessed',
  DAMAGE_WITHOUT_SHOW_CAUSE: 'A damage deduction without a show-cause',
  ABSENCE_DISPROPORTIONATE: 'A deduction larger than the time lost',
  CONCERTED_ABSENCE_EXCEEDED:
    'Concerted absence under the section 9(2) proviso',
  WAGE_PERIOD_TOO_LONG: 'A wage period longer than one month',
  PAYMENT_LATE: 'Wages paid after the section 5(1) deadline',
  TERMINATION_PAYMENT_LATE:
    'Wages on termination paid after the second working day',
  ABATEMENT_APPLIED:
    'Deductions deferred to bring the total inside the ceiling',
  ABATEMENT_INSUFFICIENT:
    'Still above the ceiling after everything abatable was deferred',
};

const SEVERITY_TONE = {
  BREACH: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
  ADJUSTED:
    'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300',
  INFORMATIONAL:
    'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
};

const CLAUSE_LABELS = {
  FINE: 'Fine',
  ABSENCE: 'Absence',
  DAMAGE_OR_LOSS: 'Damage or loss',
  HOUSE_ACCOMMODATION: 'Accommodation',
  AMENITIES: 'Amenities',
  ADVANCE_RECOVERY: 'Advance',
  LOAN_RECOVERY: 'Loan',
  INCOME_TAX: 'Tax',
  COURT_ORDER: 'Court order',
  PROVIDENT_FUND: 'Provident fund',
  CO_OPERATIVE_SOCIETY: 'Co-operative society',
  INSURANCE_PREMIUM: 'Insurance',
  TRADE_UNION: 'Trade union',
  POSTAL_INSURANCE: 'Postal insurance',
  RELIEF_FUND: 'Relief fund',
  UNAUTHORISED: 'Unauthorised',
};

/** Deductions the employer may not defer, so the stack can show why. */
const UNABATABLE_KINDS = new Set([
  'PROVIDENT_FUND',
  'INCOME_TAX',
  'COURT_ORDER',
]);

const RULE_FIELDS = [
  ['maxDeductionPercent', 'Ceiling, per cent', 'Section 7(3)'],
  [
    'maxDeductionPercentWithCoOperative',
    'With a co-operative payment',
    'Section 7(3), proviso',
  ],
  ['maxFinePercent', 'Fines, per cent of the period', 'Section 8(1)'],
  ['fineRecoveryWindowDays', 'Fine recovery window, days', 'Section 8(6)'],
  ['applicabilityWageCeiling', 'The Act applies below', 'Section 1(6)'],
  ['employedHeadcount', 'Persons employed', 'Section 5(1)'],
];

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const describeError = (error, fallback) => {
  const response = error?.response;
  if (!response) return 'Could not reach the server. Check your connection.';
  if (response.status === 403) {
    return 'You do not have permission to view the wage deduction register.';
  }
  return response.data?.message || fallback;
};

const percentOf = (value, of) => (of > 0 ? (value / of) * 100 : 0);

const WageDeductionRegister = () => {
  const now = new Date();

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [result, setResult] = useState(null);
  const [rules, setRules] = useState(null);
  const [draft, setDraft] = useState(null);
  const [history, setHistory] = useState([]);
  const [deferred, setDeferred] = useState([]);
  const [outstanding, setOutstanding] = useState(0);
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
      const [assessmentRes, historyRes, deferredRes] = await Promise.all([
        api.get('/api/wage-deductions/assessment', { params: { month, year } }),
        api.get('/api/wage-deductions/registers'),
        api.get('/api/wage-deductions/deferred'),
      ]);

      setResult(assessmentRes.data?.result || null);
      setRules(assessmentRes.data?.rules || null);
      setDraft(assessmentRes.data?.rules || null);
      setHistory(
        Array.isArray(historyRes.data?.registers)
          ? historyRes.data.registers
          : [],
      );
      setDeferred(
        Array.isArray(deferredRes.data?.deferred)
          ? deferredRes.data.deferred
          : [],
      );
      setOutstanding(Number(deferredRes.data?.outstandingTotal) || 0);
    } catch (error) {
      setLoadError(
        describeError(error, 'Could not load the wage deduction register.'),
      );
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    load();
  }, [load]);

  const commit = async () => {
    setBusy(true);
    try {
      const response = await api.post('/api/wage-deductions/registers', {
        month,
        year,
      });

      const count = Number(response.data?.deferralCount) || 0;
      toast(
        count > 0
          ? `Register committed. ${count} deduction${count === 1 ? '' : 's'} deferred to the next period.`
          : 'Register committed.',
        'success',
      );
      await load();
    } catch (error) {
      toast(describeError(error, 'Could not commit the register.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveRules = async (event) => {
    event.preventDefault();
    setBusy(true);

    try {
      // `approvedActsText` only exists once the textarea has been touched.
      // Reading it unconditionally would send an empty list for anybody who
      // opened the panel to change a number, and an empty list turns the
      // section 8(1) check off — silently making every fine lawful.
      const approvedActs =
        draft?.approvedActsText === undefined
          ? draft?.approvedActs || []
          : draft.approvedActsText
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean);

      await api.put('/api/wage-deductions/rules', { ...draft, approvedActs });
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

  /**
   * Employees ordered by how far past the ceiling they are, not by name.
   *
   * A register of four hundred people has three problems in it, and sorting by
   * name puts them on page seven.
   */
  const employees = useMemo(() => {
    const rows = [...(result?.employees || [])];

    return rows.sort((a, b) => {
      const aOver = (a.totals?.attempted || 0) - (a.totals?.ceiling || 0);
      const bOver = (b.totals?.attempted || 0) - (b.totals?.ceiling || 0);
      return bOver - aOver;
    });
  }, [result]);

  const breaches = useMemo(
    () =>
      (result?.summary || []).filter((entry) => entry.severity === 'BREACH'),
    [result],
  );

  if (loading) {
    return (
      <div className="p-4 sm:p-8">
        <p className="text-sm text-gray-500 dark:text-slate-500">
          Loading the wage deduction register…
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-serif text-gray-900 dark:text-white">
            Wage deductions
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-500 mt-1 max-w-2xl">
            Section 7(3) caps the <em>sum</em>. Five individually lawful
            deductions can exceed half the wages together, and there is no
            single one to reject.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm text-gray-700 dark:text-slate-300">
            Wage period
            <select
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
              className="mt-1 block p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
            >
              {MONTHS.map((label, index) => (
                <option key={label} value={index + 1}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-gray-700 dark:text-slate-300">
            Year
            <input
              type="number"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              className="mt-1 block w-24 p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
            />
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
            {busy ? 'Working…' : 'Commit register'}
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
            The establishment&rsquo;s rules
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-500 mb-4 max-w-2xl">
            The wage in section 1(6) decides who the Act reaches. Raising it
            takes employees out of the register entirely, so the change is
            audited.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                  value={draft[key] ?? ''}
                  onChange={setDraftField(key)}
                  className="mt-1 block w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
                />
              </label>
            ))}
          </div>

          <label className="block mt-4 text-sm text-gray-700 dark:text-slate-300">
            Acts and omissions a fine may be imposed for
            <span className="block text-xs text-gray-400 dark:text-slate-600">
              Section 8(1) — one per line. Leaving this empty means the list has
              not been recorded, not that nothing is approved, and the check is
              skipped.
            </span>
            <textarea
              rows={4}
              value={
                draft.approvedActsText ?? (draft.approvedActs || []).join('\n')
              }
              onChange={(event) =>
                setDraft((previous) => ({
                  ...previous,
                  approvedActsText: event.target.value,
                }))
              }
              className="mt-1 block w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white font-mono text-xs"
            />
          </label>

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
                Employees the Act reaches
              </p>
              <p className="text-2xl font-serif text-gray-900 dark:text-white mt-1">
                {result.coveredCount}
                <span className="text-base text-gray-400 dark:text-slate-600">
                  {' '}
                  / {result.employeeCount}
                </span>
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                Section 1(6) — above{' '}
                {formatCurrency(rules?.applicabilityWageCeiling || 0)} a month
                the Act does not apply.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-gray-200 dark:border-slate-800">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
                Deducted
              </p>
              <p className="text-2xl font-serif text-gray-900 dark:text-white mt-1">
                {formatCurrency(result.totalDeducted)}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                {percentOf(result.totalDeducted, result.totalWages).toFixed(1)}%
                of {formatCurrency(result.totalWages)} of wages.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-gray-200 dark:border-slate-800">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
                Deferred by the ceiling
              </p>
              <p className="text-2xl font-serif text-amber-700 dark:text-amber-300 mt-1">
                {formatCurrency(result.totalCarryForward)}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                Still owed. The ceiling defers a recovery; it does not cancel
                it.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-gray-200 dark:border-slate-800">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
                Fines realised
              </p>
              <p className="text-2xl font-serif text-gray-900 dark:text-white mt-1">
                {formatCurrency(result.totalFinesRealised)}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                Section 8(8) — applied to{' '}
                {rules?.finePurpose || 'no recorded purpose'}.
              </p>
            </div>
          </div>

          {breaches.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-serif text-gray-900 dark:text-white mb-3">
                Breaches in this period
              </h2>
              <div className="flex flex-wrap gap-2">
                {breaches.map((entry) => (
                  <span
                    key={entry.code}
                    className={`px-3 py-1.5 rounded-lg text-xs ${SEVERITY_TONE[entry.severity]}`}
                  >
                    {FINDING_LABELS[entry.code] || entry.code} ·{' '}
                    {entry.employeeCount} employee
                    {entry.employeeCount === 1 ? '' : 's'} · {entry.section}
                  </span>
                ))}
              </div>
            </div>
          )}

          <h2 className="text-lg font-serif text-gray-900 dark:text-white mb-3">
            The register
          </h2>

          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800 mb-8">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-900/40 text-left">
                <tr className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
                  <th className="p-3">Employee</th>
                  <th className="p-3 text-right">Wages earned</th>
                  <th className="p-3">Against the ceiling</th>
                  <th className="p-3 text-right">Deducted</th>
                  <th className="p-3 text-right">Deferred</th>
                  <th className="p-3 text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => {
                  const key = String(
                    employee.employeeId || employee.employeeName,
                  );
                  const attempted = employee.totals?.attempted || 0;
                  const ceiling = employee.totals?.ceiling || 0;
                  const over = attempted > ceiling + 0.01;

                  return (
                    <tr
                      key={key}
                      className="border-t border-gray-100 dark:border-slate-800/60 align-top"
                    >
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() =>
                            setExpanded(expanded === key ? null : key)
                          }
                          className="text-left text-gray-900 dark:text-white hover:underline"
                        >
                          {employee.employeeName || 'Unnamed'}
                        </button>

                        {!employee.covered && (
                          <span className="block text-xs text-gray-400 dark:text-slate-600 mt-0.5">
                            Outside the Act
                          </span>
                        )}

                        {expanded === key && employee.covered && (
                          <div className="mt-3 space-y-1.5">
                            {(employee.deductions || []).map((entry, index) => (
                              <div
                                key={`${entry.label}-${index}`}
                                className="flex items-baseline justify-between gap-3 text-xs"
                              >
                                <span className="text-gray-600 dark:text-slate-400">
                                  {entry.label || 'Unnamed'}
                                  <span className="text-gray-400 dark:text-slate-600">
                                    {' '}
                                    · {CLAUSE_LABELS[entry.kind] || entry.kind}
                                    {UNABATABLE_KINDS.has(entry.kind) &&
                                      ' · cannot be deferred'}
                                  </span>
                                </span>
                                <span className="whitespace-nowrap text-gray-700 dark:text-slate-300">
                                  {formatCurrency(entry.payable)}
                                  {entry.carryForward > 0 && (
                                    <span className="text-amber-700 dark:text-amber-400">
                                      {' '}
                                      (+{formatCurrency(
                                        entry.carryForward,
                                      )}{' '}
                                      deferred)
                                    </span>
                                  )}
                                </span>
                              </div>
                            ))}

                            {(employee.findings || [])
                              .filter(
                                (entry) => entry.severity !== 'INFORMATIONAL',
                              )
                              .map((entry, index) => (
                                <p
                                  key={`${entry.code}-${index}`}
                                  className={`mt-2 p-2 rounded text-xs ${SEVERITY_TONE[entry.severity]}`}
                                >
                                  {entry.message}
                                </p>
                              ))}
                          </div>
                        )}
                      </td>

                      <td className="p-3 text-right text-gray-700 dark:text-slate-300 whitespace-nowrap">
                        {formatCurrency(
                          employee.earnedWages ?? employee.grossWages,
                        )}
                      </td>

                      <td className="p-3 w-48">
                        {employee.covered ? (
                          <>
                            {/* Drawn against the ceiling, not against the wage:
                                fifty per cent is where the line is, and a track
                                to a hundred hides it in the middle. */}
                            <div className="h-2 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
                              <div
                                className={`h-full ${over ? 'bg-red-500' : 'bg-emerald-500'}`}
                                style={{
                                  width: `${Math.min(100, percentOf(attempted, ceiling))}%`,
                                }}
                              />
                            </div>
                            <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                              {(employee.totals?.deductionPercent || 0).toFixed(
                                1,
                              )}
                              % of {employee.totals?.ceilingPercent ?? 50}%
                              allowed
                              {employee.totals?.ceilingRaised && (
                                <span className="text-blue-600 dark:text-blue-400">
                                  {' '}
                                  · raised by a co-operative payment
                                </span>
                              )}
                            </p>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-slate-600">
                            —
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-right text-gray-700 dark:text-slate-300 whitespace-nowrap">
                        {formatCurrency(employee.totals?.deducted || 0)}
                      </td>

                      <td className="p-3 text-right whitespace-nowrap">
                        {employee.totals?.carryForward > 0 ? (
                          <span className="text-amber-700 dark:text-amber-300">
                            {formatCurrency(employee.totals.carryForward)}
                          </span>
                        ) : (
                          <span className="text-gray-300 dark:text-slate-700">
                            —
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-right text-gray-900 dark:text-white whitespace-nowrap">
                        {formatCurrency(employee.netWages)}
                      </td>
                    </tr>
                  );
                })}

                {employees.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-6 text-center text-sm text-gray-500 dark:text-slate-500"
                    >
                      No payroll rows for this wage period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="text-lg font-serif text-gray-900 dark:text-white mb-1">
            Deferred balances
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-500 mb-3 max-w-md">
            {formatCurrency(outstanding)} outstanding. A balance deferred once
            is a busy month; the same balance deferred four times is a recovery
            schedule the Act will not permit.
          </p>

          <div className="rounded-xl border border-gray-200 dark:border-slate-800 divide-y divide-gray-100 dark:divide-slate-800/60">
            {deferred.map((entry) => (
              <div
                key={entry._id}
                className="p-3 flex items-baseline justify-between gap-3"
              >
                <div>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {entry.employeeId?.fullName || 'Unnamed'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-500">
                    {entry.label} · deferred from{' '}
                    {formatDate(entry.deferredFromPeriodStart)}
                  </p>
                </div>
                <span className="text-sm text-amber-700 dark:text-amber-300 whitespace-nowrap">
                  {formatCurrency((entry.amount || 0) - (entry.recovered || 0))}
                </span>
              </div>
            ))}

            {deferred.length === 0 && (
              <p className="p-6 text-center text-sm text-gray-500 dark:text-slate-500">
                Nothing has been deferred. Every deduction fitted inside the
                ceiling.
              </p>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-serif text-gray-900 dark:text-white mb-1">
            Committed registers
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-500 mb-3">
            Section 13A. Each stores the rules it ran under, so a later revision
            does not change what a closed period says.
          </p>

          <div className="rounded-xl border border-gray-200 dark:border-slate-800 divide-y divide-gray-100 dark:divide-slate-800/60">
            {history.map((register) => (
              <div
                key={register._id}
                className="p-3 flex items-baseline justify-between gap-3"
              >
                <div>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {formatDate(register.periodStart)} —{' '}
                    {formatDate(register.periodEnd)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-500">
                    {register.coveredCount} covered ·{' '}
                    {formatCurrency(register.totalDeducted)} deducted
                  </p>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs whitespace-nowrap ${
                    register.breachCount > 0
                      ? SEVERITY_TONE.BREACH
                      : SEVERITY_TONE.INFORMATIONAL
                  }`}
                >
                  {register.breachCount} breach
                  {register.breachCount === 1 ? '' : 'es'}
                </span>
              </div>
            ))}

            {history.length === 0 && (
              <p className="p-6 text-center text-sm text-gray-500 dark:text-slate-500">
                No register has been committed yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WageDeductionRegister;
