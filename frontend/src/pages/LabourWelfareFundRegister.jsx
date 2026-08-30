import { useCallback, useEffect, useMemo, useState } from 'react';

import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDate } from '../utils/formatLocale';

/**
 * Labour Welfare Fund (#1701).
 *
 * The calendar sits above the register on purpose. LWF goes wrong because
 * nobody schedules it, not because anybody computes it wrongly — a half-yearly
 * deduction that was not planned into the June run gets reconciled afterwards,
 * and by then the payslips are out. So the first thing on the page is what is
 * coming and when, per state.
 *
 * Two things the page keeps saying because they are the opposite of what people
 * expect from a payroll deduction:
 *
 *   - LWF does not pro-rate. A joiner in November owes the full half-year and a
 *     leaver in November owes nothing.
 *   - Liability is decided on the last day of the contribution period, not on
 *     the days worked in it.
 */

const PERIODICITY_LABELS = {
  MONTHLY: 'Monthly',
  HALF_YEARLY: 'Half-yearly',
  ANNUAL: 'Annual',
};

const EXCLUSION_LABELS = {
  NO_STATE_RULE: 'No rule recorded for the state',
  BELOW_ESTABLISHMENT_THRESHOLD: 'Establishment below the state’s threshold',
  NOT_ON_ROLLS_AT_PERIOD_END: 'Not on the rolls at the period end',
  MANAGERIAL_ABOVE_THRESHOLD: 'Managerial, above the wage threshold',
  NOT_A_CONTRIBUTION_MONTH: 'Not a contribution month',
  NO_APPLICABLE_SLAB: 'No wage slab covers these wages',
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
    return 'You do not have permission to work on labour welfare fund contributions.';
  }
  return response.data?.message || fallback;
};

const emptyRule = {
  state: '',
  enactment: '',
  effectiveFrom: '',
  periodicity: 'HALF_YEARLY',
  contributionMonths: '6,12',
  establishmentThreshold: '',
  managerialWageThreshold: '',
  remittanceDueDays: '15',
  lateInterestRate: '',
  slabs: '0-3000:6:18, above:12:36',
};

/**
 * Parse the compact slab notation the form accepts.
 *
 * `0-3000:6:18, above:12:36` — a ceiling or the word "above", then the employee
 * and employer amounts. A table of inputs would be more discoverable and much
 * more to fill in for a rule that is transcribed once every few years; this is
 * the shape a notification is read out in.
 */
const parseSlabs = (text) =>
  String(text)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [range, employee, employer] = part.split(':').map((s) => s.trim());
      const ceiling = /above/i.test(range)
        ? null
        : Number(range.split('-').pop());

      return {
        upTo: Number.isFinite(ceiling) ? ceiling : null,
        employee: Number(employee) || 0,
        employer: Number(employer) || 0,
      };
    });

