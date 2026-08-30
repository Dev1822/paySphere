import { useCallback, useEffect, useMemo, useState } from 'react';

import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDate } from '../utils/formatLocale';

/**
 * Inter-State Migrant Workmen Act, 1979 (#1826).
 *
 * The page is built around the one comparison nothing else in the product can
 * show.
 *
 * The **parity strip** draws three rates on one line — the home state's
 * notified rate, the host state's, and what a comparable local workman actually
 * earns — with the rate that was paid marked against them. Drawn rather than
 * tabulated because the failure it exists to catch is a workman sitting
 * *above* every notified rate and *below* the person next to them: as a table
 * of numbers that reads as compliant, and as a strip the gap is the whole
 * point.
 *
 * A workman with no recorded comparator is drawn with the third mark missing
 * rather than at zero. "Nobody has looked" and "there is no comparable work
 * here" are different states and the second one is a finding somebody made.
 *
 * The roll sorts parity-only breaches to the top — above the plain wage-floor
 * ones. Those are the rows every other compliance view in the product reports
 * as clean, so they are the rows most likely to be news.
 */

const BASIS_LABELS = {
  HOME_STATE_NOTIFIED: 'Home state, notified',
  HOST_STATE_NOTIFIED: 'State of employment, notified',
  LOCAL_COMPARABLE: 'Comparable local workman',
};

const BASIS_SHORT = {
  HOME_STATE_NOTIFIED: 'Home',
  HOST_STATE_NOTIFIED: 'Host',
  LOCAL_COMPARABLE: 'Local',
};

const BASIS_ORDER = [
  'HOME_STATE_NOTIFIED',
  'HOST_STATE_NOTIFIED',
  'LOCAL_COMPARABLE',
];

const FACILITY_LABELS = {
  ACCOMMODATION: 'Residential accommodation',
  MEDICAL: 'Medical facilities',
  PROTECTIVE_CLOTHING: 'Protective clothing',
};

const FINDING_LABELS = {
  BELOW_STATUTORY_FLOOR: 'Below the notified minimum',
  BELOW_LOCAL_COMPARABLE: 'Below a comparable local workman',
  NO_LOCAL_COMPARATOR: 'No comparable local rate recorded',
  DISPLACEMENT_UNPAID: 'Displacement allowance never paid',
  DISPLACEMENT_SHORT: 'Displacement allowance underpaid',
  DISPLACEMENT_RECOVERED: 'A non-refundable allowance was recovered',
  OUTWARD_JOURNEY_UNPAID: 'Outward journey unpaid',
  RETURN_JOURNEY_UNACCRUED: 'Return journey not accrued',
  JOURNEY_WAGES_UNPAID: 'Wages for the journey unpaid',
  FACILITY_NOT_PROVIDED: 'A section 16 facility is not provided',
  PASSBOOK_NOT_ISSUED: 'No passbook issued',
  PASSBOOK_STALE: 'Passbook not updated after a rate change',
  REGISTRATION_REQUIRED: 'The establishment is not registered',
  CONTRACTOR_UNLICENSED: 'A contractor has no section 8 licence',
  NOT_APPLICABLE: 'Below the five-workman threshold',
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
    return 'You do not have permission to view the migrant workmen register.';
  }
  return response.data?.message || fallback;
};

const currentFinancialYear = () => {
  const now = new Date();
  return now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
};

/**
 * The three candidate rates on one line, with what was paid marked against them.
 *
 * The scale runs to the highest candidate rather than to a fixed maximum, so
 * the gap between the paid mark and the binding rate is proportional to the
 * breach rather than to whatever the largest wage on the site happens to be.
 */
