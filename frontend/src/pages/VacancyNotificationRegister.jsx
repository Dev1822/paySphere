import { useCallback, useEffect, useMemo, useState } from 'react';

import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatDate } from '../utils/formatLocale';

/**
 * Employment Exchanges (CNV) Act, 1959 (#1879).
 *
 * The page leads with **requisitions inside their notification window**,
 * because section 4 is a pre-condition on filling rather than a report
 * afterwards. A requisition that opens and closes inside a fortnight is already
 * in default by the time a quarter-end report runs, so the only useful place to
 * show the fifteen days is while they are still running. Rows are sorted by days
 * remaining, ascending, with the missed ones above the open ones.
 *
 * **The excluded requisitions are shown with their ground, not hidden.**
 * Promotions, absorption of surplus staff and engagements under three months
 * are a large share of real requisitions, and a queue that quietly dropped them
 * could not explain why it was short. Showing them with the section 3 ground
 * beside each is also the only way a wrong determination becomes visible.
 *
 * **Section 5 is rendered, not assumed.** Notifying a vacancy creates no
 * obligation to recruit through the exchange and none to consider the
 * candidates it sends. A compliance page that shows a deadline without saying
 * this reads as a hiring instruction, and employers who read it that way either
 * stop notifying or hold roles open for nothing. It sits under the window list
 * where somebody acting on the deadline will see it.
 *
 * **The return schedule is its own section and does not come from the
 * requisitions.** ER-I is a return about the establishment's employment and is
 * owed for a quarter in which no vacancy arose at all — which is exactly the
 * quarter a vacancy-driven view would show as clean.
 *
 * A section 25H preference (#1830) is drawn as a **second badge on the same
 * row** rather than as an alternative to the notification. Two obligations owed
 * to different parties against one vacancy; satisfying either discharges
 * neither the other nor itself.
 */

const STATUS_LABELS = {
  NOTIFIABLE: 'Notifiable',
  EXCLUDED: 'Excluded',
  NOT_APPLICABLE: 'Below the threshold',
  UNDETERMINED: 'Not yet determined',
};

const STATUS_TONE = {
  NOTIFIABLE:
    'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300',
  EXCLUDED: 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300',
  NOT_APPLICABLE:
    'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400',
  UNDETERMINED:
    'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300',
};

const EXCLUSION_LABELS = {
  LESS_THAN_THREE_MONTHS: 'Under three months’ duration',
  UNSKILLED_OFFICE_WORK: 'Unskilled office work',
  AGRICULTURE_OR_HORTICULTURE: 'Agriculture or horticulture',
  DOMESTIC_SERVICE: 'Domestic service',
  FILLED_BY_PROMOTION: 'To be filled by promotion',
  ABSORPTION_OF_SURPLUS_STAFF: 'Absorption of surplus staff',
  RESULT_OF_EXAMINATION_OR_AGENCY: 'Examination or recruiting agency',
  PARLIAMENT_STAFF: 'Staff of Parliament',
};

const FINDING_LABELS = {
  NOTIFICATION_DUE: 'Notification due',
  NOTIFICATION_WINDOW_MISSED: 'The fifteen-day window has closed',
  FILLED_WITHOUT_NOTIFICATION: 'Filled without notifying the exchange',
  NOTIFIED_LATE: 'Notified inside the fifteen days',
  DETERMINATION_MISSING: 'Nobody has determined whether this is notifiable',
  EXCLUSION_CONTRADICTED: 'The exclusion is contradicted by the engagement',
  THRESHOLD_CROSSED: 'The establishment reached the threshold',
  ER_I_DUE: 'ER-I due',
  ER_I_OVERDUE: 'ER-I overdue',
  ER_II_DUE: 'ER-II due',
  ER_II_OVERDUE: 'ER-II overdue',
  SECTION_25H_PREFERENCE_ALSO_DUE: 'A section 25H preference is also due',
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
    return 'You do not have permission to view the vacancy notification register.';
  }
  return response.data?.message || fallback;
};

