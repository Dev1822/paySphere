import { useCallback, useEffect, useMemo, useState } from 'react';

import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDate } from '../utils/formatLocale';

/**
 * Section 10A of the Standing Orders Act, 1946 (#1828).
 *
 * The page is built around the thing a list of suspensions cannot show: that
 * the rate is waiting on somebody's answer.
 *
 * The **tier track** draws a suspension's elapsed days against the 90 and 180
 * day boundaries, with the segment past day ninety drawn hollow where no
 * attributability finding has been made. Hollow means "this workman is on fifty
 * per cent, and it is fifty per cent because nobody has decided whose fault the
 * delay is" — which a percentage in a column cannot say. A filled segment is a
 * rate somebody stands behind.
 *
 * Beside it sits the number that gets the finding made: what a finding in the
 * workman's favour would add. "Somebody should look at this" is easy to defer;
 * a rupee figure attached to the deferral is not.
 *
 * Suspensions past day ninety with no finding sort to the top, and inside that
 * the oldest first — the delay gets harder to reconstruct the longer it is
 * left, and the enquiry nobody has looked at in eight months is the one where
 * nobody can now say what happened.
 */

const ATTRIBUTABILITY_LABELS = {
  NOT_DETERMINED: 'No finding made',
  WORKMAN: 'Delay is the workman’s',
  NOT_WORKMAN: 'Delay is not the workman’s',
};

const OUTCOME_LABELS = {
  PENDING: 'Enquiry pending',
  REINSTATED_WITH_BACK_WAGES: 'Reinstated, back wages ordered',
  REINSTATED_WITHOUT_BACK_WAGES: 'Reinstated, no back wages',
  DISMISSED: 'Dismissed',
  SUSPENSION_REVOKED: 'Suspension revoked',
};

const OUTCOME_TONE = {
  PENDING:
    'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300',
  REINSTATED_WITH_BACK_WAGES:
    'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
  REINSTATED_WITHOUT_BACK_WAGES:
    'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
  DISMISSED: 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300',
  SUSPENSION_REVOKED:
    'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
};

const FINDING_LABELS = {
  ATTRIBUTABILITY_NOT_DETERMINED: 'No finding on whose delay it is',
  TIER_TRANSITION_DUE: 'The rate changes soon',
  UNDERPAID: 'Subsistence allowance underpaid',
  UNPAID: 'Subsistence allowance unpaid',
  OVERPAID: 'More paid than was due',
  ENQUIRY_PROLONGED: 'Past 180 days',
  WAGE_BASIS_UNRECORDED: 'No wage base recorded at suspension',
  NOT_APPLICABLE: 'Below the certification threshold',
  SET_OFF_APPLIED: 'Set off against back wages',
  NOT_RECOVERABLE: 'Drawn allowance is not recoverable',
};

const SEVERITY_TONE = {
  BREACH: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
  EXPOSURE:
    'bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300',
  INFORMATIONAL:
    'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
};

const describeError = (error, fallback) => {
  const response = error?.response;
  if (!response) return 'Could not reach the server. Check your connection.';
  if (response.status === 403) {
    return 'You do not have permission to view the suspension register.';
  }
  return response.data?.message || fallback;
};

const currentFinancialYear = () => {
  const now = new Date();
  return now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
};

/**
 * Elapsed days against the 90 and 180 day boundaries.
 *
 * Bands past day ninety are drawn hollow where the finding has not been made —
 * the workman is on fifty per cent, and the reason is an unanswered question
 * rather than a decision. A column showing "50%" cannot make that distinction.
 */
