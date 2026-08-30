import { useCallback, useEffect, useMemo, useState } from 'react';

import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDate } from '../utils/formatLocale';

/**
 * Working hours compliance (#1702).
 *
 * Grouped by section, not listed flat. A hundred spread-over findings across one
 * shift pattern is one problem — a rota somebody wrote — and a flat list of a
 * hundred rows makes it look like a hundred problems and gets closed.
 *
 * The period defaults to a quarter rather than a month, because two of the six
 * limits cannot be seen in a month at all: the section 65(3)(iv) overtime
 * ceiling is a running total across thirteen weeks, and the ten-consecutive-day
 * rule reaches across week boundaries.
 *
 * Overtime shortfall is shown separately from the breaches. Unlawful overtime is
 * still payable — section 59 does not stop applying because section 64 was
 * breached — so the two are different obligations and mixing them would suggest
 * that fixing the rota settles the money.
 */

const SECTION_LABELS = {
  DAILY_HOURS: 'More than nine hours in a day',
  WEEKLY_HOURS: 'More than forty-eight hours in a week',
  SPREAD_OVER: 'Spread-over beyond ten and a half hours',
  REST_INTERVAL: 'More than five hours without a rest interval',
  WEEKLY_HOURS_WITH_OVERTIME: 'Beyond sixty hours including overtime',
  QUARTERLY_OVERTIME: 'Beyond fifty overtime hours in a quarter',
  WEEKLY_HOLIDAY: 'No weekly holiday',
  CONSECUTIVE_DAYS: 'More than ten days worked consecutively',
  NIGHT_HOURS: 'Work in the restricted night hours',
  OVERTIME_UNDERPAID: 'Overtime paid below twice the ordinary rate',
};

const SEVERITY_TONE = {
  BREACH: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
  UNDERPAYMENT:
    'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300',
  INFORMATIONAL:
    'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
};

const LIMIT_FIELDS = [
  ['maxDailyHours', 'Hours in a day', 'Section 54'],
  ['maxWeeklyHours', 'Hours in a week', 'Section 51'],
  ['maxSpreadOverHours', 'Spread-over', 'Section 56 — first in to last out'],
  ['maxContinuousHours', 'Continuous work', 'Section 55'],
  ['minIntervalMinutes', 'Rest interval, minutes', 'Section 55'],
  [
    'maxWeeklyHoursWithOvertime',
    'Weekly ceiling with overtime',
    'Section 64(4)(iv)',
  ],
  ['maxQuarterlyOvertimeHours', 'Overtime in a quarter', 'Section 65(3)(iv)'],
  ['maxConsecutiveDays', 'Consecutive days', 'Section 52, proviso'],
];

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
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
    return 'You do not have permission to view working hours findings.';
  }
  return response.data?.message || fallback;
};

