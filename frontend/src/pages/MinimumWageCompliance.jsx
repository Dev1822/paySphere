import { useCallback, useEffect, useMemo, useState } from 'react';

import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDate } from '../utils/formatLocale';

/**
 * Minimum wage compliance (#1698).
 *
 * Laid out in the order the argument happens rather than in the order the
 * engine computes. The first question is always "we pay ₹18,000, how are we
 * short?", so the register puts gross paid and the comparable wage side by
 * side and lets a line expand to show which components were set aside and
 * under which limb of section 2(h). A shortfall without that breakdown is a
 * number nobody accepts.
 *
 * The notifications panel sits above the register because the rate is the
 * authority for everything below it, and because the most common cause of a
 * whole state reading as "not assessed" is that nobody has recorded its
 * notification yet — which is a much better thing to see than an empty table.
 */

const SKILL_LABELS = {
  UNSKILLED: 'Unskilled',
  SEMI_SKILLED: 'Semi-skilled',
  SKILLED: 'Skilled',
  HIGHLY_SKILLED: 'Highly skilled',
};

const AREA_LABELS = {
  ZONE_I: 'Zone I',
  ZONE_II: 'Zone II',
  ZONE_III: 'Zone III',
};

/** Section 2(h), in the words a compliance officer would use. */
const EXCLUSION_LABELS = {
  HOUSE_RENT_ALLOWANCE: 'House rent allowance — proviso to s.2(h)(i)',
  EMPLOYER_PF_CONTRIBUTION: 'Employer provident fund share — s.2(h)(ii)',
  EMPLOYER_ESI_CONTRIBUTION: 'Employer insurance share — s.2(h)(ii)',
  TRAVEL_CONCESSION: 'Travelling allowance or concession — s.2(h)(iii)',
  SPECIAL_EXPENSE_REIMBURSEMENT: 'Special expenses of the job — s.2(h)(iv)',
  GRATUITY: 'Gratuity payable on discharge — s.2(h)(v)',
  BONUS: 'Bonus — a share of a closed year’s surplus',
  OVERTIME: 'Overtime — the premium for hours beyond the normal day',
};

const EXCLUSION_REASON_LABELS = {
  NO_NOTIFICATION: 'No notification recorded for this classification',
  NO_WAGE_DATA: 'No salary components for the period',
  NO_DAYS_WORKED: 'No days worked in the period',
  OUTSIDE_SCHEDULED_EMPLOYMENT: 'Not a scheduled employment in this state',
};

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
    return 'You do not have permission to run a minimum wage assessment.';
  }
  return response.data?.message || fallback;
};

/** The month before the current one — the last period with a settled payroll. */
const defaultPeriod = () => {
  const today = new Date();
  const month = today.getMonth(); // 0-based, so this is already last month
  return month === 0
    ? { month: 12, year: today.getFullYear() - 1 }
    : { month, year: today.getFullYear() };
};

const emptyNotification = {
  state: '',
  scheduledEmployment: '',
  areaClass: 'ZONE_I',
  areaClassLabel: '',
  skillCategory: 'SKILLED',
  notificationRef: '',
  effectiveFrom: '',
  rateBasis: 'MONTHLY',
  basicRate: '',
  vdaBaseCpiPoints: '',
  vdaRatePerPoint: '',
  vdaRounding: '1',
};

