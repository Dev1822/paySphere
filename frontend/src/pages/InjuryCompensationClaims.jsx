import { useCallback, useEffect, useMemo, useState } from 'react';

import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDate } from '../utils/formatLocale';

/**
 * Workplace injury compensation (#1699).
 *
 * Every figure on this page is shown next to the section that produced it,
 * which is not decoration. The computation is a chain — capped wage, then age,
 * then the Schedule IV factor, then a share of wages, then a floor, then a
 * Schedule I percentage — and a claimant, a Commissioner or an insurer will
 * dispute exactly one link in it. A total with no working is a total that has
 * to be recomputed by hand before it can be defended.
 *
 * The two things the page insists on making visible:
 *
 *   - the wage cap, because "why is a ₹60,000 salary compensated on ₹15,000"
 *     is the first question anybody asks;
 *   - the interest, because it runs at twelve percent from the date of the
 *     accident and an outstanding claim quietly gets more expensive every week
 *     it sits in the register.
 */

const INJURY_LABELS = {
  DEATH: 'Death — s.4(1)(a)',
  PERMANENT_TOTAL: 'Permanent total disablement — s.4(1)(b)',
  PERMANENT_PARTIAL: 'Permanent partial disablement — s.4(1)(c)',
  TEMPORARY: 'Temporary disablement — s.4(1)(d)',
};

const BAR_LABELS = {
  DRINK_OR_DRUGS: 'Under the influence of drink or drugs',
  WILFUL_DISOBEDIENCE: 'Wilful disobedience of a safety rule',
  WILFUL_REMOVAL_OF_SAFEGUARD: 'Wilful removal of a safety guard',
  NOT_ARISING_OUT_OF_EMPLOYMENT: 'Did not arise out of the employment',
  UNDER_THREE_DAYS: 'Incapacity of three days or less',
};

const STATUS_LABELS = {
  REPORTED: 'Reported',
  UNDER_ASSESSMENT: 'Under assessment',
  COMPUTED: 'Computed',
  DEPOSITED: 'Deposited with the Commissioner',
  PAID: 'Paid',
  CONTESTED: 'Contested',
  REJECTED: 'Rejected',
};

const STATUS_TONE = {
  PAID: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
  REJECTED: 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400',
  CONTESTED:
    'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
};

const describeError = (error, fallback) => {
  const response = error?.response;
  if (!response) return 'Could not reach the server. Check your connection.';
  if (response.status === 403) {
    return 'You do not have permission to work on injury compensation claims.';
  }
  return response.data?.message || fallback;
};

const emptyForm = {
  employeeId: '',
  accidentDate: '',
  injuryType: 'TEMPORARY',
  place: '',
  circumstances: '',
  monthlyWages: '',
  disablementDays: '',
  scheduleInjury: '',
  lossOfEarningCapacityPercent: '',
  funeralExpensesIncurred: false,
  penaltyShare: '',
  assertedBars: [],
};