const TierTrack = ({ row }) => {
  const bands = row?.schedule?.bands || [];
  const days = Math.max(row?.schedule?.days || 0, 1);

  return (
    <div className="min-w-[180px]">
      <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100 dark:bg-slate-800">
        {bands.map((band) => {
          const awaiting = band.tier > 1 && !band.uplifted;

          return (
            <div
              key={`${band.tier}-${band.fromDay}`}
              className={
                awaiting
                  ? 'border border-dashed border-orange-400 dark:border-orange-500 bg-orange-50/40 dark:bg-orange-900/10'
                  : band.tier === 1
                    ? 'bg-indigo-300 dark:bg-indigo-700'
                    : band.tier === 2
                      ? 'bg-indigo-500 dark:bg-indigo-500'
                      : 'bg-indigo-700 dark:bg-indigo-300'
              }
              style={{ width: `${(band.days / days) * 100}%` }}
              title={`Days ${band.fromDay}–${band.toDay} at ${band.percent}%${
                awaiting ? ' — no finding made' : ''
              }`}
            />
          );
        })}
      </div>

      <p className="text-[11px] text-gray-500 dark:text-slate-500 mt-1">
        {row?.schedule?.days} days ·{' '}
        {bands.map((band) => `${band.percent}%`).join(' → ')}
      </p>

      {row?.schedule?.nextTransition && (
        <p className="text-[11px] text-gray-400 dark:text-slate-600">
          day {row.schedule.nextTransition.onDay} on{' '}
          {formatDate(row.schedule.nextTransition.onDate)}
        </p>
      )}
    </div>
  );
};