/**
 * Days left in the fifteen-day window.
 *
 * A countdown rather than a date, because the obligation is a deadline and a
 * date requires the reader to do the subtraction. Negative reads as overdue
 * instead of as a smaller number.
 */
const WindowBadge = ({ window: notification }) => {
  if (notification?.notified) {
    return notification.onTime ? (
      <span className="text-[11px] px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300">
        Notified {formatDate(notification.notifiedOn)}
      </span>
    ) : (
      <span className="text-[11px] px-2 py-1 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">
        Notified {notification.lateByDays} days late
      </span>
    );
  }

  if (notification?.missed) {
    return (
      <span className="text-[11px] px-2 py-1 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">
        Window closed {Math.abs(notification.daysRemaining)} days ago
      </span>
    );
  }

  if (notification?.daysRemaining === null) {
    return <span className="text-gray-400 dark:text-slate-600">—</span>;
  }

  return (
    <span className="text-[11px] px-2 py-1 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300">
      {notification.daysRemaining} days left · notify by{' '}
      {formatDate(notification.notifyBy)}
    </span>
  );
};

const VacancyNotificationRegister = () => {
  const [establishment, setEstablishment] = useState('');

  const [position, setPosition] = useState(null);
  const [rules, setRules] = useState(null);
  const [headcounts, setHeadcounts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const [positionRes, rulesRes, headcountRes] = await Promise.all([
        api.get('/api/vacancy-notification/position', {
          params: { establishment },
        }),
        api.get('/api/vacancy-notification/rules'),
        api.get('/api/vacancy-notification/headcounts', {
          params: { establishment },
        }),
      ]);

      setPosition(positionRes.data || null);
      setRules(rulesRes.data || null);
      setHeadcounts(
        Array.isArray(headcountRes.data?.headcounts)
          ? headcountRes.data.headcounts
          : [],
      );
    } catch (error) {
      setLoadError(
        describeError(
          error,
          'Could not load the vacancy notification register.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [establishment]);

  useEffect(() => {
    load();
  }, [load]);

  const suggestHeadcount = async () => {
    try {
      const response = await api.get(
        '/api/vacancy-notification/headcounts/suggestion',
      );
      toast(
        `${response.data.suggested} employees on the rolls today. Section 2(f) counts a wider class, so this is a floor.`,
        'info',
      );
    } catch (error) {
      toast(describeError(error, 'Could not read the headcount.'), 'error');
    }
  };

  const result = position?.result;

  /**
   * Notifiable requisitions, most urgent first: missed windows above open ones,
   * then by days remaining ascending.
   */
  const notifiable = useMemo(() => {
    const rows = (result?.requisitions || []).filter(
      (row) => row.notifiability?.status === 'NOTIFIABLE',
    );

    const rank = (row) => {
      if (row.filledOn && !row.window?.notified) return 0;
      if (row.window?.missed) return 1;
      if (row.window?.notified && !row.window.onTime) return 2;
      if (!row.window?.notified) return 3;
      return 4;
    };

    return rows.sort((a, b) => {
      const delta = rank(a) - rank(b);
      if (delta !== 0) return delta;
      return (
        (a.window?.daysRemaining ?? 9999) - (b.window?.daysRemaining ?? 9999)
      );
    });
  }, [result]);

  const excluded = useMemo(
    () =>
      (result?.requisitions || []).filter(
        (row) => row.notifiability?.status === 'EXCLUDED',
      ),
    [result],
  );

  const undetermined = useMemo(
    () =>
      (result?.requisitions || []).filter(
        (row) => row.notifiability?.status === 'UNDETERMINED',
      ),
    [result],
  );

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
            Vacancy notification
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-2xl">
            Section 4 requires a vacancy to be notified to the employment
            exchange <strong>before it is filled</strong>, and the Rules give
            fifteen days&rsquo; notice. The window is shown while it is still
            running, which is the only time it can be met.
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
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm w-56"
            />
          </label>

          <button
            type="button"
            onClick={suggestHeadcount}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-700 text-sm font-medium"
          >
            Suggest headcount
          </button>
        </div>
      </header>

      {loadError && (
        <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {loadError}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
            Notifiable
          </p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">
            {result?.notifiableCount ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
            Excluded
          </p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">
            {result?.excludedCount ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
            Not determined
          </p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">
            {result?.undeterminedCount ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
            Threshold
          </p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">
            {rules?.rules?.privateSectorThreshold ?? 25}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-slate-400">
            {headcounts[0]
              ? `${headcounts[0].headcount} as on ${formatDate(headcounts[0].asOn)}`
              : 'No headcount recorded'}
          </p>
        </div>
      </div>

      <section className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-800">
          <h2 className="text-sm font-medium text-gray-900 dark:text-white">
            Notifiable vacancies
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Missed windows first, then by days remaining. The threshold is
            evaluated as at the date each requisition opened.
          </p>
        </div>

        {notifiable.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-500 dark:text-slate-400">
            Nothing notifiable in this period.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-800/50 text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
                <tr>
                  <th className="text-left px-5 py-2">Vacancy</th>
                  <th className="text-left px-5 py-2">Intended fill</th>
                  <th className="text-left px-5 py-2">Window</th>
                  <th className="text-left px-5 py-2">Also owed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {notifiable.map((row) => (
                  <tr
                    key={String(row.requisitionId)}
                    className={
                      row.window?.missed || row.filledOn
                        ? 'bg-red-50/40 dark:bg-red-900/10'
                        : undefined
                    }
                  >
                    <td className="px-5 py-3">
                      <p className="text-gray-900 dark:text-white font-medium">
                        {row.title || 'Untitled'}
                      </p>
                      {row.category && (
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                          {row.category}
                        </p>
                      )}
                    </td>

                    <td className="px-5 py-3 text-gray-700 dark:text-slate-300">
                      {row.filledOn ? (
                        <span className="text-red-700 dark:text-red-400">
                          Filled {formatDate(row.filledOn)}
                        </span>
                      ) : (
                        <span>
                          Notify by {formatDate(row.window?.notifyBy)}
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3">
                      <WindowBadge window={row.window} />
                    </td>

                    <td className="px-5 py-3">
                      {/*
                        A second badge on the same row, not an alternative. Two
                        obligations owed to different parties against one
                        vacancy; satisfying either discharges neither.
                      */}
                      {row.findings?.some(
                        (finding) =>
                          finding.code === 'SECTION_25H_PREFERENCE_ALSO_DUE',
                      ) ? (
                        <span className="text-[11px] px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                          Section 25H preference
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-slate-600">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/*
          Rendered rather than assumed. A compliance page showing a deadline
          without this reads as a hiring instruction.
        */}
        <div className="px-5 py-3 border-t border-gray-100 dark:border-slate-800 bg-blue-50/50 dark:bg-blue-900/10">
          <p className="text-xs text-blue-800 dark:text-blue-300">
            {result?.noObligationToRecruit ||
              rules?.noObligationToRecruit ||
              'Notifying a vacancy creates no obligation to recruit through the employment exchange.'}
          </p>
        </div>
      </section>

      {undetermined.length > 0 && (
        <section className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-900/10 p-5">
          <h2 className="text-sm font-medium text-amber-900 dark:text-amber-300">
            Not yet determined
          </h2>
          <p className="text-xs text-amber-800 dark:text-amber-400 mt-0.5 mb-3">
            A question rather than a deadline. The section 3 grounds cover a
            large share of real requisitions, so these need a determination
            before they mean anything.
          </p>
          <ul className="space-y-1.5">
            {undetermined.map((row) => (
              <li
                key={String(row.requisitionId)}
                className="text-sm text-amber-900 dark:text-amber-300"
              >
                {row.title || 'Untitled'}
                {row.notifiability?.suggestedGround && (
                  <span className="opacity-75">
                    {' '}
                    — looks like{' '}
                    {EXCLUSION_LABELS[row.notifiability.suggestedGround]}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {excluded.length > 0 && (
        <section className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
          <h2 className="text-sm font-medium text-gray-900 dark:text-white">
            Excluded, with the ground
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 mb-3">
            Shown rather than hidden. A queue that dropped these could not
            explain why it was short, and a wrong determination would never
            surface.
          </p>
          <ul className="space-y-1.5">
            {excluded.map((row) => (
              <li
                key={String(row.requisitionId)}
                className="flex flex-wrap items-center justify-between gap-2 text-sm border-b border-gray-100 dark:border-slate-800 pb-1.5 last:border-0"
              >
                <span className="text-gray-700 dark:text-slate-300">
                  {row.title || 'Untitled'}
                </span>
                <span
                  className={`text-[11px] px-2 py-1 rounded ${STATUS_TONE.EXCLUDED}`}
                >
                  {EXCLUSION_LABELS[row.notifiability?.ground] ||
                    row.notifiability?.ground}
                  <span className="opacity-70">
                    {' '}
                    · {row.notifiability?.authority}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-800">
          <h2 className="text-sm font-medium text-gray-900 dark:text-white">
            Returns
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            ER-I is a return about the establishment&rsquo;s employment, not
            about its vacancies. It is owed for a quarter in which no vacancy
            arose at all — which is exactly the quarter a vacancy-driven view
            would show as clean.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-800/50 text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
              <tr>
                <th className="text-left px-5 py-2">Return</th>
                <th className="text-left px-5 py-2">As on</th>
                <th className="text-left px-5 py-2">Due</th>
                <th className="text-left px-5 py-2">Filed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {[
                ...(result?.returns?.erOne || []),
                ...(result?.returns?.erTwo || []),
              ].map((row) => (
                <tr
                  key={`${row.kind}-${row.asOn}`}
                  className={
                    row.overdue ? 'bg-red-50/40 dark:bg-red-900/10' : undefined
                  }
                >
                  <td className="px-5 py-3 text-gray-900 dark:text-white">
                    {row.kind === 'ER_I'
                      ? 'ER-I (quarterly)'
                      : 'ER-II (biennial)'}
                  </td>
                  <td className="px-5 py-3 text-gray-700 dark:text-slate-300">
                    {formatDate(row.asOn)}
                  </td>
                  <td className="px-5 py-3 text-gray-700 dark:text-slate-300">
                    {formatDate(row.dueOn)}
                  </td>
                  <td className="px-5 py-3">
                    {row.filed ? (
                      <span className="text-emerald-700 dark:text-emerald-400">
                        {formatDate(row.filedOn)}
                        {row.lateByDays > 0 && ` · ${row.lateByDays} days late`}
                      </span>
                    ) : row.overdue ? (
                      <span className="text-red-700 dark:text-red-400">
                        Overdue
                      </span>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-400">
                        Not yet filed
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {result?.summary?.length > 0 && (
        <section className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
          <h2 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Findings
          </h2>
          <ul className="space-y-2">
            {result.summary.map((row) => (
              <li
                key={row.code}
                className={`flex flex-wrap items-center justify-between gap-3 px-3 py-2 rounded text-sm ${
                  SEVERITY_TONE[row.severity] || SEVERITY_TONE.INFORMATIONAL
                }`}
              >
                <span>
                  {FINDING_LABELS[row.code] || row.code}
                  <span className="opacity-70"> · {row.section}</span>
                </span>
                <span>
                  {row.count} {row.count === 1 ? 'occurrence' : 'occurrences'}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-3">
            A due notification is a deadline and not a failure — the two are
            kept apart deliberately, because the window is only useful while it
            is still open.
          </p>
        </section>
      )}

      <p className="text-xs text-gray-400 dark:text-slate-600">
        Status labels: {Object.values(STATUS_LABELS).join(' · ')}.
      </p>
    </div>
  );
};

export default VacancyNotificationRegister;
