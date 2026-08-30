import { useCallback, useEffect, useMemo, useState } from 'react';

import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDate } from '../utils/formatLocale';

/**
 * Code on Social Security, 2020, section 114 (#1829).
 *
 * The page exists to make two things visible that a single payable figure hides.
 *
 * The **limb comparison** draws the turnover limb and the payout ceiling as two
 * bars against a shared scale, with the binding one filled and the other
 * outlined. Two unrelated bases, and which of them binds is a fact about the
 * platform's economics rather than about the statute: a delivery business whose
 * payouts are most of its cost pays on turnover, and a marketplace with thin
 * payouts is capped and has stopped tracking turnover altogether. One number
 * cannot tell those apart, and the difference is what happens next year.
 *
 * The **register** is a list of *people*, with a column for days worked on
 * platforms this tenant does not operate. Those days are usually what carries a
 * multi-platform worker past ninety, and an establishment counting only its own
 * engagements would report every one of them as short. The same person is one
 * beneficiary against several contributions, so the two axes are drawn as two
 * tables rather than joined into one.
 *
 * The provisional banner is not decoration. Everything on the page is
 * provisional until the turnover is finalised, and a mid-year figure read as an
 * assessed contribution is the mistake the banner exists to prevent.
 */

const CATEGORY_LABELS = {
  RIDE_SHARING: 'Ride sharing',
  FOOD_AND_GROCERY_DELIVERY: 'Food and grocery delivery',
  LOGISTICS: 'Logistics',
  E_MARKETPLACE: 'E-marketplace',
  PROFESSIONAL_SERVICES: 'Professional services',
  HEALTHCARE: 'Healthcare',
  TRAVEL_AND_HOSPITALITY: 'Travel and hospitality',
  CONTENT_AND_MEDIA: 'Content and media',
  OTHER: 'Other',
};

const EXCLUDED_LABELS = {
  PROVIDENT_FUND: 'Provident fund',
  ESI: 'ESI',
  GRATUITY: 'Gratuity',
  BONUS: 'Bonus',
  ESTABLISHMENT_THRESHOLD: 'Establishment thresholds',
};

const FINDING_LABELS = {
  RATE_OUTSIDE_BAND: 'A rate outside the 1–2% band',
  TURNOVER_UNATTRIBUTED: 'Turnover with no category, and so no rate',
  ATTRIBUTION_EXCEEDS_TOTAL: 'Categories exceed the stated turnover',
  CEILING_BINDS: 'The payout ceiling binds',
  CEILING_HEADROOM_THIN: 'Close to the payout ceiling',
  ACCRUAL_SHORT: 'Less deposited than accrued',
  TRUE_UP_DUE: 'True-up due on finalised turnover',
  WORKER_UNREGISTERED: 'Entitled to register and not registered',
  WORKER_MULTI_AGGREGATOR: 'Engaged by more than one aggregator',
  NO_TURNOVER_RECORDED: 'No turnover recorded',
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
    return 'You do not have permission to view the aggregator contribution.';
  }
  return response.data?.message || fallback;
};

const currentFinancialYear = () => {
  const now = new Date();
  return now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
};

/**
 * The two limbs on one scale.
 *
 * The binding one is filled and the other outlined, because "which one bound"
 * is the fact worth reading off the page — a platform paying on turnover and
 * one that is capped behave completely differently as they grow, and the
 * payable figure is identical in shape.
 */
