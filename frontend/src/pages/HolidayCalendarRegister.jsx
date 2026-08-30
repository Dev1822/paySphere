import { useCallback, useEffect, useMemo, useState } from 'react';

import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatDate } from '../utils/formatLocale';

/**
 * National and Festival Holidays Acts (#1970).
 *
 * The page draws **the three national holidays as their own block, above the
 * festival list**, and gives them no substitute control at all. This is the
 * whole design. A single table with a "substitute" button on every row is a
 * table from which Independence Day will eventually be swapped for a Friday
 * before a long weekend, and no amount of validation downstream undoes a UI
 * that offered it. The three are shown with their status and nothing else.
 *
 * **A holiday worked is shown as a whole-day payable, with the hours beside it
 * rather than behind it.** Four hours on 26 January owes two full days' wages,
 * and the natural reading of an hours column is that it scales the amount. The
 * hours are labelled as recorded-not-used, and the sentence saying this is not
 * overtime sits under the block where somebody reconciling the figure will read
 * it.
 *
 * **The list obligation is at the top and is about next year.** An employer who
 * fixes the list in March has already defaulted, so the countdown to the
 * Inspector's date leads the page while it can still be met, and drops to a
 * breach afterwards.
 *
 * **An unseeded state is a first-class answer, not an empty page.** The
 * festival count, the qualifying-days condition and the forfeiture rule differ
 * genuinely between states. Where nothing is on file the page says which state
 * is missing rather than rendering a calendar that looks compliant.
 */

const FINDING_LABELS = {
  NATIONAL_HOLIDAY_MISSING: 'A national holiday is missing from the list',
  NATIONAL_HOLIDAY_SUBSTITUTED: 'A national holiday was substituted',
  FESTIVAL_HOLIDAY_SHORTFALL: 'Fewer festival holidays than the state requires',
  SUBSTITUTION_WITHOUT_AGREEMENT:
    'Substituted without the employee’s agreement',
  LIST_NOT_SETTLED: 'The list has not been settled',
  LIST_SETTLED_LATE: 'The list was settled after it was due',
  HOLIDAY_WORKED_UNDERPAID: 'A holiday worked was underpaid',
  SUBSTITUTED_HOLIDAY_NOT_GRANTED: 'The substituted holiday was never granted',
  WAGES_FORFEITED: 'Wages forfeited for the holiday',
  STATE_RULES_UNKNOWN: 'No rules on file for this state',
};

const SEVERITY_TONE = {
  BREACH: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
  DUE: 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300',
  INFORMATIONAL:
    'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
};

const describeError = (error, fallback) => {
  const response = error?.response;
  if (!response) return 'Could not reach the server. Check your connection.';
  if (response.status === 403) {
    return 'You do not have permission to view the holiday calendar.';
  }
  return response.data?.message || fallback;
};

const rupees = (value) =>
  value === null || value === undefined
    ? '—'
    : `₹${Number(value).toLocaleString('en-IN')}`;

/**
 * The countdown to the Inspector's date.
 *
 * A countdown rather than a date, because the obligation is a deadline before a
 * year begins and a date leaves the reader to do the subtraction against a year
 * they are not thinking about yet.
 */
const ListBadge = ({ list }) => {
  if (!list) return null;

  if (list.settledOn) {
    return list.late ? (
      <span className="text-[11px] px-2 py-1 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">
        Settled {list.lateByDays} days late
      </span>
    ) : (
      <span className="text-[11px] px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300">
        Settled {formatDate(list.settledOn)}
      </span>
    );
  }

  if (list.late) {
    return (
      <span className="text-[11px] px-2 py-1 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">
        Overdue by {list.lateByDays} days
      </span>
    );
  }

  return (
    <span className="text-[11px] px-2 py-1 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300">
      {list.daysRemaining} days left · due {formatDate(list.dueOn)}
    </span>
  );
};