const WorkingHoursCompliance = () => {
  const now = new Date();

  const [toMonth, setToMonth] = useState(now.getMonth() + 1);
  const [toYear, setToYear] = useState(now.getFullYear());

  const [result, setResult] = useState(null);
  const [limits, setLimits] = useState(null);
  const [history, setHistory] = useState([]);
  const [draft, setDraft] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);

  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const [assessmentRes, historyRes] = await Promise.all([
        api.get('/api/working-hours/assessment', {
          params: { toMonth, toYear },
        }),
        api.get('/api/working-hours/assessments'),
      ]);

      setResult(assessmentRes.data?.result || null);
      setLimits(assessmentRes.data?.limits || null);
      setDraft(assessmentRes.data?.limits || null);
      setHistory(
        Array.isArray(historyRes.data?.assessments)
          ? historyRes.data.assessments
          : [],
      );
    } catch (error) {
      setLoadError(
        describeError(error, 'Could not load the working hours assessment.'),
      );
    } finally {
      setLoading(false);
    }
  }, [toMonth, toYear]);

  useEffect(() => {
    load();
  }, [load]);

  const commit = async () => {
    setBusy(true);
    try {
      await api.post('/api/working-hours/assessments', { toMonth, toYear });
      toast('Assessment committed.', 'success');
      await load();
    } catch (error) {
      toast(describeError(error, 'Could not commit the assessment.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveLimits = async (event) => {
    event.preventDefault();
    setBusy(true);

    try {
      await api.put('/api/working-hours/limits', draft);
      toast('Limits saved.', 'success');
      await load();
    } catch (error) {
      toast(describeError(error, 'Could not save the limits.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const setDraftField = (key) => (event) =>
    setDraft((previous) => ({
      ...previous,
      [key]:
        event.target.type === 'checkbox'
          ? event.target.checked
          : Number(event.target.value),
    }));

  const findingsByCode = useMemo(() => {
    const grouped = new Map();

    for (const entry of result?.findings || []) {
      if (!grouped.has(entry.code)) grouped.set(entry.code, []);
      grouped.get(entry.code).push(entry);
    }

    return grouped;
  }, [result]);

  if (loading) {
    return (
      <div className="p-4 sm:p-8">
        <p className="text-sm text-gray-500 dark:text-slate-500">
          Loading the working hours assessment…
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-serif text-gray-900 dark:text-white">
            Working hours
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-500 mt-1">
            Six limits, not one. A split shift can be eight lawful hours and a
            thirteen-hour spread-over at the same time.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm text-gray-700 dark:text-slate-300">
            Quarter ending
            <select
              value={toMonth}
              onChange={(event) => setToMonth(Number(event.target.value))}
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
              value={toYear}
              onChange={(event) => setToYear(Number(event.target.value))}
              className="mt-1 block w-28 p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
            />
          </label>

          <button
            type="button"
            onClick={commit}
            disabled={busy || !result}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm"
          >
            Commit
          </button>
        </div>
      </div>

      {loadError && (
        <p
          role="alert"
          className="mb-6 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300"
        >
          {loadError}
        </p>
      )}

      {/* ── Headline ─────────────────────────────────────────────────── */}
      {result && (
        <section className="mb-6 p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              ['Employees assessed', result.assessedCount],
              ['Breaches', result.breachCount],
              ['Findings', result.findings.length],
              ['Overtime shortfall', formatCurrency(result.overtimeShortfall)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="p-3 rounded-lg bg-gray-50 dark:bg-slate-950"
              >
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
                  {label}
                </p>
                <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-white tabular-nums">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs text-gray-500 dark:text-slate-500">
            {formatDate(result.periodStart)} to {formatDate(result.periodEnd)}.
            A quarter rather than a month, because the section 65(3)(iv)
            overtime ceiling is a running total across thirteen weeks and the
            ten-consecutive-day rule reaches across week boundaries — neither is
            visible in a single month.
          </p>

          {result.overtimeShortfall > 0 && (
            <p className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-800 dark:text-amber-300">
              {formatCurrency(result.overtimeShortfall)} of overtime is owed
              under section 59, separately from anything above. Unlawful
              overtime is still payable — the section does not stop applying
              because a limit was breached.
            </p>
          )}
        </section>
      )}

      {/* ── Findings by section ──────────────────────────────────────── */}
      <section className="mb-6 p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          Findings
        </h2>
        <p className="text-xs text-gray-500 dark:text-slate-500 mb-4">
          Grouped by section. A hundred spread-over findings across one rota is
          one problem, and a flat list makes it look like a hundred.
        </p>

        {!result || result.compliant ? (
          <p className="text-sm text-gray-500 dark:text-slate-500">
            Nothing to report for this period.
          </p>
        ) : (
          <div className="space-y-3">
            {result.bySection.map((group) => {
              const open = expanded === group.code;
              const entries = findingsByCode.get(group.code) || [];

              return (
                <div
                  key={group.code}
                  className={`rounded-lg ${SEVERITY_TONE[group.severity]}`}
                >
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : group.code)}
                    className="w-full p-3 text-left"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium text-sm">
                        {SECTION_LABELS[group.code] || group.code}
                      </span>
                      <span className="text-xs">
                        {group.section} · {group.count} across{' '}
                        {group.employeeCount}{' '}
                        {group.employeeCount === 1 ? 'person' : 'people'}
                      </span>
                    </div>
                  </button>

                  {open && (
                    <ul className="px-3 pb-3 space-y-1 text-xs">
                      {entries.slice(0, 40).map((entry, index) => (
                        <li
                          key={`${entry.employeeId}-${index}`}
                          className="opacity-90"
                        >
                          <span className="font-medium">
                            {entry.employeeName}
                          </span>{' '}
                          — {entry.detail}
                        </li>
                      ))}
                      {entries.length > 40 && (
                        <li className="opacity-75">
                          …and {entries.length - 40} more. Commit the assessment
                          and open it to see every one.
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── The limits ───────────────────────────────────────────────── */}
      {draft && (
        <section className="mb-6 p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            The limits
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-500 mb-4">
            The Factories Act figures are the defaults. The state Shops and
            Establishments Acts differ — ten and a half hours a day in a few,
            and the spread-over varies — so an establishment carries its own.
            Changing these changes what counts as a breach, which is why it is
            audited.
          </p>

          <form
            onSubmit={saveLimits}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {LIMIT_FIELDS.map(([key, label, section]) => (
              <label
                key={key}
                className="text-sm text-gray-700 dark:text-slate-300"
              >
                {label}
                <input
                  type="number"
                  step="0.5"
                  value={draft[key] ?? ''}
                  onChange={setDraftField(key)}
                  className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
                />
                <span className="block mt-1 text-xs text-gray-500 dark:text-slate-500">
                  {section}
                </span>
              </label>
            ))}

            <label className="text-sm text-gray-700 dark:text-slate-300">
              Week starts on
              <select
                value={draft.weekStartsOn ?? 1}
                onChange={setDraftField('weekStartsOn')}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              >
                {WEEKDAYS.map((day, index) => (
                  <option key={day} value={index}>
                    {day}
                  </option>
                ))}
              </select>
              <span className="block mt-1 text-xs text-gray-500 dark:text-slate-500">
                Forty-eight hours over the wrong seven days is a different
                number
              </span>
            </label>

            <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={Boolean(draft.nightHoursExempt)}
                onChange={setDraftField('nightHoursExempt')}
                className="mt-1"
              />
              <span>
                Section 66 exemption granted
                <span className="block text-xs text-gray-500 dark:text-slate-500">
                  Night shifts are still reported, as informational — the
                  exemption’s conditions are what get inspected
                </span>
              </span>
            </label>

            <div className="sm:col-span-2 lg:col-span-4">
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm"
              >
                Save limits
              </button>
              {limits && limits.overtimeMultiplier && (
                <span className="ml-3 text-xs text-gray-500 dark:text-slate-500">
                  Overtime is paid at {limits.overtimeMultiplier}× the ordinary
                  rate under section 59. It cannot be set below two.
                </span>
              )}
            </div>
          </form>
        </section>
      )}

      {/* ── Committed assessments ────────────────────────────────────── */}
      <section className="p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Committed assessments
        </h2>

        {history.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-500">
            Nothing committed yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500 border-b border-gray-200 dark:border-slate-800">
                  <th className="py-2 pr-4">Period</th>
                  <th className="py-2 pr-4">Establishment</th>
                  <th className="py-2 pr-4 text-right">Assessed</th>
                  <th className="py-2 pr-4 text-right">Breaches</th>
                  <th className="py-2 text-right">Overtime owed</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 dark:text-slate-300">
                {history.map((assessment) => (
                  <tr
                    key={assessment._id}
                    className="border-b border-gray-100 dark:border-slate-800/60"
                  >
                    <td className="py-2 pr-4">
                      {formatDate(assessment.periodStart)} —{' '}
                      {formatDate(assessment.periodEnd)}
                    </td>
                    <td className="py-2 pr-4">
                      {assessment.establishment || (
                        <span className="text-xs text-gray-500 dark:text-slate-500">
                          all sites
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {assessment.assessedCount}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {assessment.breachCount}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatCurrency(assessment.overtimeShortfall)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default WorkingHoursCompliance;
