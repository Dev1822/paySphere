import { useCallback, useEffect, useMemo, useState } from 'react';

import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDate } from '../utils/formatLocale';

/**
 * BOCW Welfare Cess Act, 1996 (#1827).
 *
 * The page is built around the two things that make this levy unlike every
 * other one in the product.
 *
 * The **base bar** shows the project cost split into what section 3 excluded
 * and what remains, because the exclusions are what an assessment order argues
 * about. On a real-estate job the land is frequently the larger half, so a page
 * that showed only the net base would be hiding the number the argument is
 * about — and one that showed only the gross would look like a cess ten times
 * too large.
 *
 * The **cess ladder** shows assessed, less advance deducted at source, less
 * paid, leaving the demand — then interest below the line and the section 9
 * ceiling below that, greyed. The greying is the point: the penalty is
 * discretionary and imposed by order, so it is an exposure to be aware of and
 * never a number to remit. Drawing it in the same weight as the demand would
 * put a decision nobody has made into somebody's payment run.
 *
 * The beneficiary register leads with the workers who reached ninety days only
 * by counting work done for other employers. Those are precisely the ones an
 * establishment answering from its own attendance ledger would call ineligible.
 */

const STATUS_LABELS = {
  ADVANCE_ACCRUING: 'Advance accruing',
  SETTLED: 'Settled',
  DEMAND: 'Demand outstanding',
  REFUND_DUE: 'Refund due',
};

const STATUS_TONE = {
  ADVANCE_ACCRUING:
    'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
  SETTLED:
    'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
  DEMAND: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
  REFUND_DUE:
    'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300',
};

const FINDING_LABELS = {
  RATE_OUTSIDE_BAND: 'The stored rate is outside the 1–2% band',
  LAND_NOT_EXCLUDED: 'No land cost excluded',
  ADVANCE_SHORT_DEDUCTED: 'A bill was short-deducted at source',
  CESS_OVERDUE: 'Cess past the payment window',
  DEMAND_OUTSTANDING: 'Assessed cess outstanding',
  REFUND_DUE: 'More deducted than assessed',
  PENALTY_EXPOSURE: 'Section 9 penalty exposure',
  BENEFICIARY_UNREGISTERED: 'Entitled to register and not registered',
  BENEFICIARY_DAYS_UNRECORDED: 'Only this site’s days recorded',
  BENEFICIARY_OUT_OF_AGE_BAND: 'Outside the 18–60 band',
  REGISTRATION_REQUIRED: 'The establishment is not registered',
  NOT_APPLICABLE: 'Below the ten-worker threshold',
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
    return 'You do not have permission to view the construction cess register.';
  }
  return response.data?.message || fallback;
};

const currentFinancialYear = () => {
  const now = new Date();
  return now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
};

/**
 * The project cost, split into what section 3 took out and what it left in.
 *
 * Both halves drawn to scale against the gross, because the exclusions are the
 * part an assessment order argues about — and on a project where the land was
 * bought they are usually the larger of the two.
 */
const BaseBar = ({ cost }) => {
  const gross = Math.max(cost?.totalProjectCost || 0, 1);
  const excludedShare = ((cost?.excluded || 0) / gross) * 100;

  return (
    <div className="min-w-[200px]">
      <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100 dark:bg-slate-800">
        <div
          className="bg-gray-300 dark:bg-slate-600"
          style={{ width: `${excludedShare}%` }}
          title={`Excluded under section 3: ${formatCurrency(cost?.excluded || 0)}`}
        />
        <div
          className="bg-indigo-500 dark:bg-indigo-400"
          style={{ width: `${100 - excludedShare}%` }}
          title={`Base: ${formatCurrency(cost?.base || 0)}`}
        />
      </div>
      <p className="text-[11px] text-gray-500 dark:text-slate-500 mt-1">
        {formatCurrency(cost?.excluded || 0)} excluded ·{' '}
        <span className="text-indigo-700 dark:text-indigo-300">
          {formatCurrency(cost?.base || 0)} base
        </span>
      </p>
      {!cost?.landExcluded && (
        <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
          No land cost excluded
        </p>
      )}
    </div>
  );
};