const SuspensionRegister = () => {
  const [financialYear, setFinancialYear] = useState(currentFinancialYear());

  const [assessment, setAssessment] = useState(null);
  const [history, setHistory] = useState([]);
  const [findingDraft, setFindingDraft] = useState({});

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);

  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const [assessmentRes, historyRes] = await Promise.all([
        api.get('/api/suspensions/assessment', { params: { financialYear } }),
        api.get('/api/suspensions/assessments'),
      ]);

      setAssessment(assessmentRes.data || null);
      setHistory(
        Array.isArray(historyRes.data?.assessments)
          ? historyRes.data.assessments
          : [],
      );
    } catch (error) {
      setLoadError(
        describeError(error, 'Could not load the suspension register.'),
      );
    } finally {
      setLoading(false);
    }
  }, [financialYear]);

  useEffect(() => {
    load();
  }, [load]);

  const commit = async () => {
    setBusy(true);
    try {
      await api.post('/api/suspensions/assessments', { financialYear });
      toast('Assessment committed.', 'success');
      await load();
    } catch (error) {
      toast(describeError(error, 'Could not commit the assessment.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveFinding = async (suspensionId, verdict) => {
    const reason = findingDraft[suspensionId] || '';

    if (!reason.trim()) {
      // The API refuses one anyway. Saying so here avoids a round trip and
      // makes the point: a finding without a reason is a rate change wearing a
      // finding's name.
      toast('A finding needs a reason recorded with it.', 'error');
      return;
    }

    setBusy(true);
    try {
      await api.put(`/api/suspensions/${suspensionId}/attributability`, {
        finding: verdict,
        reason: reason.trim(),
      });
      toast('Finding recorded.', 'success');
      setFindingDraft((previous) => {
        const next = { ...previous };
        delete next[suspensionId];
        return next;
      });
      await load();
    } catch (error) {
      toast(describeError(error, 'Could not record the finding.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const result = assessment?.result;

  /**
   * Past day ninety with no finding, oldest first.
   *
   * The delay gets harder to reconstruct the longer it is left: the enquiry
   * nobody has looked at in eight months is the one where nobody can now say
   * what happened, and it is the one costing the workman money meanwhile.
   */
  const suspensions = useMemo(() => {
    const rows = [...(result?.suspensions || [])];

    const rank = (row) => {
      const open = (row.outcome?.outcome || 'PENDING') === 'PENDING';
      if (!open) return 3;
      if (row.attributability === 'NOT_DETERMINED' && row.schedule.days > 90) {
        return 0;
      }
      if (row.shortfall > 0) return 1;
      return 2;
    };

    return rows.sort(
      (a, b) => rank(a) - rank(b) || b.schedule.days - a.schedule.days,
    );
  }, [result]);

  if (loading) {
    return (
      <div className="p-4 sm:p-8">
        <p className="text-sm text-gray-500 dark:text-slate-500">
          Loading the suspension register…
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-serif text-gray-900 dark:text-white">
            Suspensions
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-500 mt-1 max-w-2xl">
            The uplift from 50% to 75% on day ninety-one turns on a finding —
            whether the delay in the enquiry is the workman’s — and not on the
            calendar.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm text-gray-700 dark:text-slate-300">
            Financial year
            <select
              value={financialYear}
              onChange={(event) => setFinancialYear(Number(event.target.value))}
              className="mt-1 block p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
            >
              {[0, 1, 2, 3].map((back) => {
                const year = currentFinancialYear() - back;
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
            onClick={commit}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Commit assessment'}
          </button>
        </div>
      </div>

      {loadError && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
          {loadError}
        </div>
      )}

      {result && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: 'Awaiting a finding',
              value: result.awaitingFindingCount,
              hint: 'Open, past day ninety, nobody has decided',
              accent: result.awaitingFindingCount > 0,
            },
            {
              label: 'What those findings are worth',
              value: formatCurrency(result.exposureIfAttributed),
              hint: 'If the delay is not the workman’s',
              accent: result.exposureIfAttributed > 0,
            },
            {
              label: 'Allowance shortfall',
              value: formatCurrency(result.shortfall),
              hint: 'Non-payment is an offence under 10A(4)',
            },
            {
              label: 'Open suspensions',
              value: `${result.openCount} of ${result.suspensionCount}`,
              hint: 'The employment subsists throughout',
            },
          ].map((card) => (
            <div
              key={card.label}
              className={`p-4 rounded-xl border ${
                card.accent
                  ? 'border-orange-300 dark:border-orange-700 bg-orange-50/40 dark:bg-orange-900/10'
                  : 'border-gray-200 dark:border-slate-800'
              }`}
            >
              <p className="text-xs text-gray-500 dark:text-slate-500">
                {card.label}
              </p>
              <p className="text-2xl font-serif text-gray-900 dark:text-white mt-1">
                {card.value}
              </p>
              <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">
                {card.hint}
              </p>
            </div>
          ))}
        </div>
      )}

      {result?.summary?.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-serif text-gray-900 dark:text-white mb-3">
            Findings
          </h2>
          <div className="flex flex-wrap gap-2">
            {result.summary.map((row) => (
              <span
                key={row.code}
                className={`px-3 py-1.5 rounded-lg text-xs ${SEVERITY_TONE[row.severity]}`}
              >
                {FINDING_LABELS[row.code] || row.code}
                <span className="opacity-60">
                  {' '}
                  · {row.section} · {row.suspensionCount || row.count}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      <h2 className="text-lg font-serif text-gray-900 dark:text-white mb-3">
        The register
      </h2>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-slate-900/50">
            <tr className="text-left text-xs text-gray-500 dark:text-slate-500">
              <th className="p-3 font-medium">Workman</th>
              <th className="p-3 font-medium">Tiers</th>
              <th className="p-3 font-medium">Whose delay</th>
              <th className="p-3 font-medium text-right">Due</th>
              <th className="p-3 font-medium text-right">Paid</th>
              <th className="p-3 font-medium">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {suspensions.map((row) => {
              const awaiting =
                row.attributability === 'NOT_DETERMINED' &&
                row.schedule.days > 90 &&
                (row.outcome?.outcome || 'PENDING') === 'PENDING';

              const gap = (row.findings || []).find(
                (entry) => entry.code === 'ATTRIBUTABILITY_NOT_DETERMINED',
              );

              return (
                <tr
                  key={String(row.suspensionId)}
                  className="border-t border-gray-100 dark:border-slate-800 align-top"
                >
                  <td className="p-3">
                    <p className="text-gray-900 dark:text-white">{row.name}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-500">
                      from {formatDate(row.schedule.suspendedOn)}
                    </p>
                  </td>

                  <td className="p-3">
                    <TierTrack row={row} />
                  </td>

                  <td className="p-3">
                    <p
                      className={`text-xs ${
                        awaiting
                          ? 'text-orange-700 dark:text-orange-400'
                          : 'text-gray-600 dark:text-slate-400'
                      }`}
                    >
                      {ATTRIBUTABILITY_LABELS[row.attributability]}
                    </p>

                    {gap?.differenceIfFound > 0 && (
                      <p className="text-[11px] text-gray-500 dark:text-slate-500 mt-0.5">
                        a finding for the workman adds{' '}
                        {formatCurrency(gap.differenceIfFound)}
                      </p>
                    )}

                    {awaiting && (
                      <div className="mt-2 space-y-1">
                        <input
                          type="text"
                          placeholder="Reason for the finding"
                          value={findingDraft[row.suspensionId] ?? ''}
                          onChange={(event) =>
                            setFindingDraft((previous) => ({
                              ...previous,
                              [row.suspensionId]: event.target.value,
                            }))
                          }
                          className="w-48 p-1 text-xs border border-gray-300 dark:border-slate-700 rounded bg-transparent text-gray-900 dark:text-white"
                        />
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              saveFinding(row.suspensionId, 'NOT_WORKMAN')
                            }
                            disabled={busy}
                            className="px-2 py-1 text-[11px] rounded border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 disabled:opacity-50"
                          >
                            Not the workman’s
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              saveFinding(row.suspensionId, 'WORKMAN')
                            }
                            disabled={busy}
                            className="px-2 py-1 text-[11px] rounded border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 disabled:opacity-50"
                          >
                            The workman’s
                          </button>
                        </div>
                      </div>
                    )}
                  </td>

                  <td className="p-3 text-right text-gray-900 dark:text-white">
                    {formatCurrency(row.due)}
                  </td>

                  <td className="p-3 text-right">
                    <p className="text-gray-600 dark:text-slate-400">
                      {formatCurrency(row.paid)}
                    </p>
                    {row.shortfall > 0 && (
                      <p className="text-[11px] text-red-600 dark:text-red-400">
                        {formatCurrency(row.shortfall)} short
                      </p>
                    )}
                    {row.excess > 0 && (
                      <p className="text-[11px] text-gray-500 dark:text-slate-500">
                        {formatCurrency(row.excess)} over
                      </p>
                    )}
                  </td>

                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded text-[11px] ${
                        OUTCOME_TONE[row.outcome?.outcome] || ''
                      }`}
                    >
                      {OUTCOME_LABELS[row.outcome?.outcome] ||
                        row.outcome?.outcome}
                    </span>
                    {row.outcome?.setOff > 0 && (
                      <p className="text-[11px] text-gray-500 dark:text-slate-500 mt-1">
                        {formatCurrency(row.outcome.setOff)} set off
                      </p>
                    )}
                  </td>
                </tr>
              );
            })}

            {!suspensions.length && (
              <tr>
                <td
                  colSpan={6}
                  className="p-6 text-center text-sm text-gray-500 dark:text-slate-500"
                >
                  No suspensions recorded for this year.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {history.length > 0 && (
        <>
          <h2 className="text-lg font-serif text-gray-900 dark:text-white mt-8 mb-3">
            Committed assessments
          </h2>
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-900/50">
                <tr className="text-left text-xs text-gray-500 dark:text-slate-500">
                  <th className="p-3 font-medium">Period</th>
                  <th className="p-3 font-medium text-right">Open</th>
                  <th className="p-3 font-medium text-right">Awaiting</th>
                  <th className="p-3 font-medium text-right">Shortfall</th>
                  <th className="p-3 font-medium">Committed</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr
                    key={String(row._id)}
                    className="border-t border-gray-100 dark:border-slate-800"
                  >
                    <td className="p-3 text-gray-900 dark:text-white">
                      {formatDate(row.periodStart)} –{' '}
                      {formatDate(row.periodEnd)}
                    </td>
                    <td className="p-3 text-right text-gray-600 dark:text-slate-400">
                      {row.openCount}
                    </td>
                    <td className="p-3 text-right text-gray-600 dark:text-slate-400">
                      {row.awaitingFindingCount}
                    </td>
                    <td className="p-3 text-right text-gray-900 dark:text-white">
                      {formatCurrency(row.shortfall)}
                    </td>
                    <td className="p-3 text-xs text-gray-500 dark:text-slate-500">
                      {formatDate(row.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default SuspensionRegister;