const InjuryCompensationClaims = () => {
  const [claims, setClaims] = useState([]);
  const [summary, setSummary] = useState(null);
  const [schedules, setSchedules] = useState(null);

  const [form, setForm] = useState(emptyForm);
  const [assessment, setAssessment] = useState(null);
  const [selected, setSelected] = useState(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);

  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const [claimsRes, schedulesRes] = await Promise.all([
        api.get('/api/injury-compensation/claims'),
        api.get('/api/injury-compensation/schedules'),
      ]);

      setClaims(
        Array.isArray(claimsRes.data?.claims) ? claimsRes.data.claims : [],
      );
      setSummary(claimsRes.data?.summary || null);
      setSchedules(schedulesRes.data || null);
    } catch (error) {
      setLoadError(describeError(error, 'Could not load the injury register.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (key) => (event) => {
    const value =
      event.target.type === 'checkbox'
        ? event.target.checked
        : event.target.value;

    setForm((previous) => ({ ...previous, [key]: value }));
    setAssessment(null);
  };

  const toggleBar = (code) => {
    setForm((previous) => ({
      ...previous,
      assertedBars: previous.assertedBars.includes(code)
        ? previous.assertedBars.filter((c) => c !== code)
        : [...previous.assertedBars, code],
    }));
    setAssessment(null);
  };

  const payload = useMemo(
    () => ({
      ...form,
      monthlyWages: Number(form.monthlyWages) || 0,
      disablementDays: Number(form.disablementDays) || 0,
      lossOfEarningCapacityPercent:
        Number(form.lossOfEarningCapacityPercent) || 0,
      penaltyShare: Number(form.penaltyShare) || 0,
    }),
    [form],
  );

  const preview = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(
        '/api/injury-compensation/preview',
        payload,
      );
      setAssessment(data.assessment);
    } catch (error) {
      toast(describeError(error, 'Could not compute the claim.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const fileClaim = async () => {
    setBusy(true);
    try {
      await api.post('/api/injury-compensation/claims', payload);
      toast('Claim computed and filed.', 'success');
      setForm(emptyForm);
      setAssessment(null);
      await load();
    } catch (error) {
      toast(describeError(error, 'Could not file the claim.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const openClaim = async (id) => {
    try {
      const { data } = await api.get(`/api/injury-compensation/claims/${id}`);
      setSelected(data);
    } catch (error) {
      toast(describeError(error, 'Could not open the claim.'), 'error');
    }
  };

  const moveTo = async (id, status) => {
    setBusy(true);
    try {
      await api.patch(`/api/injury-compensation/claims/${id}/status`, {
        status,
      });
      toast(`Claim moved to ${STATUS_LABELS[status] || status}.`, 'success');
      setSelected(null);
      await load();
    } catch (error) {
      toast(describeError(error, 'Could not move the claim.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-8">
        <p className="text-sm text-gray-500 dark:text-slate-500">
          Loading the injury compensation register…
        </p>
      </div>
    );
  }

  const head = assessment?.head;
  const isDeath = form.injuryType === 'DEATH';
  const isPartial = form.injuryType === 'PERMANENT_PARTIAL';
  const isTemporary = form.injuryType === 'TEMPORARY';

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-serif text-gray-900 dark:text-white">
            Injury compensation
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-500 mt-1">
            Employees’ Compensation Act, 1923. Computed from the employee’s age
            at the accident through the Schedule IV factor, on wages capped at{' '}
            {formatCurrency(schedules?.monthlyWageCap || 15000)}.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={preview}
            disabled={busy}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm"
          >
            {busy ? 'Working…' : 'Compute'}
          </button>
          <button
            type="button"
            onClick={fileClaim}
            disabled={busy || !assessment}
            title={assessment ? 'File this claim' : 'Compute first'}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm"
          >
            File claim
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
          {summary.outstanding} claim{summary.outstanding === 1 ? '' : 's'}{' '}
          outstanding — {formatCurrency(summary.outstandingCompensation)} of
          compensation, with {formatCurrency(summary.outstandingInterest)} of
          section 4A interest accrued so far. Interest runs at 12% from the date
          of each accident.
        </p>
      )}

      {/* ── The accident ─────────────────────────────────────────────── */}
      <section className="mb-6 p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          The accident
        </h2>
        <p className="text-xs text-gray-500 dark:text-slate-500 mb-4">
          The date matters twice over — the Schedule IV factor is read at the
          employee’s age on that day, and section 4A interest runs from it.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <label className="text-sm text-gray-700 dark:text-slate-300">
            Employee id
            <input
              value={form.employeeId}
              onChange={setField('employeeId')}
              className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
            />
          </label>

          <label className="text-sm text-gray-700 dark:text-slate-300">
            Date of the accident
            <input
              type="date"
              value={form.accidentDate}
              onChange={setField('accidentDate')}
              className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
            />
          </label>

          <label className="text-sm text-gray-700 dark:text-slate-300">
            Head of claim
            <select
              value={form.injuryType}
              onChange={setField('injuryType')}
              className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
            >
              {Object.entries(INJURY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-gray-700 dark:text-slate-300">
            Place
            <input
              value={form.place}
              onChange={setField('place')}
              className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
            />
          </label>

          <label className="text-sm text-gray-700 dark:text-slate-300">
            Monthly wages
            <input
              type="number"
              value={form.monthlyWages}
              onChange={setField('monthlyWages')}
              className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
            />
            <span className="block mt-1 text-xs text-gray-500 dark:text-slate-500">
              Leave blank to take the package in force on the accident date
            </span>
          </label>

          {isTemporary && (
            <label className="text-sm text-gray-700 dark:text-slate-300">
              Days of disablement
              <input
                type="number"
                value={form.disablementDays}
                onChange={setField('disablementDays')}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              />
              <span className="block mt-1 text-xs text-gray-500 dark:text-slate-500">
                The three-day waiting period disappears at 28 days
              </span>
            </label>
          )}

          {isPartial && (
            <>
              <label className="text-sm text-gray-700 dark:text-slate-300">
                Schedule I injury
                <select
                  value={form.scheduleInjury}
                  onChange={setField('scheduleInjury')}
                  className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
                >
                  <option value="">Not listed — assessed percentage</option>
                  {Object.entries(schedules?.scheduleInjuries || {}).map(
                    ([value, entry]) => (
                      <option key={value} value={value}>
                        {entry.description} — {entry.percent}%
                      </option>
                    ),
                  )}
                </select>
              </label>

              {!form.scheduleInjury && (
                <label className="text-sm text-gray-700 dark:text-slate-300">
                  Loss of earning capacity %
                  <input
                    type="number"
                    value={form.lossOfEarningCapacityPercent}
                    onChange={setField('lossOfEarningCapacityPercent')}
                    className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
                  />
                </label>
              )}
            </>
          )}

          {isDeath && (
            <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.funeralExpensesIncurred}
                onChange={setField('funeralExpensesIncurred')}
                className="mt-1"
              />
              <span>
                Funeral expenses incurred
                <span className="block text-xs text-gray-500 dark:text-slate-500">
                  Section 4(1B) — paid to whoever incurred them, not to the
                  dependants
                </span>
              </span>
            </label>
          )}
        </div>

        <label className="block mt-4 text-sm text-gray-700 dark:text-slate-300">
          Circumstances
          <textarea
            rows={2}
            value={form.circumstances}
            onChange={setField('circumstances')}
            className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
          />
        </label>

        <div className="mt-4">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500 mb-2">
            Bars asserted against the claim — section 3
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(BAR_LABELS).map(([code, label]) => (
              <button
                key={code}
                type="button"
                onClick={() => toggleBar(code)}
                className={`px-3 py-1.5 rounded-lg border text-xs ${
                  form.assertedBars.includes(code)
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300'
                    : 'border-gray-300 dark:border-slate-700 text-gray-600 dark:text-slate-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-slate-500">
            The first three do not apply where the injury results in death or
            permanent total disablement.
          </p>
        </div>
      </section>

      {/* ── The computation ──────────────────────────────────────────── */}
      {assessment && (
        <section className="mb-6 p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {INJURY_LABELS[assessment.injuryType]}
          </h2>

          {assessment.ageWarning && (
            <p className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-800 dark:text-amber-300">
              {assessment.ageWarning}
            </p>
          )}

          {!assessment.payable && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300">
              <p className="font-semibold">The claim is barred.</p>
              <ul className="mt-1 list-disc list-inside">
                {assessment.bars.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              <p className="mt-2">
                The figure below is what would have been payable, kept because a
                barred claim that is contested becomes a payable one.
              </p>
            </div>
          )}

          {assessment.bars.disapplied.length > 0 && (
            <p className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-700 dark:text-blue-300">
              {assessment.bars.disapplied.length} asserted bar
              {assessment.bars.disapplied.length === 1 ? '' : 's'} do not apply:
              the section 3(1)(b) provisos are disapplied where the injury
              results in death or permanent total disablement.
            </p>
          )}

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div className="flex justify-between gap-4 py-1 border-b border-gray-100 dark:border-slate-800/60">
              <dt className="text-gray-600 dark:text-slate-400">
                Monthly wages
                {head?.wages?.capApplied && (
                  <span className="block text-xs text-gray-500 dark:text-slate-500">
                    capped by Explanation II from{' '}
                    {formatCurrency(head.wages.actual)}
                  </span>
                )}
              </dt>
              <dd className="tabular-nums text-gray-900 dark:text-white">
                {formatCurrency(head?.wages?.capped)}
              </dd>
            </div>

            {assessment.age !== null && (
              <div className="flex justify-between gap-4 py-1 border-b border-gray-100 dark:border-slate-800/60">
                <dt className="text-gray-600 dark:text-slate-400">
                  Age at the accident
                </dt>
                <dd className="tabular-nums text-gray-900 dark:text-white">
                  {assessment.age}
                </dd>
              </div>
            )}

            {head?.relevantFactor > 0 && (
              <div className="flex justify-between gap-4 py-1 border-b border-gray-100 dark:border-slate-800/60">
                <dt className="text-gray-600 dark:text-slate-400">
                  Schedule IV relevant factor
                </dt>
                <dd className="tabular-nums text-gray-900 dark:text-white">
                  {head.relevantFactor}
                </dd>
              </div>
            )}

            {head?.lossOfEarningCapacityPercent > 0 && (
              <div className="flex justify-between gap-4 py-1 border-b border-gray-100 dark:border-slate-800/60">
                <dt className="text-gray-600 dark:text-slate-400">
                  Loss of earning capacity
                  <span className="block text-xs text-gray-500 dark:text-slate-500">
                    {head.injuryDescription}
                  </span>
                </dt>
                <dd className="tabular-nums text-gray-900 dark:text-white">
                  {head.lossOfEarningCapacityPercent}% of{' '}
                  {formatCurrency(head.permanentTotalBasis)}
                </dd>
              </div>
            )}

            {head?.head === 'TEMPORARY' && (
              <div className="flex justify-between gap-4 py-1 border-b border-gray-100 dark:border-slate-800/60">
                <dt className="text-gray-600 dark:text-slate-400">
                  Half-monthly payment
                  <span className="block text-xs text-gray-500 dark:text-slate-500">
                    {head.compensableDays} compensable days
                    {head.waitingWaived
                      ? ' — waiting period waived at 28 days'
                      : ` — first ${head.waitingDays} days withheld`}
                    {head.fiveYearCapApplied && ', capped at five years'}
                  </span>
                </dt>
                <dd className="tabular-nums text-gray-900 dark:text-white">
                  {formatCurrency(head.halfMonthlyPayment)}
                </dd>
              </div>
            )}

            {head?.floorApplied && (
              <div className="flex justify-between gap-4 py-1 border-b border-gray-100 dark:border-slate-800/60">
                <dt className="text-gray-600 dark:text-slate-400">
                  Statutory floor
                  <span className="block text-xs text-gray-500 dark:text-slate-500">
                    computed {formatCurrency(head.computed)}
                  </span>
                </dt>
                <dd className="tabular-nums text-gray-900 dark:text-white">
                  {formatCurrency(head.floor)}
                </dd>
              </div>
            )}

            <div className="flex justify-between gap-4 py-1 border-b border-gray-100 dark:border-slate-800/60">
              <dt className="text-gray-600 dark:text-slate-400">
                Compensation — {head?.section}
              </dt>
              <dd className="tabular-nums font-semibold text-gray-900 dark:text-white">
                {formatCurrency(assessment.compensation)}
              </dd>
            </div>

            {assessment.funeralExpenses > 0 && (
              <div className="flex justify-between gap-4 py-1 border-b border-gray-100 dark:border-slate-800/60">
                <dt className="text-gray-600 dark:text-slate-400">
                  Funeral expenses — s.4(1B)
                </dt>
                <dd className="tabular-nums text-gray-900 dark:text-white">
                  {formatCurrency(assessment.funeralExpenses)}
                </dd>
              </div>
            )}

            {assessment.charges.daysLate > 0 && (
              <div className="flex justify-between gap-4 py-1 border-b border-gray-100 dark:border-slate-800/60">
                <dt className="text-gray-600 dark:text-slate-400">
                  Interest — s.4A(3)(a)
                  <span className="block text-xs text-gray-500 dark:text-slate-500">
                    {assessment.charges.daysLate} days past the one-month
                    window, 12% on {assessment.charges.interestDays} days
                  </span>
                </dt>
                <dd className="tabular-nums text-gray-900 dark:text-white">
                  {formatCurrency(assessment.charges.interest)}
                </dd>
              </div>
            )}

            {assessment.charges.penalty > 0 && (
              <div className="flex justify-between gap-4 py-1 border-b border-gray-100 dark:border-slate-800/60">
                <dt className="text-gray-600 dark:text-slate-400">
                  Penalty — s.4A(3)(b)
                </dt>
                <dd className="tabular-nums text-gray-900 dark:text-white">
                  {formatCurrency(assessment.charges.penalty)}
                </dd>
              </div>
            )}
          </dl>

          <p className="mt-4 text-right text-2xl font-semibold text-gray-900 dark:text-white tabular-nums">
            {formatCurrency(assessment.totalPayable)}
          </p>
        </section>
      )}

      {/* ── The register ─────────────────────────────────────────────── */}
      <section className="p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Claims
        </h2>

        {claims.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-500">
            No claims on the register.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500 border-b border-gray-200 dark:border-slate-800">
                  <th className="py-2 pr-4">Employee</th>
                  <th className="py-2 pr-4">Accident</th>
                  <th className="py-2 pr-4">Head</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 text-right">Payable</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 dark:text-slate-300">
                {claims.map((claim) => (
                  <tr
                    key={claim._id}
                    onClick={() => openClaim(claim._id)}
                    className="border-b border-gray-100 dark:border-slate-800/60 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-950/60"
                  >
                    <td className="py-2 pr-4">
                      <span className="font-medium">{claim.employeeName}</span>
                      <span className="block text-xs text-gray-500 dark:text-slate-500">
                        {claim.designation}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      {formatDate(claim.accidentDate)}
                    </td>
                    <td className="py-2 pr-4 text-xs">
                      {INJURY_LABELS[claim.injuryType] || claim.injuryType}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          STATUS_TONE[claim.status] ||
                          'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        }`}
                      >
                        {STATUS_LABELS[claim.status] || claim.status}
                      </span>
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {claim.payable ? formatCurrency(claim.totalPayable) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selected && (
          <div className="mt-5 p-4 rounded-lg bg-gray-50 dark:bg-slate-950">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {selected.claim.employeeName} —{' '}
                  {INJURY_LABELS[selected.claim.injuryType]}
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                  {selected.claim.circumstances || 'No circumstances recorded.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-sm text-gray-500 dark:text-slate-500 hover:underline"
              >
                Close
              </button>
            </div>

            {selected.chargesToday && (
              <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
                Unpaid. As at today the section 4A interest is{' '}
                {formatCurrency(selected.chargesToday.interest)} over{' '}
                {selected.chargesToday.interestDays} days, taking the claim to{' '}
                {formatCurrency(
                  selected.chargesToday.total + selected.claim.funeralExpenses,
                )}
                .
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {[
                'UNDER_ASSESSMENT',
                'DEPOSITED',
                'PAID',
                'CONTESTED',
                'REJECTED',
              ].map((status) => (
                <button
                  key={status}
                  type="button"
                  disabled={busy || selected.claim.status === status}
                  onClick={() => moveTo(selected.claim._id, status)}
                  className="px-3 py-1.5 border border-gray-300 dark:border-slate-700 rounded-lg text-xs text-gray-700 dark:text-slate-300 disabled:opacity-40"
                >
                  {STATUS_LABELS[status]}
                </button>
              ))}
            </div>

            <p className="mt-2 text-xs text-gray-500 dark:text-slate-500">
              A death claim must be deposited with the Commissioner under
              section 8 before it can be recorded as paid.
            </p>
          </div>
        )}
      </section>
    </div>
  );
};

export default InjuryCompensationClaims;