const ConstructionCessRegister = () => {
  const [financialYear, setFinancialYear] = useState(currentFinancialYear());

  const [assessment, setAssessment] = useState(null);
  const [history, setHistory] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);

  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const [assessmentRes, historyRes] = await Promise.all([
        api.get('/api/construction-cess/assessment', {
          params: { financialYear },
        }),
        api.get('/api/construction-cess/assessments'),
      ]);

      setAssessment(assessmentRes.data || null);
      setHistory(
        Array.isArray(historyRes.data?.assessments)
          ? historyRes.data.assessments
          : [],
      );
    } catch (error) {
      setLoadError(
        describeError(error, 'Could not load the construction cess register.'),
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
      await api.post('/api/construction-cess/assessments', { financialYear });
      toast('Assessment committed.', 'success');
      await load();
    } catch (error) {
      toast(describeError(error, 'Could not commit the assessment.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const result = assessment?.result;

  /** Demands first, then anything overdue, then the rest. */
  const projects = useMemo(() => {
    const rows = [...(result?.projects || [])];

    const rank = (row) => {
      if (row.status === 'DEMAND') return 0;
      if (row.status === 'REFUND_DUE') return 1;
      if (row.status === 'ADVANCE_ACCRUING') return 2;
      return 3;
    };

    return rows.sort((a, b) => rank(a) - rank(b) || b.payable - a.payable);
  }, [result]);

  /**
   * Workers who qualified only by counting elsewhere, first.
   *
   * They are the rows an establishment answering the ninety-day test from its
   * own attendance ledger would have reported as ineligible.
   */
  const workers = useMemo(() => {
    const rows = [...(result?.workers || [])];

    const rank = (row) => {
      if (row.eligible && !row.registered && row.daysElsewhere > 0) return 0;
      if (row.eligible && !row.registered) return 1;
      if (!row.eligible) return 2;
      return 3;
    };

    return rows.sort((a, b) => rank(a) - rank(b) || b.daysTotal - a.daysTotal);
  }, [result]);

  if (loading) {
    return (
      <div className="p-4 sm:p-8">
        <p className="text-sm text-gray-500 dark:text-slate-500">
          Loading the construction cess register…
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-serif text-gray-900 dark:text-white">
            Construction cess
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-500 mt-1 max-w-2xl">
            One per cent of the cost of construction — the only levy here whose
            base is not a wage. Two jobs with the same payroll can carry cess
            differing twentyfold.
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
          {result.applicability.buildingWorkers} building workers. The BOCW Act
          starts at {result.applicability.threshold} — against{' '}
          {result.applicability.contractLabourThreshold} under the Contract
          Labour Act and {result.applicability.apprenticesActThreshold} under
          the Apprentices Act.
        </div>
      )}

      {result && (
        <div className="mb-8 p-5 rounded-xl border border-gray-200 dark:border-slate-800">
          <h2 className="text-lg font-serif text-gray-900 dark:text-white mb-4">
            Where the cess stands
          </h2>

          <div className="space-y-2 max-w-md">
            {[
              { label: 'Assessed on the base', value: result.assessed },
              {
                label: 'Less deducted at source',
                value: -result.advanceDeducted,
              },
              { label: 'Less remitted directly', value: -result.cessPaid },
            ].map((row) => (
              <div
                key={row.label}
                className="flex justify-between text-sm text-gray-600 dark:text-slate-400"
              >
                <span>{row.label}</span>
                <span className="tabular-nums">
                  {formatCurrency(row.value)}
                </span>
              </div>
            ))}

            <div className="flex justify-between text-sm font-medium border-t border-gray-200 dark:border-slate-700 pt-2 text-gray-900 dark:text-white">
              <span>Demand outstanding</span>
              <span className="tabular-nums">
                {formatCurrency(result.outstanding)}
              </span>
            </div>

            <div className="flex justify-between text-sm text-gray-600 dark:text-slate-400">
              <span>Section 8 interest, 2% a month</span>
              <span className="tabular-nums">
                {formatCurrency(result.interest)}
              </span>
            </div>

            <div className="flex justify-between text-base font-medium border-t border-gray-200 dark:border-slate-700 pt-2 text-gray-900 dark:text-white">
              <span>Payable</span>
              <span className="tabular-nums">
                {formatCurrency(result.payable)}
              </span>
            </div>

            {/* Greyed on purpose. Discretionary, imposed by order, and never a
                number to remit — drawing it in the same weight as the demand
                would put a decision nobody has made into a payment run. */}
            <div className="flex justify-between text-xs text-gray-400 dark:text-slate-600 pt-1">
              <span>Section 9 penalty exposure, a ceiling only</span>
              <span className="tabular-nums">
                up to {formatCurrency(result.penaltyCeiling)}
              </span>
            </div>

            {result.refundDue > 0 && (
              <div className="flex justify-between text-xs text-amber-700 dark:text-amber-400">
                <span>Over-deducted at source, refundable</span>
                <span className="tabular-nums">
                  {formatCurrency(result.refundDue)}
                </span>
              </div>
            )}
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
                  · {row.section} · {row.subjectCount || row.count}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      <h2 className="text-lg font-serif text-gray-900 dark:text-white mb-3">
        Projects
      </h2>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-slate-900/50">
            <tr className="text-left text-xs text-gray-500 dark:text-slate-500">
              <th className="p-3 font-medium">Project</th>
              <th className="p-3 font-medium">Cost of construction</th>
              <th className="p-3 font-medium text-right">Assessed</th>
              <th className="p-3 font-medium text-right">Advance</th>
              <th className="p-3 font-medium text-right">Interest</th>
              <th className="p-3 font-medium text-right">Payable</th>
              <th className="p-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((row) => (
              <tr
                key={String(row.projectId)}
                className="border-t border-gray-100 dark:border-slate-800 align-top"
              >
                <td className="p-3">
                  <p className="text-gray-900 dark:text-white">{row.name}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-500">
                    {formatCurrency(row.cost.totalProjectCost)} gross
                  </p>
                </td>

                <td className="p-3">
                  <BaseBar cost={row.cost} />
                </td>

                <td className="p-3 text-right text-gray-900 dark:text-white">
                  {formatCurrency(row.assessed)}
                  <p className="text-[11px] text-gray-500 dark:text-slate-500">
                    at {row.rate}%
                  </p>
                </td>

                <td className="p-3 text-right text-gray-600 dark:text-slate-400">
                  {formatCurrency(row.advance.deducted)}
                  {row.advance.shortfall > 0 && (
                    <p className="text-[11px] text-red-600 dark:text-red-400">
                      {formatCurrency(row.advance.shortfall)} short
                    </p>
                  )}
                </td>

                <td className="p-3 text-right text-gray-600 dark:text-slate-400">
                  {formatCurrency(row.interest.interest)}
                  {row.interest.months > 0 && (
                    <p className="text-[11px] text-gray-500 dark:text-slate-500">
                      {row.interest.months} months
                    </p>
                  )}
                </td>

                <td className="p-3 text-right text-gray-900 dark:text-white">
                  {formatCurrency(row.payable)}
                </td>

                <td className="p-3">
                  <span
                    className={`px-2 py-1 rounded text-[11px] ${STATUS_TONE[row.status]}`}
                  >
                    {STATUS_LABELS[row.status] || row.status}
                  </span>
                  {row.dueOn && (
                    <p className="text-[11px] text-gray-500 dark:text-slate-500 mt-1">
                      due {formatDate(row.dueOn)}
                    </p>
                  )}
                </td>
              </tr>
            ))}

            {!projects.length && (
              <tr>
                <td
                  colSpan={7}
                  className="p-6 text-center text-sm text-gray-500 dark:text-slate-500"
                >
                  No construction projects recorded for this year.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-2 mt-8 mb-3">
        <h2 className="text-lg font-serif text-gray-900 dark:text-white">
          Beneficiary register
        </h2>
        {result && (
          <p className="text-xs text-gray-500 dark:text-slate-500">
            {result.eligibleCount} eligible · {result.registeredCount}{' '}
            registered
            {result.qualifiedElsewhereCount > 0 && (
              <>
                {' · '}
                <span className="text-indigo-700 dark:text-indigo-300">
                  {result.qualifiedElsewhereCount} qualified only by counting
                  other employers
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
              <th className="p-3 font-medium text-right">Age</th>
              <th className="p-3 font-medium text-right">Days here</th>
              <th className="p-3 font-medium text-right">Days elsewhere</th>
              <th className="p-3 font-medium text-right">Total</th>
              <th className="p-3 font-medium">Registration</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((row) => (
              <tr
                key={String(row.workerId)}
                className="border-t border-gray-100 dark:border-slate-800"
              >
                <td className="p-3 text-gray-900 dark:text-white">
                  {row.name}
                  {row.eligible && row.daysElsewhere > 0 && (
                    <span className="ml-2 px-2 py-0.5 rounded text-[10px] bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300">
                      Qualified elsewhere
                    </span>
                  )}
                </td>
                <td className="p-3 text-right text-gray-600 dark:text-slate-400">
                  {row.age ?? '—'}
                </td>
                <td className="p-3 text-right text-gray-600 dark:text-slate-400">
                  {row.daysThisEstablishment}
                </td>
                <td className="p-3 text-right text-gray-600 dark:text-slate-400">
                  {row.daysElsewhere}
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
                  ) : row.eligible ? (
                    <span className="text-red-600 dark:text-red-400">
                      Entitled, not registered
                    </span>
                  ) : row.inAgeBand ? (
                    <span className="text-gray-500 dark:text-slate-500">
                      {row.daysTotal}/{row.qualifyingDays} days recorded
                    </span>
                  ) : (
                    <span className="text-gray-500 dark:text-slate-500">
                      Outside the age band
                    </span>
                  )}
                </td>
              </tr>
            ))}

            {!workers.length && (
              <tr>
                <td
                  colSpan={6}
                  className="p-6 text-center text-sm text-gray-500 dark:text-slate-500"
                >
                  No building workers recorded.
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
                  <th className="p-3 font-medium text-right">Base</th>
                  <th className="p-3 font-medium text-right">Assessed</th>
                  <th className="p-3 font-medium text-right">Payable</th>
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
                      {formatCurrency(row.base)}
                    </td>
                    <td className="p-3 text-right text-gray-600 dark:text-slate-400">
                      {formatCurrency(row.assessed)}
                    </td>
                    <td className="p-3 text-right text-gray-900 dark:text-white">
                      {formatCurrency(row.payable)}
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

export default ConstructionCessRegister;
