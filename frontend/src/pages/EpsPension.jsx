import { useCallback, useEffect, useMemo, useState } from 'react';

import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDate } from '../utils/formatLocale';

/**
 * Employees' Pension Scheme, 1995 (#1769).
 *
 * The page is built around one comparison, because that is the whole subject: a
 * member's pensionable salary computed by capping each month and then averaging,
 * against the figure they will get from any online calculator, which averages
 * first and caps the result.
 *
 * Those two numbers are the same for most people and different for anybody with
 * a joining month, a maternity month or a month of loss of pay inside the last
 * sixty. When they differ, the difference is permanent — a pension once fixed is
 * not revisited — so the page shows both and says which is right, rather than
 * showing one and being disbelieved.
 *
 * The member drawer draws the sixty-month window as a strip, with each month's
 * actual pay and its capped value. It is the only honest answer to "why is my
 * pensionable salary ₹14,500 when I earned ₹40,000", and it is the question this
 * page exists to be asked.
 */

const FINDING_LABELS = {
  CAPPED_BEFORE_AVERAGING: 'Capped each month before averaging',
  WINDOW_EXTENDED: 'The window reached past non-contributory months',
  SHORT_AVERAGING_WINDOW: 'Fewer than sixty months on record',
  SERVICE_BONUS_ADDED: 'Two years added at twenty years of service',
  BELOW_ELIGIBLE_SERVICE: 'Below ten years — a withdrawal benefit',
  MINIMUM_PENSION_APPLIED: 'Floored at the minimum pension',
  EARLY_PENSION_REDUCED: 'Reduced for drawing before fifty-eight',
  DEFERRED_PENSION_INCREASED: 'Increased for deferring beyond fifty-eight',
  PAST_SERVICE_ADDED: 'Past service before November 1995 added',
  HIGHER_WAGE_OPTION: 'Contributing on the full wage',
};

const SEVERITY_TONE = {
  ADJUSTED:
    'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300',
  INFORMATIONAL:
    'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
};

const OUTCOME_LABELS = {
  PENSION: 'Pension',
  WITHDRAWAL: 'Withdrawal',
  NOT_A_MEMBER: 'No contributory service',
};

const OUTCOME_TONE = {
  PENSION:
    'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
  WITHDRAWAL:
    'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300',
  NOT_A_MEMBER:
    'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-500',
};

const ASSUMPTION_FIELDS = [
  ['wageCeiling', 'Wage ceiling', 'Paragraph 11(3)'],
  ['contributionPercent', 'Diverted, %', 'Paragraph 3(1)'],
  ['averagingMonths', 'Averaging span, months', 'Paragraph 11(1)'],
  ['formulaDivisor', 'Formula divisor', 'Paragraph 12(2)'],
  ['minimumEligibleServiceYears', 'Service for a pension', 'Paragraph 12'],
  ['serviceBonusThresholdYears', 'Bonus at, years', 'Paragraph 10(2)'],
  ['serviceBonusYears', 'Bonus, years', 'Paragraph 10(2)'],
  ['minimumMonthlyPension', 'Minimum pension', 'Paragraph 12(2)'],
  ['superannuationAge', 'Superannuation age', 'Paragraph 12'],
  ['earlyPensionMinAge', 'Earliest pension', 'Paragraph 12(7)'],
  ['earlyPensionReductionPercent', 'Reduction a year, %', 'Paragraph 12(7)'],
  ['deferredPensionIncreasePercent', 'Increase a year, %', 'Paragraph 12(7A)'],
];

const MONTH_ABBREVIATIONS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const describeError = (error, fallback) => {
  const response = error?.response;
  if (!response) return 'Could not reach the server. Check your connection.';
  if (response.status === 403) {
    return 'You do not have permission to view the pension valuation.';
  }
  return response.data?.message || fallback;
};