const LimbComparison = ({ contribution }) => {
  const turnoverLimb = contribution?.turnoverLimb || 0;
  const ceiling = contribution?.payoutCeiling || 0;
  const scale = Math.max(turnoverLimb, ceiling, 1);

  const limbs = [
    {
      key: 'TURNOVER',
      label: 'Turnover limb',
      sub: `${formatCurrency(contribution?.attribution?.totalTurnover || 0)} of turnover`,
      value: turnoverLimb,
    },
    {
      key: 'PAYOUT_CEILING',
      label: 'Payout ceiling',
      sub: `5% of ${formatCurrency(contribution?.workerPayouts || 0)} paid to workers`,
      value: ceiling,
    },
  ];

  return (
    <div className="space-y-4">
      {limbs.map((limb) => {
        const binds = contribution?.bindingLimb === limb.key;

        return (
          <div key={limb.key}>
            <div className="flex justify-between items-baseline mb-1">
              <span
                className={`text-sm ${
                  binds
                    ? 'text-gray-900 dark:text-white font-medium'
                    : 'text-gray-500 dark:text-slate-500'
                }`}
              >
                {limb.label}
                {binds && (
                  <span className="ml-2 px-2 py-0.5 rounded text-[10px] bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300">
                    binds
                  </span>
                )}
              </span>
              <span className="text-sm tabular-nums text-gray-900 dark:text-white">
                {formatCurrency(limb.value)}
              </span>
            </div>

            <div className="h-3 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={
                  binds
                    ? 'h-full bg-indigo-600 dark:bg-indigo-400'
                    : 'h-full border border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-900/10'
                }
                style={{ width: `${(limb.value / scale) * 100}%` }}
              />
            </div>

            <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">
              {limb.sub}
            </p>
          </div>
        );
      })}

      <p className="text-xs text-gray-500 dark:text-slate-500">
        {contribution?.capped
          ? `Capped. The contribution has stopped tracking turnover — ${formatCurrency(contribution.headroom)} of the turnover limb is above the ceiling.`
          : `Not capped. ${formatCurrency(contribution?.headroom || 0)} of headroom before the ceiling would start to bind.`}
      </p>
    </div>
  );
};