const ParityStrip = ({ parity }) => {
  const candidates = parity?.binding?.candidates || {};

  const values = BASIS_ORDER.map((basis) => candidates[basis]).filter(
    (value) => typeof value === 'number' && value > 0,
  );

  const ceiling = Math.max(parity?.paidDailyRate || 0, ...values, 1);
  const positionOf = (value) => `${Math.min(100, (value / ceiling) * 100)}%`;

  return (
    <div className="min-w-[220px]">
      <div className="relative h-8">
        <div className="absolute inset-x-0 top-4 h-px bg-gray-200 dark:bg-slate-700" />

        {BASIS_ORDER.map((basis) => {
          const value = candidates[basis];
          if (typeof value !== 'number' || value <= 0) return null;

          const binding = parity?.binding?.basis === basis;

          return (
            <div
              key={basis}
              className="absolute top-1 -translate-x-1/2 flex flex-col items-center"
              style={{ left: positionOf(value) }}
              title={`${BASIS_LABELS[basis]}: ${formatCurrency(value)}`}
            >
              <span
                className={`w-px h-6 ${
                  binding
                    ? 'bg-indigo-600 dark:bg-indigo-400'
                    : 'bg-gray-300 dark:bg-slate-600'
                }`}
              />
              <span
                className={`text-[10px] mt-0.5 ${
                  binding
                    ? 'text-indigo-700 dark:text-indigo-300 font-medium'
                    : 'text-gray-400 dark:text-slate-500'
                }`}
              >
                {BASIS_SHORT[basis]}
              </span>
            </div>
          );
        })}

        <div
          className="absolute top-2 -translate-x-1/2"
          style={{ left: positionOf(parity?.paidDailyRate || 0) }}
          title={`Paid: ${formatCurrency(parity?.paidDailyRate || 0)}`}
        >
          <span className="block w-2.5 h-2.5 rounded-full bg-gray-900 dark:bg-white ring-2 ring-white dark:ring-slate-900" />
        </div>
      </div>

      {!parity?.binding?.comparatorRecorded && (
        // Absent rather than zero: nobody has looked, which is not a finding
        // that there is no comparable work on the site.
        <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">
          No comparable local rate recorded
        </p>
      )}
    </div>
  );
};