const EpsPension = () => {
  const [valuation, setValuation] = useState(null);
  const [assumptions, setAssumptions] = useState(null);
  const [draft, setDraft] = useState(null);
  const [history, setHistory] = useState([]);
  const [statement, setStatement] = useState(null);
  const [showAssumptions, setShowAssumptions] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);

  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const [previewRes, historyRes] = await Promise.all([
        api.get('/api/eps/preview'),
        api.get('/api/eps/valuations'),
      ]);

      setValuation(previewRes.data?.result || null);
      setAssumptions(previewRes.data?.assumptions || null);
      setDraft(previewRes.data?.assumptions || null);
      setHistory(
        Array.isArray(historyRes.data?.valuations)
          ? historyRes.data.valuations
          : [],
      );
    } catch (error) {
      setLoadError(
        describeError(error, 'Could not load the pension valuation.'),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openStatement = async (memberId) => {
    if (!memberId) return;

    if (statement?.employee?._id === String(memberId)) {
      setStatement(null);
      return;
    }

    try {
      const response = await api.get(`/api/eps/members/${memberId}`);
      setStatement(response.data || null);
    } catch (error) {
      toast(describeError(error, 'Could not load the statement.'), 'error');
    }
  };

  const backfill = async () => {
    setBusy(true);
    try {
      const response = await api.post('/api/eps/wage-history/backfill', {});
      const derived = Number(response.data?.derivedFromBaseSalary) || 0;

      toast(
        derived > 0
          ? `Wage history written. ${derived} month(s) had no salary structure and fell back to base salary — those are over-stated.`
          : 'Wage history written from the payroll ledger.',
        derived > 0 ? 'info' : 'success',
      );
      await load();
    } catch (error) {
      toast(describeError(error, 'Could not backfill the history.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    setBusy(true);
    try {
      await api.post('/api/eps/valuations', {});
      toast('Valuation committed.', 'success');
      await load();
    } catch (error) {
      toast(describeError(error, 'Could not commit the valuation.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveAssumptions = async (event) => {
    event.preventDefault();
    setBusy(true);

    try {
      await api.put('/api/eps/assumptions', draft);
      toast('Assumptions saved.', 'success');
      setShowAssumptions(false);
      await load();
    } catch (error) {
      toast(describeError(error, 'Could not save the assumptions.'), 'error');
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
   * Members whose salary the capping order actually moved, first.
   *
   * They are the whole point of the page and there are three of them in four
   * hundred, so ordering by name would bury them.
   */
  const members = useMemo(() => {
    const rows = [...(valuation?.members || [])];

    return rows.sort((a, b) => {
      const gap = (row) =>
        Math.max(0, (row.averageThenCap || 0) - (row.pensionableSalary || 0));
      return gap(b) - gap(a);
    });
  }, [valuation]);

  if (loading) {
    return (
      <div className="p-4 sm:p-8">
        <p className="text-sm text-gray-500 dark:text-slate-500">
          Loading the pension valuation…
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-serif text-gray-900 dark:text-white">
            Pension scheme
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-500 mt-1 max-w-2xl">
            Pensionable salary is the average of the last sixty contributory
            months, each capped <em>before</em> it is averaged. Averaging first
            and capping the result over-states the pension for life.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <button
            type="button"
            onClick={() => setShowAssumptions((previous) => !previous)}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-700 text-sm text-gray-700 dark:text-slate-300"
          >
            {showAssumptions ? 'Hide assumptions' : 'Assumptions'}
          </button>

          <button
            type="button"
            onClick={backfill}
            disabled={busy}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-700 text-sm text-gray-700 dark:text-slate-300 disabled:opacity-50"
          >
            Backfill wage history
          </button>

          <button
            type="button"
            onClick={commit}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Commit valuation'}
          </button>
        </div>
      </div>

      {loadError && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
          {loadError}
        </div>
      )}

      {showAssumptions && draft && (
        <form
          onSubmit={saveAssumptions}
          className="mb-8 p-5 rounded-xl border border-gray-200 dark:border-slate-800"
        >
          <h2 className="text-lg font-serif text-gray-900 dark:text-white mb-1">
            Scheme assumptions
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-500 mb-4 max-w-2xl">
            The wage ceiling is the figure the capping turns on. Moving it
            changes the pensionable salary of every member above the old one,
            and a pension once fixed is not revisited — so the change is
            audited.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ASSUMPTION_FIELDS.map(([key, label, citation]) => (
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

          <button
            type="submit"
            disabled={busy}
            className="mt-4 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm disabled:opacity-50"
          >
            Save assumptions
          </button>
        </form>
      )}

      {valuation && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <div className="p-4 rounded-xl border border-gray-200 dark:border-slate-800">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
                Members
              </p>
              <p className="text-2xl font-serif text-gray-900 dark:text-white mt-1">
                {valuation.memberCount}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                {valuation.pensionerCount} at a pension ·{' '}
                {valuation.withdrawalCount} below ten years
              </p>
            </div>

            <div className="p-4 rounded-xl border border-gray-200 dark:border-slate-800">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
                Monthly pension
              </p>
              <p className="text-2xl font-serif text-gray-900 dark:text-white mt-1">
                {formatCurrency(valuation.monthlyPensionTotal)}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                {formatCurrency(valuation.annualPensionTotal)} a year, across
                the scheme.
              </p>
            </div>

            <div
              className={`p-4 rounded-xl border ${
                valuation.affectedByCapOrder > 0
                  ? 'border-amber-300 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20'
                  : 'border-gray-200 dark:border-slate-800'
              }`}
            >
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
                Where the order matters
              </p>
              <p
                className={`text-2xl font-serif mt-1 ${
                  valuation.affectedByCapOrder > 0
                    ? 'text-amber-800 dark:text-amber-200'
                    : 'text-gray-900 dark:text-white'
                }`}
              >
                {valuation.affectedByCapOrder}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                Members whose pensionable salary would be over-stated by
                averaging before capping.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-gray-200 dark:border-slate-800">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
                Diverted a month
              </p>
              <p className="text-2xl font-serif text-gray-900 dark:text-white mt-1">
                {formatCurrency(
                  ((assumptions?.wageCeiling || 0) *
                    (assumptions?.contributionPercent || 0)) /
                    100,
                )}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                {assumptions?.contributionPercent}% of the capped wage, per
                member above the ceiling.
              </p>
            </div>
          </div>

          <h2 className="text-lg font-serif text-gray-900 dark:text-white mb-3">
            Members
          </h2>

          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800 mb-8">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-900/40 text-left">
                <tr className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
                  <th className="p-3">Member</th>
                  <th className="p-3">Outcome</th>
                  <th className="p-3 text-right">Pensionable salary</th>
                  <th className="p-3 text-right">If averaged first</th>
                  <th className="p-3 text-right">Service</th>
                  <th className="p-3 text-right">Monthly pension</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const key = String(member.memberId);
                  const gap =
                    (member.averageThenCap || 0) -
                    (member.pensionableSalary || 0);
                  const open = statement?.employee?._id === key;

                  return (
                    <tr
                      key={key}
                      className="border-t border-gray-100 dark:border-slate-800/60 align-top"
                    >
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => openStatement(member.memberId)}
                          className="text-left text-gray-900 dark:text-white hover:underline"
                        >
                          {member.memberName || 'Unnamed'}
                        </button>

                        {open && statement && (
                          <div className="mt-3">
                            <p className="text-xs text-gray-500 dark:text-slate-500 mb-2">
                              The {statement.current?.monthsUsed || 0}{' '}
                              contributory months the salary was averaged over,
                              newest first. The lower bar is the capped value.
                            </p>

                            {/* The strip. Actual pay above, capped below, so
                                the gap between them is the whole explanation. */}
                            <div className="flex flex-wrap gap-0.5 mb-2">
                              {(statement.wageHistory || [])
                                .slice(
                                  0,
                                  statement.assumptions?.averagingMonths || 60,
                                )
                                .map((entry) => {
                                  const ceiling =
                                    statement.assumptions?.wageCeiling || 1;
                                  const scale = Math.max(
                                    ceiling,
                                    entry.wage,
                                    1,
                                  );

                                  return (
                                    <div
                                      key={`${entry.year}-${entry.month}`}
                                      title={`${MONTH_ABBREVIATIONS[entry.month - 1]} ${entry.year} — paid ${entry.wage}, counted ${entry.cappedWage}`}
                                      className="w-1.5 h-10 flex flex-col justify-end bg-gray-100 dark:bg-slate-800"
                                    >
                                      <div
                                        className={
                                          entry.contributory === false
                                            ? 'bg-gray-300 dark:bg-slate-700'
                                            : 'bg-indigo-500'
                                        }
                                        style={{
                                          height: `${(entry.cappedWage / scale) * 100}%`,
                                        }}
                                      />
                                    </div>
                                  );
                                })}
                            </div>

                            <p className="text-xs text-gray-500 dark:text-slate-500">
                              Projected at{' '}
                              {statement.assumptions?.superannuationAge}:{' '}
                              {formatCurrency(
                                statement.projection?.monthlyPension || 0,
                              )}{' '}
                              a month, on{' '}
                              {statement.projection?.pensionableYears || 0}{' '}
                              years of pensionable service.
                            </p>
                          </div>
                        )}
                      </td>

                      <td className="p-3">
                        <span
                          className={`px-2 py-1 rounded text-xs whitespace-nowrap ${OUTCOME_TONE[member.outcome]}`}
                        >
                          {OUTCOME_LABELS[member.outcome]}
                        </span>
                      </td>

                      <td className="p-3 text-right text-gray-900 dark:text-white whitespace-nowrap">
                        {formatCurrency(member.pensionableSalary)}
                      </td>

                      <td className="p-3 text-right whitespace-nowrap">
                        {gap > 0.01 ? (
                          <span className="text-amber-700 dark:text-amber-300">
                            {formatCurrency(member.averageThenCap)}
                            <span className="block text-xs text-gray-400 dark:text-slate-600">
                              {formatCurrency(gap)} too high
                            </span>
                          </span>
                        ) : (
                          <span className="text-gray-300 dark:text-slate-700">
                            same
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-right text-gray-700 dark:text-slate-300 whitespace-nowrap">
                        {member.eligibleYears}
                        {member.serviceBonusApplied && (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {' '}
                            +2
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-right text-gray-900 dark:text-white whitespace-nowrap">
                        {member.outcome === 'WITHDRAWAL'
                          ? `${formatCurrency(member.withdrawalBenefit)} once`
                          : formatCurrency(member.monthlyPension)}
                      </td>
                    </tr>
                  );
                })}

                {members.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-6 text-center text-sm text-gray-500 dark:text-slate-500"
                    >
                      No wage history on record. Run the backfill to build it
                      from the payroll ledger.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {valuation.summary.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-serif text-gray-900 dark:text-white mb-3">
                Across the scheme
              </h2>
              <div className="flex flex-wrap gap-2">
                {valuation.summary.map((entry) => (
                  <span
                    key={entry.code}
                    className={`px-3 py-1.5 rounded-lg text-xs ${SEVERITY_TONE[entry.severity]}`}
                  >
                    {FINDING_LABELS[entry.code] || entry.code} ·{' '}
                    {entry.memberCount} member
                    {entry.memberCount === 1 ? '' : 's'} · {entry.paragraph}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <h2 className="text-lg font-serif text-gray-900 dark:text-white mb-3">
        Committed valuations
      </h2>

      <div className="rounded-xl border border-gray-200 dark:border-slate-800 divide-y divide-gray-100 dark:divide-slate-800/60">
        {history.map((entry) => (
          <div
            key={entry._id}
            className="p-3 flex flex-wrap items-baseline justify-between gap-3"
          >
            <div>
              <p className="text-sm text-gray-900 dark:text-white">
                As at {formatDate(entry.valuationDate)}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-500">
                {entry.memberCount} members · ceiling{' '}
                {formatCurrency(entry.assumptions?.wageCeiling || 0)}
                {entry.affectedByCapOrder > 0 &&
                  ` · ${entry.affectedByCapOrder} affected by the capping order`}
              </p>
            </div>

            <span className="text-sm text-gray-900 dark:text-white">
              {formatCurrency(entry.monthlyPensionTotal)} a month
            </span>
          </div>
        ))}

        {history.length === 0 && (
          <p className="p-6 text-center text-sm text-gray-500 dark:text-slate-500">
            No valuation has been committed yet.
          </p>
        )}
      </div>
    </div>
  );
};

export default EpsPension;