const HolidayCalendarRegister = () => {
  const [establishment, setEstablishment] = useState('');
  const [year, setYear] = useState(new Date().getUTCFullYear());

  const [position, setPosition] = useState(null);
  const [rules, setRules] = useState(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const [positionRes, rulesRes] = await Promise.all([
        api.get('/api/holidays/position', { params: { establishment, year } }),
        api.get('/api/holidays/rules'),
      ]);

      setPosition(positionRes.data || null);
      setRules(rulesRes.data || null);
    } catch (error) {
      setLoadError(
        describeError(error, 'Could not load the holiday calendar.'),
      );
    } finally {
      setLoading(false);
    }
  }, [establishment, year]);

  useEffect(() => {
    load();
  }, [load]);

  const settle = async () => {
    const calendarId = position?.calendar?._id;
    if (!calendarId) return;

    try {
      await api.patch(`/api/holidays/calendars/${calendarId}/settle`, {
        settledOn: new Date().toISOString(),
      });
      toast(
        'The list is recorded as settled and sent to the Inspector.',
        'success',
      );
      load();
    } catch (error) {
      toast(describeError(error, 'Could not settle the list.'), 'error');
    }
  };

  const result = position?.result;

  const national = result?.national || [];
  const festival = result?.festival || [];

  /** Holidays worked, underpaid ones first — that is the one with a payable. */
  const worked = useMemo(() => {
    const rows = result?.worked || [];
    return [...rows].sort((a, b) => {
      const aShort = (a.paid || 0) < (a.position?.wagesPayable || 0) ? 0 : 1;
      const bShort = (b.paid || 0) < (b.position?.wagesPayable || 0) ? 0 : 1;
      return aShort - bShort;
    });
  }, [result]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-72 bg-gray-200 dark:bg-slate-800 rounded" />
          <div className="h-48 bg-gray-200 dark:bg-slate-800 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            Holiday calendar
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-2xl">
            Three national holidays that cannot be substituted, a state-notified
            festival list on top of them, and a list that has to be settled with
            the Inspector <strong>before the year begins</strong>.
          </p>
        </div>

        <div className="flex items-end gap-3">
          <label className="text-sm">
            <span className="block text-gray-500 dark:text-slate-400 mb-1">
              Establishment
            </span>
            <input
              value={establishment}
              onChange={(event) => setEstablishment(event.target.value)}
              placeholder="Blank for the default"
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm w-52"
            />
          </label>

          <label className="text-sm">
            <span className="block text-gray-500 dark:text-slate-400 mb-1">
              Year
            </span>
            <input
              type="number"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm w-28"
            />
          </label>
        </div>
      </header>

      {loadError && (
        <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {loadError}
        </div>
      )}

      {!result && position?.note && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          {position.note}
        </div>
      )}

      {result && !result.rules && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          No rules are on file for <strong>{result.state}</strong>. The festival
          count, the qualifying-days condition and the absent-either-side
          forfeiture differ genuinely between states, and two of those are
          deductions — so nothing is computed until they are recorded.
        </div>
      )}

      {result?.rules && (
        <>
          {/* The list obligation, at the top, about the year ahead. */}
          <section className="rounded-xl border border-gray-200 dark:border-slate-800 p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                The list for {result.year}
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                {result.rules.act}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <ListBadge list={result.list} />
              {!result.list?.settledOn && (
                <button
                  type="button"
                  onClick={settle}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium"
                >
                  Record as settled
                </button>
              )}
            </div>
          </section>

          {/*
            The three, in their own block, with no substitute control. See the
            page comment — the absence of the control is the design.
          */}
          <section className="rounded-xl border border-gray-200 dark:border-slate-800 p-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              National holidays
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
              {result.notes?.nationalHolidaysAreNotSubstitutable}
            </p>

            <ul className="mt-3 divide-y divide-gray-100 dark:divide-slate-800">
              {national.map((holiday) => (
                <li
                  key={holiday.name}
                  className="py-2 flex items-center justify-between text-sm"
                >
                  <span className="text-gray-900 dark:text-white">
                    {holiday.name}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-gray-500 dark:text-slate-400">
                      {formatDate(holiday.date)}
                    </span>
                    {holiday.declared ? (
                      <span className="text-[11px] px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300">
                        On the list
                      </span>
                    ) : (
                      <span className="text-[11px] px-2 py-1 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">
                        Missing
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-gray-200 dark:border-slate-800 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                Festival holidays
              </h2>
              <span
                className={`text-[11px] px-2 py-1 rounded ${
                  festival.length >= result.rules.festivalHolidayCount
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                }`}
              >
                {festival.length} of {result.rules.festivalHolidayCount}{' '}
                declared
              </span>
            </div>

            <ul className="mt-3 divide-y divide-gray-100 dark:divide-slate-800">
              {festival.map((holiday) => (
                <li
                  key={holiday._id || holiday.date}
                  className="py-2 flex items-center justify-between text-sm"
                >
                  <span className="text-gray-900 dark:text-white">
                    {holiday.name || 'Unnamed'}
                  </span>
                  <span className="text-gray-500 dark:text-slate-400">
                    {formatDate(holiday.date)}
                  </span>
                </li>
              ))}

              {festival.length === 0 && (
                <li className="py-4 text-sm text-gray-500 dark:text-slate-400">
                  None declared yet.
                </li>
              )}
            </ul>
          </section>

          {worked.length > 0 && (
            <section className="rounded-xl border border-gray-200 dark:border-slate-800 p-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                Holidays worked
              </h2>

              <div className="overflow-x-auto mt-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 dark:text-slate-500">
                      <th className="pb-2 pr-4">Employee</th>
                      <th className="pb-2 pr-4">Date</th>
                      <th className="pb-2 pr-4 text-right">
                        Hours (recorded, not used)
                      </th>
                      <th className="pb-2 pr-4 text-right">Payable</th>
                      <th className="pb-2 text-right">Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {worked.map((row, index) => {
                      const short =
                        (row.paid || 0) < (row.position?.wagesPayable || 0);
                      return (
                        <tr
                          key={index}
                          className="border-t border-gray-100 dark:border-slate-800"
                        >
                          <td className="py-2 pr-4 text-gray-900 dark:text-white">
                            {String(row.employeeId)}
                          </td>
                          <td className="py-2 pr-4 text-gray-500 dark:text-slate-400">
                            {formatDate(row.holiday?.date)}
                          </td>
                          <td className="py-2 pr-4 text-right text-gray-400 dark:text-slate-600">
                            {row.hoursWorked || 0}
                          </td>
                          <td className="py-2 pr-4 text-right font-medium">
                            {rupees(row.position?.wagesPayable)}
                          </td>
                          <td
                            className={`py-2 text-right ${
                              short
                                ? 'text-red-700 dark:text-red-300 font-medium'
                                : ''
                            }`}
                          >
                            {rupees(row.paid)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Where somebody reconciling the figure will read it. */}
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-3 border-l-2 border-gray-200 dark:border-slate-700 pl-3">
                {result.notes?.holidayWorkIsNotOvertime}
              </p>
            </section>
          )}

          {result.findings?.length > 0 && (
            <section className="rounded-xl border border-gray-200 dark:border-slate-800 p-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                Findings
              </h2>

              <ul className="mt-3 space-y-2">
                {result.findings.map((finding, index) => (
                  <li key={index} className="flex items-start gap-3 text-xs">
                    <span
                      className={`px-2 py-1 rounded shrink-0 ${SEVERITY_TONE[finding.severity]}`}
                    >
                      {FINDING_LABELS[finding.code] || finding.code}
                    </span>
                    <span className="text-gray-500 dark:text-slate-400">
                      {finding.detail}{' '}
                      <span className="text-gray-400 dark:text-slate-600">
                        ({finding.authority})
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {rules?.note && (
            <p className="text-xs text-gray-400 dark:text-slate-600">
              {rules.note}
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default HolidayCalendarRegister;