const AggregatorContribution = () => {
  const [financialYear, setFinancialYear] = useState(currentFinancialYear());
  const [platform, setPlatform] = useState('');

  const [platforms, setPlatforms] = useState([]);
  const [assessment, setAssessment] = useState(null);
  const [history, setHistory] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);

  const { toast } = useToast();

  const loadPlatforms = useCallback(async () => {
    try {
      const response = await api.get('/api/aggregator-contribution/turnover');
      const rows = Array.isArray(response.data?.turnover)
        ? response.data.turnover
        : [];

      setPlatforms(rows);
      if (!platform && rows.length) setPlatform(rows[0].name);
    } catch (error) {
      setLoadError(describeError(error, 'Could not load the platforms.'));
    }
  }, [platform]);

  useEffect(() => {
    loadPlatforms();
  }, [loadPlatforms]);

  const load = useCallback(async () => {
    if (!platform) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError('');

    try {
      const [assessmentRes, historyRes] = await Promise.all([
        api.get('/api/aggregator-contribution/assessment', {
          params: { name: platform, financialYear },
        }),
        api.get('/api/aggregator-contribution/assessments'),
      ]);

      setAssessment(assessmentRes.data || null);
      setHistory(
        Array.isArray(historyRes.data?.assessments)
          ? historyRes.data.assessments
          : [],
      );
    } catch (error) {
      setLoadError(describeError(error, 'Could not load the contribution.'));
    } finally {
      setLoading(false);
    }
  }, [platform, financialYear]);

  useEffect(() => {
    load();
  }, [load]);

  const commit = async () => {
    setBusy(true);
    try {
      await api.post('/api/aggregator-contribution/assessments', {
        name: platform,
        financialYear,
      });
      toast('Assessment committed.', 'success');
      await load();
    } catch (error) {
      toast(describeError(error, 'Could not commit the assessment.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const result = assessment?.result;
  const contribution = result?.contribution;

  /** Multi-platform workers first — they are the ones a per-platform count misses. */
  const workers = useMemo(() => {
    const rows = [...(result?.workers || [])];

    const rank = (row) => {
      if (row.qualifies && !row.registered && row.aggregatorCount > 1) return 0;
      if (row.qualifies && !row.registered) return 1;
      if (row.aggregatorCount > 1) return 2;
      return 3;
    };

    return rows.sort((a, b) => rank(a) - rank(b) || b.daysTotal - a.daysTotal);
  }, [result]);

  if (loading) {
    return (
      <div className="p-4 sm:p-8">
        <p className="text-sm text-gray-500 dark:text-slate-500">
          Loading the aggregator contribution…
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-serif text-gray-900 dark:text-white">
            Aggregator contribution
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-500 mt-1 max-w-2xl">
            1–2% of turnover, capped at 5% of what is paid to gig and platform
            workers. Two unrelated bases, and which one binds says more than the
            figure does.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm text-gray-700 dark:text-slate-300">
            Platform
            <select
              value={platform}
              onChange={(event) => setPlatform(event.target.value)}
              className="mt-1 block p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
            >
              {[...new Set(platforms.map((row) => row.name))].map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
              {!platforms.length && (
                <option value="">No platform recorded</option>
              )}
            </select>
          </label>

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
            disabled={busy || !platform}
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

      {result?.accrual?.provisional && (
        // Not decoration. Everything on the page is provisional until the
        // turnover is finalised, and a mid-year figure read as an assessed
        // contribution is the mistake this exists to prevent.
        <div className="mb-6 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 text-sm">
          Turnover for this year has not been finalised. Every figure below is a
          provisional accrual, not an assessed contribution.
        </div>
      )}

      {contribution && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 p-5 rounded-xl border border-gray-200 dark:border-slate-800">
            <h2 className="text-lg font-serif text-gray-900 dark:text-white mb-4">
              The two limbs
            </h2>
            <LimbComparison contribution={contribution} />
          </div>

          <div className="p-5 rounded-xl border border-gray-200 dark:border-slate-800">
            <h2 className="text-lg font-serif text-gray-900 dark:text-white mb-3">
              Where it stands
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-600 dark:text-slate-400">
                <span>Payable</span>
                <span className="tabular-nums">
                  {formatCurrency(contribution.payable)}
                </span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-slate-400">
                <span>Deposited</span>
                <span className="tabular-nums">
                  {formatCurrency(result.accrual.deposited)}
                </span>
              </div>
              <div className="flex justify-between font-medium border-t border-gray-200 dark:border-slate-700 pt-2 text-gray-900 dark:text-white">
                <span>
                  {result.accrual.excess > 0 ? 'Over-deposited' : 'Outstanding'}
                </span>
                <span className="tabular-nums">
                  {formatCurrency(
                    result.accrual.excess > 0
                      ? result.accrual.excess
                      : result.accrual.shortfall,
                  )}
                </span>
              </div>
            </div>

            <h3 className="text-xs text-gray-500 dark:text-slate-500 mt-5 mb-2">
              What this does not attract
            </h3>
            {/* Stated rather than omitted: a population silently excluded from
                a headcount is indistinguishable from one somebody forgot. */}
            <div className="flex flex-wrap gap-1">
              {Object.keys(result.exclusions || {}).map((statute) => (
                <span
                  key={statute}
                  className="px-2 py-0.5 rounded text-[10px] bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400"
                  title="A gig or platform worker is engaged outside a traditional employer–employee relationship under section 2(35)."
                >
                  {EXCLUDED_LABELS[statute] || statute}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {contribution?.attribution?.categories?.length > 0 && (
        <div className="mb-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <h2 className="text-lg font-serif text-gray-900 dark:text-white">
              Turnover by Seventh Schedule category
            </h2>
            {contribution.attribution.unattributed > 0 && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {formatCurrency(contribution.attribution.unattributed)}{' '}
                unattributed — no rate applies to it
              </p>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-900/50">
                <tr className="text-left text-xs text-gray-500 dark:text-slate-500">
                  <th className="p-3 font-medium">Category</th>
                  <th className="p-3 font-medium text-right">Turnover</th>
                  <th className="p-3 font-medium text-right">Rate</th>
                  <th className="p-3 font-medium text-right">Contribution</th>
                </tr>
              </thead>
              <tbody>
                {contribution.attribution.categories.map((row) => (
                  <tr
                    key={row.category}
                    className="border-t border-gray-100 dark:border-slate-800"
                  >
                    <td className="p-3 text-gray-900 dark:text-white">
                      {CATEGORY_LABELS[row.category] || row.label}
                    </td>
                    <td className="p-3 text-right text-gray-600 dark:text-slate-400">
                      {formatCurrency(row.turnover)}
                    </td>
                    <td className="p-3 text-right text-gray-600 dark:text-slate-400">
                      {row.rate}%
                      {!row.withinBand && (
                        <p className="text-[11px] text-red-600 dark:text-red-400">
                          {row.configured}% clamped
                        </p>
                      )}
                    </td>
                    <td className="p-3 text-right text-gray-900 dark:text-white">
                      {formatCurrency(row.contribution)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                  · {row.section} · {row.workerCount || row.count}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h2 className="text-lg font-serif text-gray-900 dark:text-white">
          The worker register
        </h2>
        {result && (
          <p className="text-xs text-gray-500 dark:text-slate-500">
            {result.qualifyingCount} past ninety days · {result.registeredCount}{' '}
            registered
            {result.multiAggregatorCount > 0 && (
              <>
                {' · '}
                <span className="text-indigo-700 dark:text-indigo-300">
                  {result.multiAggregatorCount} engaged by more than one
                  platform
                </span>
              </>
            )}
          </p>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-slate-900/50">
            <tr className="text-left text-xs text-gray-500 dark:text-slate-500">
              <th className="p-3 font-medium">Worker</th>
              <th className="p-3 font-medium text-right">Platforms</th>
              <th className="p-3 font-medium text-right">Days here</th>
              <th className="p-3 font-medium text-right">Days elsewhere</th>
              <th className="p-3 font-medium text-right">Total</th>
              <th className="p-3 font-medium">Registration</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((row) => {
              const here = row.daysByAggregator?.[platform] || 0;
              const elsewhere = row.daysTotal - here;

              return (
                <tr
                  key={String(row.workerId)}
                  className="border-t border-gray-100 dark:border-slate-800"
                >
                  <td className="p-3 text-gray-900 dark:text-white">
                    {row.name}
                    {row.aggregatorCount > 1 && (
                      <span className="ml-2 px-2 py-0.5 rounded text-[10px] bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300">
                        Multi-platform
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right text-gray-600 dark:text-slate-400">
                    {row.aggregatorCount}
                  </td>
                  <td className="p-3 text-right text-gray-600 dark:text-slate-400">
                    {here}
                  </td>
                  <td className="p-3 text-right text-gray-600 dark:text-slate-400">
                    {elsewhere}
                  </td>
                  <td className="p-3 text-right text-gray-900 dark:text-white">
                    {row.daysTotal}
                    <span className="text-[11px] text-gray-400 dark:text-slate-600">
                      /{row.qualifyingDays}
                    </span>
                  </td>
                  <td className="p-3 text-xs">
                    {row.registered ? (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        Registered {formatDate(row.registeredOn)}
                      </span>
                    ) : row.qualifies ? (
                      <span className="text-red-600 dark:text-red-400">
                        Entitled, not registered
                      </span>
                    ) : (
                      <span className="text-gray-500 dark:text-slate-500">
                        {row.daysTotal}/{row.qualifyingDays} days
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}

            {!workers.length && (
              <tr>
                <td
                  colSpan={6}
                  className="p-6 text-center text-sm text-gray-500 dark:text-slate-500"
                >
                  No gig or platform workers recorded.
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
                  <th className="p-3 font-medium">Platform</th>
                  <th className="p-3 font-medium">Year</th>
                  <th className="p-3 font-medium text-right">Turnover limb</th>
                  <th className="p-3 font-medium text-right">Ceiling</th>
                  <th className="p-3 font-medium">Bound on</th>
                  <th className="p-3 font-medium text-right">Payable</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr
                    key={String(row._id)}
                    className="border-t border-gray-100 dark:border-slate-800"
                  >
                    <td className="p-3 text-gray-900 dark:text-white">
                      {row.name}
                    </td>
                    <td className="p-3 text-gray-600 dark:text-slate-400">
                      {row.financialYear}
                      {row.provisional && (
                        <span className="ml-1 text-[11px] text-amber-700 dark:text-amber-400">
                          provisional
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right text-gray-600 dark:text-slate-400">
                      {formatCurrency(row.turnoverLimb)}
                    </td>
                    <td className="p-3 text-right text-gray-600 dark:text-slate-400">
                      {formatCurrency(row.payoutCeiling)}
                    </td>
                    <td className="p-3 text-xs text-gray-600 dark:text-slate-400">
                      {row.capped ? 'Payout ceiling' : 'Turnover'}
                    </td>
                    <td className="p-3 text-right text-gray-900 dark:text-white">
                      {formatCurrency(row.payable)}
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

export default AggregatorContribution;