const MigrantWorkmenCompliance = () => {
  const [financialYear, setFinancialYear] = useState(currentFinancialYear());

  const [assessment, setAssessment] = useState(null);
  const [history, setHistory] = useState([]);
  const [comparatorDraft, setComparatorDraft] = useState({});

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);

  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const [assessmentRes, historyRes] = await Promise.all([
        api.get('/api/migrant-workmen/assessment', {
          params: { financialYear },
        }),
        api.get('/api/migrant-workmen/assessments'),
      ]);

      setAssessment(assessmentRes.data || null);
      setHistory(
        Array.isArray(historyRes.data?.assessments)
          ? historyRes.data.assessments
          : [],
      );
    } catch (error) {
      setLoadError(
        describeError(error, 'Could not load the migrant workmen register.'),
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
      await api.post('/api/migrant-workmen/assessments', { financialYear });
      toast('Assessment committed.', 'success');
      await load();
    } catch (error) {
      toast(describeError(error, 'Could not commit the assessment.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveComparator = async (workmanId) => {
    const value = comparatorDraft[workmanId];
    setBusy(true);

    try {
      await api.put(`/api/migrant-workmen/workmen/${workmanId}/comparator`, {
        localComparableRate:
          value === '' || value === undefined ? null : Number(value),
      });
      toast('Comparable local rate recorded.', 'success');
      setComparatorDraft((previous) => {
        const next = { ...previous };
        delete next[workmanId];
        return next;
      });
      await load();
    } catch (error) {
      toast(describeError(error, 'Could not record the rate.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const accrueReturn = async (workmanId) => {
    setBusy(true);
    try {
      await api.post(
        `/api/migrant-workmen/workmen/${workmanId}/return-accrual`,
        {},
      );
      toast('Return journey accrued.', 'success');
      await load();
    } catch (error) {
      toast(
        describeError(error, 'Could not accrue the return journey.'),
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const result = assessment?.result;

  /**
   * Parity-only breaches first.
   *
   * They are the rows every other compliance view in the product reports as
   * clean — above every notified floor, under the colleague beside them — so
   * they are the rows most likely to be news. A plain wage-floor breach is
   * already visible in the minimum wages assessment.
   */
  const workmen = useMemo(() => {
    const rows = [...(result?.workmen || [])];

    const rank = (row) => {
      if (row.parity.parityGap > 0 && row.parity.floorGap === 0) return 0;
      if (row.parity.floorGap > 0) return 1;
      if (row.outstanding > 0) return 2;
      return 3;
    };

    return rows.sort(
      (a, b) => rank(a) - rank(b) || b.outstanding - a.outstanding,
    );
  }, [result]);

  if (loading) {
    return (
      <div className="p-4 sm:p-8">
        <p className="text-sm text-gray-500 dark:text-slate-500">
          Loading the migrant workmen register…
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-serif text-gray-900 dark:text-white">
            Migrant workmen
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-500 mt-1 max-w-2xl">
            Section 13(1)(a) is a minimum. Section 13(1)(b) is parity with a
            local workman doing similar work — so a migrant can be above every
            notified rate and still be owed arrears.
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

      {result && !result.applicable && (
        <div className="mb-6 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-sm">
          The highest migrant headcount in the period was{' '}
          {result.applicability.migrantPeak}. Sections 4 and 8 start at{' '}
          {result.applicability.threshold} — against{' '}
          {result.applicability.contractLabourThreshold} under the Contract
          Labour Act, which is the band establishments usually sit in.
        </div>
      )}

      {result && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: 'Above every floor, under the local rate',
              value: result.parityOnlyCount,
              hint: 'Workmen no other compliance view reports',
              accent: result.parityOnlyCount > 0,
            },
            {
              label: 'Wage arrears',
              value: formatCurrency(result.wageArrears),
              hint: 'To whichever limb binds',
            },
            {
              label: 'Allowances outstanding',
              value: formatCurrency(
                result.displacementShortfall + result.journeyOutstanding,
              ),
              hint: 'Sections 14 and 15',
            },
            {
              label: 'Section 16 exposure',
              value: formatCurrency(result.facilityExposure),
              hint: 'Recoverable as an arrear of land revenue',
            },
          ].map((card) => (
            <div
              key={card.label}
              className={`p-4 rounded-xl border ${
                card.accent
                  ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-900/10'
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
                  · {row.section} · {row.workmanCount || row.count}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      <h2 className="text-lg font-serif text-gray-900 dark:text-white mb-3">
        The roll
      </h2>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-slate-900/50">
            <tr className="text-left text-xs text-gray-500 dark:text-slate-500">
              <th className="p-3 font-medium">Workman</th>
              <th className="p-3 font-medium">Recruited from</th>
              <th className="p-3 font-medium">Rates</th>
              <th className="p-3 font-medium">Binds on</th>
              <th className="p-3 font-medium text-right">Wage arrears</th>
              <th className="p-3 font-medium">Allowances</th>
              <th className="p-3 font-medium text-right">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {workmen.map((row) => {
              const parityOnly =
                row.parity.parityGap > 0 && row.parity.floorGap === 0;

              return (
                <tr
                  key={String(row.workmanId)}
                  className="border-t border-gray-100 dark:border-slate-800 align-top"
                >
                  <td className="p-3">
                    <p className="text-gray-900 dark:text-white">{row.name}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-500">
                      {row.trade || '—'}
                    </p>
                    {parityOnly && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300">
                        Clears every floor
                      </span>
                    )}
                  </td>

                  <td className="p-3 text-xs text-gray-600 dark:text-slate-400">
                    {row.homeState || '—'}
                    <span className="text-gray-400 dark:text-slate-600">
                      {' → '}
                    </span>
                    {row.hostState || '—'}
                  </td>

                  <td className="p-3">
                    <ParityStrip parity={row.parity} />

                    {!row.parity.binding.comparatorRecorded && (
                      <div className="flex items-center gap-1 mt-2">
                        <input
                          type="number"
                          min="0"
                          placeholder="Local rate"
                          value={comparatorDraft[row.workmanId] ?? ''}
                          onChange={(event) =>
                            setComparatorDraft((previous) => ({
                              ...previous,
                              [row.workmanId]: event.target.value,
                            }))
                          }
                          className="w-24 p-1 text-xs border border-gray-300 dark:border-slate-700 rounded bg-transparent text-gray-900 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => saveComparator(row.workmanId)}
                          disabled={busy}
                          className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 disabled:opacity-50"
                        >
                          Record
                        </button>
                      </div>
                    )}
                  </td>

                  <td className="p-3 text-xs text-gray-600 dark:text-slate-400">
                    {BASIS_LABELS[row.parity.binding.basis] || '—'}
                    <p className="text-gray-900 dark:text-white mt-0.5">
                      {formatCurrency(row.parity.binding.rate)}/day
                    </p>
                  </td>

                  <td className="p-3 text-right">
                    <p className="text-gray-900 dark:text-white">
                      {formatCurrency(row.parity.arrears)}
                    </p>
                    {row.parity.parityGap > 0 && (
                      <p className="text-[11px] text-gray-500 dark:text-slate-500">
                        parity gap {formatCurrency(row.parity.parityGap)}/day
                      </p>
                    )}
                  </td>

                  <td className="p-3 text-xs">
                    <p className="text-gray-600 dark:text-slate-400">
                      Displacement{' '}
                      {row.displacement.shortfall > 0 ? (
                        <span className="text-red-600 dark:text-red-400">
                          short {formatCurrency(row.displacement.shortfall)}
                        </span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          paid
                        </span>
                      )}
                    </p>
                    <p className="text-gray-600 dark:text-slate-400 mt-0.5">
                      Return journey{' '}
                      {row.journey.legs?.[1]?.accrued ? (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          accrued
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => accrueReturn(row.workmanId)}
                          disabled={busy}
                          className="underline text-orange-700 dark:text-orange-400 disabled:opacity-50"
                        >
                          not accrued
                        </button>
                      )}
                    </p>
                    {row.passbook.stale && (
                      <p className="text-orange-700 dark:text-orange-400 mt-0.5">
                        Passbook {row.passbook.staleByDays} days stale
                      </p>
                    )}
                    {!row.passbook.issued && (
                      <p className="text-red-600 dark:text-red-400 mt-0.5">
                        No passbook
                      </p>
                    )}
                  </td>

                  <td className="p-3 text-right text-gray-900 dark:text-white">
                    {formatCurrency(row.outstanding)}
                  </td>
                </tr>
              );
            })}

            {!workmen.length && (
              <tr>
                <td
                  colSpan={7}
                  className="p-6 text-center text-sm text-gray-500 dark:text-slate-500"
                >
                  No migrant workmen recorded for this year.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {result?.facilities?.facilities?.length > 0 && (
        <>
          <h2 className="text-lg font-serif text-gray-900 dark:text-white mt-8 mb-3">
            Section 16 facilities
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {result.facilities.facilities.map((row) => (
              <div
                key={row.facility}
                className="p-4 rounded-xl border border-gray-200 dark:border-slate-800"
              >
                <p className="text-sm text-gray-900 dark:text-white">
                  {FACILITY_LABELS[row.facility] || row.label}
                </p>
                <p
                  className={`text-xs mt-1 ${
                    row.provided
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {row.provided ? 'Provided' : 'Not provided'}
                </p>
                {!row.provided && row.substituteCost > 0 && (
                  <p className="text-[11px] text-gray-500 dark:text-slate-500 mt-1">
                    {formatCurrency(row.substituteCost)} recoverable as an
                    arrear of land revenue
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}

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
                  <th className="p-3 font-medium text-right">Peak</th>
                  <th className="p-3 font-medium text-right">Parity-only</th>
                  <th className="p-3 font-medium text-right">Outstanding</th>
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
                      {row.migrantPeak}
                    </td>
                    <td className="p-3 text-right text-gray-600 dark:text-slate-400">
                      {row.parityOnlyCount}
                    </td>
                    <td className="p-3 text-right text-gray-900 dark:text-white">
                      {formatCurrency(row.outstanding)}
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

export default MigrantWorkmenCompliance;