const MinimumWageCompliance = () => {
  const [period, setPeriod] = useState(defaultPeriod);
  const [cpiPoints, setCpiPoints] = useState('');

  const [notifications, setNotifications] = useState([]);
  const [history, setHistory] = useState([]);
  const [result, setResult] = useState(null);

  const [draft, setDraft] = useState(emptyNotification);
  const [showNotificationForm, setShowNotificationForm] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [showExclusions, setShowExclusions] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);

  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const [notificationRes, assessmentRes] = await Promise.all([
        api.get('/api/minimum-wages/notifications'),
        api.get('/api/minimum-wages/assessments'),
      ]);

      setNotifications(
        Array.isArray(notificationRes.data?.notifications)
          ? notificationRes.data.notifications
          : [],
      );
      setHistory(
        Array.isArray(assessmentRes.data?.assessments)
          ? assessmentRes.data.assessments
          : [],
      );
    } catch (error) {
      setLoadError(
        describeError(error, 'Could not load the minimum wage register.'),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const payload = useMemo(
    () => ({
      month: period.month,
      year: period.year,
      cpiPoints: Number(cpiPoints) || 0,
    }),
    [period, cpiPoints],
  );

  const assess = async () => {
    setBusy(true);
    try {
      const { data } = await api.post('/api/minimum-wages/preview', payload);
      setResult(data.result);
      setExpanded(null);
    } catch (error) {
      toast(describeError(error, 'Could not run the assessment.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    setBusy(true);
    try {
      await api.post('/api/minimum-wages/assessments', payload);
      toast(
        `Assessment committed for ${MONTHS[period.month - 1]} ${period.year}.`,
        'success',
      );
      await load();
    } catch (error) {
      toast(describeError(error, 'Could not commit the assessment.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveNotification = async (event) => {
    event.preventDefault();
    setBusy(true);

    try {
      await api.post('/api/minimum-wages/notifications', {
        ...draft,
        basicRate: Number(draft.basicRate) || 0,
        vdaBaseCpiPoints: Number(draft.vdaBaseCpiPoints) || 0,
        vdaRatePerPoint: Number(draft.vdaRatePerPoint) || 0,
        vdaRounding: Number(draft.vdaRounding) || 1,
      });

      toast('Notification recorded.', 'success');
      setDraft(emptyNotification);
      setShowNotificationForm(false);
      await load();
    } catch (error) {
      toast(describeError(error, 'Could not save the notification.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const setDraftField = (key) => (event) =>
    setDraft((previous) => ({ ...previous, [key]: event.target.value }));

  if (loading) {
    return (
      <div className="p-4 sm:p-8">
        <p className="text-sm text-gray-500 dark:text-slate-500">
          Loading the minimum wage register…
        </p>
      </div>
    );
  }

  const shortfallLines = (result?.lines || []).filter(
    (line) => line.totalShortfall > 0,
  );

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-serif text-gray-900 dark:text-white">
            Minimum wage compliance
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-500 mt-1">
            Minimum Wages Act, 1948. The comparison is against the wage as
            section 2(h) defines it, not against gross pay.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={assess}
            disabled={busy}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm"
          >
            {busy ? 'Working…' : 'Assess'}
          </button>
          <button
            type="button"
            onClick={commit}
            disabled={busy || !result}
            title={result ? 'Commit this assessment' : 'Assess first'}
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

      {/* ── The wage period ──────────────────────────────────────────── */}
      <section className="mb-6 p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          The wage period
        </h2>
        <p className="text-xs text-gray-500 dark:text-slate-500 mb-4">
          Monthly, because that is the Act’s wage period — a yearly average
          would hide a shortfall in one month behind a surplus in another.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="text-sm text-gray-700 dark:text-slate-300">
            Month
            <select
              value={period.month}
              onChange={(event) =>
                setPeriod((p) => ({ ...p, month: Number(event.target.value) }))
              }
              className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
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
              value={period.year}
              onChange={(event) =>
                setPeriod((p) => ({ ...p, year: Number(event.target.value) }))
              }
              className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
            />
          </label>

          <label className="text-sm text-gray-700 dark:text-slate-300">
            CPI points
            <input
              type="number"
              value={cpiPoints}
              onChange={(event) => setCpiPoints(event.target.value)}
              className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
            />
            <span className="block mt-1 text-xs text-gray-500 dark:text-slate-500">
              The index reading the VDA is computed from
            </span>
          </label>
        </div>
      </section>

      {/* ── Notifications ────────────────────────────────────────────── */}
      <section className="mb-6 p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Notified rates
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
              Append-only. A superseded rate stays on file so an assessment of a
              closed period can be reproduced against the rate that was actually
              in force.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowNotificationForm((open) => !open)}
            className="px-3 py-1.5 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-700 dark:text-slate-300"
          >
            {showNotificationForm ? 'Cancel' : 'Record a notification'}
          </button>
        </div>

        {showNotificationForm && (
          <form
            onSubmit={saveNotification}
            className="mb-5 p-4 rounded-lg bg-gray-50 dark:bg-slate-950 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <label className="text-sm text-gray-700 dark:text-slate-300">
              State
              <input
                required
                value={draft.state}
                onChange={setDraftField('state')}
                placeholder="KA"
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              />
            </label>

            <label className="text-sm text-gray-700 dark:text-slate-300">
              Scheduled employment
              <input
                required
                value={draft.scheduledEmployment}
                onChange={setDraftField('scheduledEmployment')}
                placeholder="Shops and establishments"
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              />
            </label>

            <label className="text-sm text-gray-700 dark:text-slate-300">
              Area class
              <select
                value={draft.areaClass}
                onChange={setDraftField('areaClass')}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              >
                {Object.entries(AREA_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-gray-700 dark:text-slate-300">
              Skill category
              <select
                value={draft.skillCategory}
                onChange={setDraftField('skillCategory')}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              >
                {Object.entries(SKILL_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-gray-700 dark:text-slate-300">
              Effective from
              <input
                required
                type="date"
                value={draft.effectiveFrom}
                onChange={setDraftField('effectiveFrom')}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              />
              <span className="block mt-1 text-xs text-gray-500 dark:text-slate-500">
                Not the publication date — revisions are routinely backdated
              </span>
            </label>

            <label className="text-sm text-gray-700 dark:text-slate-300">
              Gazette reference
              <input
                value={draft.notificationRef}
                onChange={setDraftField('notificationRef')}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              />
            </label>

            <label className="text-sm text-gray-700 dark:text-slate-300">
              Rate basis
              <select
                value={draft.rateBasis}
                onChange={setDraftField('rateBasis')}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              >
                <option value="MONTHLY">Monthly</option>
                <option value="DAILY">Per day</option>
              </select>
            </label>

            <label className="text-sm text-gray-700 dark:text-slate-300">
              Basic rate
              <input
                required
                type="number"
                value={draft.basicRate}
                onChange={setDraftField('basicRate')}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              />
            </label>

            <label className="text-sm text-gray-700 dark:text-slate-300">
              VDA base CPI points
              <input
                type="number"
                value={draft.vdaBaseCpiPoints}
                onChange={setDraftField('vdaBaseCpiPoints')}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              />
            </label>

            <label className="text-sm text-gray-700 dark:text-slate-300">
              VDA per point
              <input
                type="number"
                step="0.01"
                value={draft.vdaRatePerPoint}
                onChange={setDraftField('vdaRatePerPoint')}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              />
              <span className="block mt-1 text-xs text-gray-500 dark:text-slate-500">
                Leave at zero where the state folds DA into the basic
              </span>
            </label>

            <label className="text-sm text-gray-700 dark:text-slate-300">
              VDA rounding step
              <input
                type="number"
                step="0.01"
                value={draft.vdaRounding}
                onChange={setDraftField('vdaRounding')}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              />
            </label>

            <div className="sm:col-span-2 lg:col-span-3">
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm"
              >
                Save notification
              </button>
            </div>
          </form>
        )}

        {notifications.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-500">
            No notifications on file. Nothing can be assessed until at least one
            rate is recorded.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500 border-b border-gray-200 dark:border-slate-800">
                  <th className="py-2 pr-4">State</th>
                  <th className="py-2 pr-4">Scheduled employment</th>
                  <th className="py-2 pr-4">Area</th>
                  <th className="py-2 pr-4">Skill</th>
                  <th className="py-2 pr-4">Effective from</th>
                  <th className="py-2 pr-4 text-right">Basic</th>
                  <th className="py-2 text-right">VDA / point</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 dark:text-slate-300">
                {notifications.map((notification) => (
                  <tr
                    key={notification._id}
                    className="border-b border-gray-100 dark:border-slate-800/60"
                  >
                    <td className="py-2 pr-4 font-medium">
                      {notification.state}
                    </td>
                    <td className="py-2 pr-4">
                      {notification.scheduledEmployment}
                    </td>
                    <td className="py-2 pr-4">
                      {notification.areaClassLabel ||
                        AREA_LABELS[notification.areaClass] ||
                        notification.areaClass}
                    </td>
                    <td className="py-2 pr-4">
                      {SKILL_LABELS[notification.skillCategory] ||
                        notification.skillCategory}
                    </td>
                    <td className="py-2 pr-4">
                      {formatDate(notification.effectiveFrom)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {formatCurrency(notification.basicRate)}
                      <span className="ml-1 text-xs text-gray-500 dark:text-slate-500">
                        {notification.rateBasis === 'DAILY' ? '/day' : '/month'}
                      </span>
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {notification.vdaRatePerPoint
                        ? formatCurrency(notification.vdaRatePerPoint)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── The assessment ───────────────────────────────────────────── */}
      {result && (
        <section className="mb-6 p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {MONTHS[period.month - 1]} {period.year}
          </h2>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            {[
              ['Assessed', result.assessedCount],
              ['Short', result.shortfallCount],
              ['Wage shortfall', formatCurrency(result.wageShortfall)],
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

          {result.compliant ? (
            <p className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-sm text-emerald-800 dark:text-emerald-300">
              Every assessed employee clears the notified rate for their
              classification.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500 border-b border-gray-200 dark:border-slate-800">
                    <th className="py-2 pr-4">Employee</th>
                    <th className="py-2 pr-4">Classification</th>
                    <th className="py-2 pr-4 text-right">Notified</th>
                    <th className="py-2 pr-4 text-right">Entitlement</th>
                    <th className="py-2 pr-4 text-right">Gross paid</th>
                    <th className="py-2 pr-4 text-right">Counts as wages</th>
                    <th className="py-2 text-right">Shortfall</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 dark:text-slate-300">
                  {shortfallLines.map((line) => {
                    const key = String(line.employeeId);
                    const open = expanded === key;

                    return [
                      <tr
                        key={key}
                        onClick={() => setExpanded(open ? null : key)}
                        className="border-b border-gray-100 dark:border-slate-800/60 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-950/60"
                      >
                        <td className="py-2 pr-4">
                          <span className="font-medium">{line.name}</span>
                          <span className="block text-xs text-gray-500 dark:text-slate-500">
                            {line.designation}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-xs">
                          {line.state} ·{' '}
                          {SKILL_LABELS[line.skillCategory] ||
                            line.skillCategory}
                          <span className="block text-gray-500 dark:text-slate-500">
                            {line.notificationRef ||
                              'unreferenced notification'}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          {formatCurrency(line.notifiedMonthlyRate)}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          {formatCurrency(line.entitlement)}
                          {line.proRataFraction < 1 && (
                            <span className="block text-xs text-gray-500 dark:text-slate-500">
                              {line.daysWorked} of {line.daysInPeriod} days
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          {formatCurrency(line.grossPaid)}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          {formatCurrency(line.comparableWage)}
                        </td>
                        <td className="py-2 text-right tabular-nums font-semibold text-red-600 dark:text-red-400">
                          {formatCurrency(line.totalShortfall)}
                        </td>
                      </tr>,

                      open && (
                        <tr
                          key={`${key}-detail`}
                          className="border-b border-gray-100 dark:border-slate-800/60 bg-gray-50 dark:bg-slate-950/60"
                        >
                          <td colSpan={7} className="py-3 px-4">
                            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500 mb-2">
                              Set aside under section 2(h)
                            </p>

                            {line.excludedComponents?.length ? (
                              <ul className="text-sm space-y-1">
                                {line.excludedComponents.map((component) => (
                                  <li
                                    key={component.name}
                                    className="flex justify-between gap-4"
                                  >
                                    <span>
                                      {component.name}
                                      <span className="block text-xs text-gray-500 dark:text-slate-500">
                                        {EXCLUSION_LABELS[component.code] ||
                                          component.code}
                                      </span>
                                    </span>
                                    <span className="tabular-nums">
                                      {formatCurrency(component.amount)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-gray-500 dark:text-slate-500">
                                Nothing set aside — the whole package counts,
                                and it is still below the notified rate.
                              </p>
                            )}

                            {line.overtime?.hours > 0 && (
                              <p className="mt-3 text-sm text-gray-700 dark:text-slate-300">
                                Section 14: {line.overtime.hours} hours at twice{' '}
                                {formatCurrency(
                                  line.overtime.ordinaryHourlyRate,
                                )}{' '}
                                an hour is{' '}
                                {formatCurrency(line.overtime.entitlement)};{' '}
                                {formatCurrency(line.overtime.paid)} was paid.
                              </p>
                            )}
                          </td>
                        </tr>
                      ),
                    ];
                  })}
                </tbody>
              </table>
            </div>
          )}

          {result.exclusions?.length > 0 && (
            <div className="mt-5">
              <button
                type="button"
                onClick={() => setShowExclusions((open) => !open)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                {showExclusions ? 'Hide' : 'Show'} {result.exclusions.length}{' '}
                not assessed
              </button>

              {showExclusions && (
                <ul className="mt-3 text-sm space-y-1 text-gray-700 dark:text-slate-300">
                  {result.exclusions.map((exclusion) => (
                    <li
                      key={String(exclusion.employeeId)}
                      className="flex justify-between gap-4"
                    >
                      <span>{exclusion.name}</span>
                      <span className="text-xs text-gray-500 dark:text-slate-500">
                        {EXCLUSION_REASON_LABELS[exclusion.code] ||
                          exclusion.reason}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
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
                  <th className="py-2 pr-4 text-right">Assessed</th>
                  <th className="py-2 pr-4 text-right">Short</th>
                  <th className="py-2 pr-4 text-right">Shortfall</th>
                  <th className="py-2">Register</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 dark:text-slate-300">
                {history.map((assessment) => (
                  <tr
                    key={assessment._id}
                    className="border-b border-gray-100 dark:border-slate-800/60"
                  >
                    <td className="py-2 pr-4">
                      {formatDate(assessment.periodStart)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {assessment.assessedCount}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {assessment.shortfallCount}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {formatCurrency(assessment.totalShortfall)}
                    </td>
                    <td className="py-2">
                      <a
                        href={`/api/minimum-wages/assessments/${assessment._id}/register`}
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Download
                      </a>
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

export default MinimumWageCompliance;