const LabourWelfareFundRegister = () => {
  const now = new Date();

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [rules, setRules] = useState([]);
  const [calendar, setCalendar] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [preview, setPreview] = useState(null);

  const [draft, setDraft] = useState(emptyRule);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);

  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const [rulesRes, calendarRes, contributionsRes] = await Promise.all([
        api.get('/api/labour-welfare-fund/rules'),
        api.get('/api/labour-welfare-fund/calendar', { params: { year } }),
        api.get('/api/labour-welfare-fund/contributions'),
      ]);

      setRules(Array.isArray(rulesRes.data?.rules) ? rulesRes.data.rules : []);
      setCalendar(
        Array.isArray(calendarRes.data?.entries)
          ? calendarRes.data.entries
          : [],
      );
      setContributions(
        Array.isArray(contributionsRes.data?.contributions)
          ? contributionsRes.data.contributions
          : [],
      );
      setSummary(contributionsRes.data?.summary || null);
    } catch (error) {
      setLoadError(
        describeError(
          error,
          'Could not load the labour welfare fund register.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    load();
  }, [load]);

  const runPreview = async () => {
    setBusy(true);
    try {
      const { data } = await api.get('/api/labour-welfare-fund/preview', {
        params: { month, year },
      });
      setPreview(data.result);
      setExpanded(null);
    } catch (error) {
      toast(describeError(error, 'Could not compute the period.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const commit = async (state) => {
    setBusy(true);
    try {
      await api.post('/api/labour-welfare-fund/contributions', {
        state,
        month,
        year,
      });
      toast(`${state} committed for ${MONTHS[month - 1]} ${year}.`, 'success');
      await load();
    } catch (error) {
      toast(
        describeError(error, 'Could not commit the contribution.'),
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const saveRule = async (event) => {
    event.preventDefault();
    setBusy(true);

    try {
      await api.post('/api/labour-welfare-fund/rules', {
        ...draft,
        contributionMonths: String(draft.contributionMonths)
          .split(',')
          .map((m) => Number(m.trim()))
          .filter((m) => m >= 1 && m <= 12),
        slabs: parseSlabs(draft.slabs),
        establishmentThreshold: Number(draft.establishmentThreshold) || 0,
        managerialWageThreshold: Number(draft.managerialWageThreshold) || 0,
        remittanceDueDays: Number(draft.remittanceDueDays) || 15,
        lateInterestRate: Number(draft.lateInterestRate) || 0,
      });

      toast('State rule recorded.', 'success');
      setDraft(emptyRule);
      setShowRuleForm(false);
      await load();
    } catch (error) {
      toast(describeError(error, 'Could not save the rule.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const setDraftField = (key) => (event) =>
    setDraft((previous) => ({ ...previous, [key]: event.target.value }));

  const upcoming = useMemo(
    () => calendar.filter((entry) => new Date(entry.dueBy) >= new Date()),
    [calendar],
  );

  if (loading) {
    return (
      <div className="p-4 sm:p-8">
        <p className="text-sm text-gray-500 dark:text-slate-500">
          Loading the labour welfare fund register…
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-serif text-gray-900 dark:text-white">
            Labour welfare fund
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-500 mt-1">
            No central Act — fifteen state enactments that agree on almost
            nothing. LWF does not pro-rate, and liability is decided on the last
            day of the contribution period.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm text-gray-700 dark:text-slate-300">
            Month
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
              className="mt-1 block w-28 p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
            />
          </label>

          <button
            type="button"
            onClick={runPreview}
            disabled={busy}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm"
          >
            {busy ? 'Working…' : 'Compute'}
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

      {summary && summary.outstanding > 0 && (
        <p className="mb-6 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-800 dark:text-amber-300">
          {summary.outstanding} contribution
          {summary.outstanding === 1 ? '' : 's'} committed and not yet remitted,
          totalling {formatCurrency(summary.outstandingAmount)}.
        </p>
      )}

      {/* ── The calendar ─────────────────────────────────────────────── */}
      <section className="mb-6 p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          What is coming
        </h2>
        <p className="text-xs text-gray-500 dark:text-slate-500 mb-4">
          Deductions have to be planned into the payroll run they belong to. A
          half-yearly amount reconciled afterwards is one the payslips already
          went out without.
        </p>

        {upcoming.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-500">
            Nothing further due in {year}.
          </p>
        ) : (
          <ul className="space-y-2 text-sm text-gray-700 dark:text-slate-300">
            {upcoming.map((entry) => (
              <li
                key={`${entry.state}-${entry.month}`}
                className="flex flex-wrap justify-between gap-2 py-1 border-b border-gray-100 dark:border-slate-800/60"
              >
                <span>
                  <span className="font-medium">{entry.state}</span> —{' '}
                  {MONTHS[entry.month - 1]} collection, covering{' '}
                  {entry.period.label}
                </span>
                <span className="text-xs text-gray-500 dark:text-slate-500">
                  remit by {formatDate(entry.dueBy)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── This month ───────────────────────────────────────────────── */}
      {preview && (
        <section className="mb-6 p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {MONTHS[month - 1]} {year}
          </h2>

          {preview.unruled.length > 0 && (
            <p className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-800 dark:text-amber-300">
              No rule on record for{' '}
              {preview.unruled
                .map((u) => `${u.state} (${u.headcount})`)
                .join(', ')}
              . Nothing is computed for those states, which is not the same as
              nothing being due.
            </p>
          )}

          {preview.collectingStates === 0 ? (
            <p className="text-sm text-gray-500 dark:text-slate-500">
              No state on the register collects in {MONTHS[month - 1]}.
            </p>
          ) : (
            <div className="space-y-4">
              {preview.states
                .filter((state) => state.collects)
                .map((state) => (
                  <div
                    key={state.state}
                    className="p-4 rounded-lg bg-gray-50 dark:bg-slate-950"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {state.state} — {state.period.label}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">
                          {PERIODICITY_LABELS[state.period.periodicity]} ·{' '}
                          {state.liableCount} liable of{' '}
                          {state.headcountAtPeriodEnd} on the rolls at the
                          period end · remit by{' '}
                          {formatDate(state.remittance.dueBy)}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-xl font-semibold text-gray-900 dark:text-white tabular-nums">
                          {formatCurrency(state.total)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-slate-500">
                          {formatCurrency(state.employeeTotal)} employee ·{' '}
                          {formatCurrency(state.employerTotal)} employer
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => commit(state.state)}
                        disabled={busy}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold"
                      >
                        Commit {state.state}
                      </button>

                      {state.exclusions.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpanded(
                              expanded === state.state ? null : state.state,
                            )
                          }
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {expanded === state.state ? 'Hide' : 'Show'}{' '}
                          {state.exclusions.length} not contributing
                        </button>
                      )}
                    </div>

                    {expanded === state.state && (
                      <ul className="mt-3 space-y-1 text-sm text-gray-700 dark:text-slate-300">
                        {state.exclusions.map((exclusion) => (
                          <li
                            key={String(exclusion.employeeId)}
                            className="flex flex-wrap justify-between gap-2"
                          >
                            <span>{exclusion.name}</span>
                            <span className="text-xs text-gray-500 dark:text-slate-500">
                              {EXCLUSION_LABELS[exclusion.code] ||
                                exclusion.reason}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
            </div>
          )}
        </section>
      )}

      {/* ── State rules ──────────────────────────────────────────────── */}
      <section className="mb-6 p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              State rules
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
              Append-only and effective-dated, so a contribution for a closed
              period stays reproducible against the amounts that were in force
              then.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowRuleForm((open) => !open)}
            className="px-3 py-1.5 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-700 dark:text-slate-300"
          >
            {showRuleForm ? 'Cancel' : 'Record a state rule'}
          </button>
        </div>

        {showRuleForm && (
          <form
            onSubmit={saveRule}
            className="mb-5 p-4 rounded-lg bg-gray-50 dark:bg-slate-950 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <label className="text-sm text-gray-700 dark:text-slate-300">
              State
              <input
                required
                value={draft.state}
                onChange={setDraftField('state')}
                placeholder="MH"
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              />
            </label>

            <label className="text-sm text-gray-700 dark:text-slate-300">
              Enactment
              <input
                value={draft.enactment}
                onChange={setDraftField('enactment')}
                placeholder="Maharashtra Labour Welfare Fund Act, 1953"
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              />
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
            </label>

            <label className="text-sm text-gray-700 dark:text-slate-300">
              Periodicity
              <select
                value={draft.periodicity}
                onChange={setDraftField('periodicity')}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              >
                {Object.entries(PERIODICITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-gray-700 dark:text-slate-300">
              Contribution months
              <input
                required
                value={draft.contributionMonths}
                onChange={setDraftField('contributionMonths')}
                placeholder="6,12"
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              />
              <span className="block mt-1 text-xs text-gray-500 dark:text-slate-500">
                The months the deduction is made in — the period each one closes
                follows from the periodicity
              </span>
            </label>

            <label className="text-sm text-gray-700 dark:text-slate-300">
              Slabs
              <input
                required
                value={draft.slabs}
                onChange={setDraftField('slabs')}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              />
              <span className="block mt-1 text-xs text-gray-500 dark:text-slate-500">
                ceiling:employee:employer, comma separated. The last must be
                “above”.
              </span>
            </label>

            <label className="text-sm text-gray-700 dark:text-slate-300">
              Establishment threshold
              <input
                type="number"
                value={draft.establishmentThreshold}
                onChange={setDraftField('establishmentThreshold')}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              />
            </label>

            <label className="text-sm text-gray-700 dark:text-slate-300">
              Managerial wage threshold
              <input
                type="number"
                value={draft.managerialWageThreshold}
                onChange={setDraftField('managerialWageThreshold')}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              />
              <span className="block mt-1 text-xs text-gray-500 dark:text-slate-500">
                Excludes only those who are <em>both</em> managerial and above
                it
              </span>
            </label>

            <label className="text-sm text-gray-700 dark:text-slate-300">
              Remittance due, days after period end
              <input
                type="number"
                value={draft.remittanceDueDays}
                onChange={setDraftField('remittanceDueDays')}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              />
            </label>

            <div className="sm:col-span-2 lg:col-span-3">
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm"
              >
                Save rule
              </button>
            </div>
          </form>
        )}

        {rules.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-500">
            No state rules on file. Nothing can be computed until at least one
            is recorded.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500 border-b border-gray-200 dark:border-slate-800">
                  <th className="py-2 pr-4">State</th>
                  <th className="py-2 pr-4">Periodicity</th>
                  <th className="py-2 pr-4">Collects in</th>
                  <th className="py-2 pr-4">Slabs</th>
                  <th className="py-2">Effective from</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 dark:text-slate-300">
                {rules.map((rule) => (
                  <tr
                    key={rule._id}
                    className="border-b border-gray-100 dark:border-slate-800/60"
                  >
                    <td className="py-2 pr-4 font-medium">{rule.state}</td>
                    <td className="py-2 pr-4">
                      {PERIODICITY_LABELS[rule.periodicity] || rule.periodicity}
                    </td>
                    <td className="py-2 pr-4 text-xs">
                      {rule.contributionMonths
                        .map((m) => MONTHS[m - 1].slice(0, 3))
                        .join(', ')}
                    </td>
                    <td className="py-2 pr-4 text-xs">
                      {rule.slabs
                        .map(
                          (slab) =>
                            `${slab.upTo === null ? 'above' : `≤${slab.upTo}`}: ${slab.employee}/${slab.employer}`,
                        )
                        .join(' · ')}
                    </td>
                    <td className="py-2">{formatDate(rule.effectiveFrom)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Committed contributions ──────────────────────────────────── */}
      <section className="p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Committed contributions
        </h2>

        {contributions.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-500">
            Nothing committed yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500 border-b border-gray-200 dark:border-slate-800">
                  <th className="py-2 pr-4">State</th>
                  <th className="py-2 pr-4">Period</th>
                  <th className="py-2 pr-4 text-right">Liable</th>
                  <th className="py-2 pr-4 text-right">Total</th>
                  <th className="py-2 pr-4">Remitted</th>
                  <th className="py-2">Register</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 dark:text-slate-300">
                {contributions.map((contribution) => (
                  <tr
                    key={contribution._id}
                    className="border-b border-gray-100 dark:border-slate-800/60"
                  >
                    <td className="py-2 pr-4 font-medium">
                      {contribution.state}
                    </td>
                    <td className="py-2 pr-4">{contribution.periodLabel}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {contribution.liableCount}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {formatCurrency(contribution.total)}
                    </td>
                    <td className="py-2 pr-4 text-xs">
                      {contribution.paidOn ? (
                        <>
                          {formatDate(contribution.paidOn)}
                          {contribution.daysLate > 0 && (
                            <span className="block text-amber-700 dark:text-amber-300">
                              {contribution.daysLate} days late,{' '}
                              {formatCurrency(contribution.interest)} interest
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-gray-500 dark:text-slate-500">
                          due {formatDate(contribution.dueBy)}
                        </span>
                      )}
                    </td>
                    <td className="py-2">
                      <a
                        href={`/api/labour-welfare-fund/contributions/${contribution._id}/register`}
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

export default LabourWelfareFundRegister;
