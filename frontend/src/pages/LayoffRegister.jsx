import { useCallback, useEffect, useMemo, useState } from 'react';

import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDate } from '../utils/formatLocale';

/**
 * Industrial Disputes Act, Chapters VA and VB (#1830).
 *
 * The page leads with the **lawfulness banner**, not with a total, because the
 * chapter's largest output is not a payment. Where prior permission was
 * required and absent the workmen are deemed not to have been laid off and are
 * owed full wages as if they had continued — several times the fifty per cent
 * section 25C would have paid.
 *
 * So the two liabilities are drawn as two figures with the applicable one
 * filled and the other greyed, never as a single number and never summed. A
 * page that showed "₹22,500 owed" for an unlawful lay-off would be off by the
 * difference between half pay for forty-five days and full pay for the whole
 * period, and would look entirely reasonable while being so.
 *
 * The **ceiling bar** on each spell shows days already compensated in the
 * rolling twelve months alongside the days this spell will draw. That prior
 * consumption is the thing a per-spell view cannot see: a spell in March eats
 * the ceiling a spell in November needs, and by November nobody remembers March.
 *
 * Spells past their ceiling sort to the top. Past forty-five days section 25C
 * stops compelling payment where there is an agreement to the contrary, and
 * without one the alternative is retrenchment — which is a decision somebody has
 * to take rather than a number to look at.
 */

const PERMISSION_LABELS = {
  NOT_REQUIRED: 'Below the Chapter VB threshold',
  GRANTED: 'Permission granted',
  DEEMED_GRANTED: 'Deemed granted',
  REFUSED: 'Permission refused',
  NOT_SOUGHT: 'No permission sought',
};

const ACTION_LABELS = {
  LAYOFF: 'Lay-off',
  RETRENCHMENT: 'Retrenchment',
  CLOSURE: 'Closure',
};

const DISENTITLEMENT_LABELS = {
  REFUSED_ALTERNATIVE_EMPLOYMENT: 'Refused alternative employment',
  FAILED_TO_PRESENT: 'Did not present',
  STRIKE_ELSEWHERE_IN_ESTABLISHMENT: 'Strike elsewhere in the establishment',
};

const FINDING_LABELS = {
  SERVICE_NOT_QUALIFIED: 'Short of section 25B continuous service',
  CEILING_REACHED: 'The 45-day ceiling is exhausted',
  CEILING_EXCEEDED: 'Days beyond the 45-day ceiling',
  DAYS_DISENTITLED: 'Days disentitled under section 25E',
  PERMISSION_NOT_SOUGHT: 'No Chapter VB permission sought',
  PERMISSION_REFUSED: 'Chapter VB permission refused',
  ACT_ILLEGAL: 'The act is illegal — full wages are owed',
  NOTICE_SHORT: 'Less than three months’ notice',
  SENIORITY_DEPARTURE: 'A departure from last-in-first-out',
  SENIORITY_DEPARTURE_UNEXPLAINED: 'An unexplained departure from LIFO',
  REEMPLOYMENT_PREFERENCE_DUE: 'A section 25H preference is due',
  CLOSURE_CAP_NOT_AVAILABLE: 'The three-month closure cap is not available',
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
    return 'You do not have permission to view the lay-off register.';
  }
  return response.data?.message || fallback;
};

const currentFinancialYear = () => {
  const now = new Date();
  return now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
};

/**
 * The rolling forty-five days, and where this spell sits inside them.
 *
 * The already-consumed segment is the point: it comes from other spells in the
 * preceding twelve months, and it is the reason the ceiling cannot be answered
 * from the spell in front of you.
 */
const CeilingBar = ({ compensation }) => {
  const ceiling = Math.max(compensation?.ceiling || 45, 1);
  const consumed = compensation?.alreadyCompensatedInWindow || 0;
  const payable = compensation?.payableDays || 0;
  const beyond = compensation?.beyondCeilingDays || 0;

  const pct = (value) => `${Math.min(100, (value / ceiling) * 100)}%`;

  return (
    <div className="min-w-[170px]">
      <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100 dark:bg-slate-800">
        <div
          className="bg-gray-300 dark:bg-slate-600"
          style={{ width: pct(consumed) }}
          title={`${consumed} days already compensated in the rolling twelve months`}
        />
        <div
          className="bg-indigo-500 dark:bg-indigo-400"
          style={{ width: pct(payable) }}
          title={`${payable} days payable on this spell`}
        />
      </div>

      <p className="text-[11px] text-gray-500 dark:text-slate-500 mt-1">
        {consumed > 0 && (
          <span className="text-gray-400 dark:text-slate-600">
            {consumed} used ·{' '}
          </span>
        )}
        {payable} payable of {ceiling}
      </p>

      {beyond > 0 && (
        <p className="text-[11px] text-orange-700 dark:text-orange-400">
          {beyond} days beyond the ceiling
        </p>
      )}
    </div>
  );
};

const LayoffRegister = () => {
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
        api.get('/api/layoffs/assessment', { params: { financialYear } }),
        api.get('/api/layoffs/assessments'),
      ]);

      setAssessment(assessmentRes.data || null);
      setHistory(
        Array.isArray(historyRes.data?.assessments)
          ? historyRes.data.assessments
          : [],
      );
    } catch (error) {
      setLoadError(
        describeError(error, 'Could not load the lay-off register.'),
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
      await api.post('/api/layoffs/assessments', { financialYear });
      toast('Assessment committed.', 'success');
      await load();
    } catch (error) {
      toast(describeError(error, 'Could not commit the assessment.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const result = assessment?.result;
  const chapterVB = result?.chapterVB;
  const unlawful = result && !result.lawful;

  /** Past the ceiling first — those need a decision, not a look. */
  const spells = useMemo(() => {
    const rows = [...(result?.spells || [])];

    const rank = (row) => {
      if (row.compensation.beyondCeilingDays > 0) return 0;
      if (!row.service.qualified) return 1;
      if (row.compensation.disentitledDays > 0) return 2;
      return 3;
    };

    return rows.sort(
      (a, b) =>
        rank(a) - rank(b) ||
        b.compensation.beyondCeilingDays - a.compensation.beyondCeilingDays,
    );
  }, [result]);

  if (loading) {
    return (
      <div className="p-4 sm:p-8">
        <p className="text-sm text-gray-500 dark:text-slate-500">
          Loading the lay-off register…
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-serif text-gray-900 dark:text-white">
            Lay-off &amp; Chapter VB
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-500 mt-1 max-w-2xl">
            The employment subsists throughout. Above the threshold the question
            is not what a lay-off costs but whether the employer was entitled to
            do it at all.
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

      {chapterVB && (
        <div
          className={`mb-6 p-4 rounded-lg text-sm ${
            unlawful
              ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
              : chapterVB.permissionRequired
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
          }`}
        >
          <p className="font-medium">
            {ACTION_LABELS[chapterVB.action] || chapterVB.action} ·{' '}
            {PERMISSION_LABELS[chapterVB.permission] || chapterVB.permission}
          </p>
          <p className="mt-1">
            {chapterVB.workmen} workmen against a {chapterVB.section} threshold
            of {chapterVB.threshold}.{' '}
            {unlawful
              ? 'The act is illegal. The workmen are deemed not to have been laid off and are entitled to all wages and benefits as if they had continued — which is not compensation.'
              : chapterVB.permissionRequired
                ? 'Prior permission was required and is held.'
                : 'Prior permission is not required at this headcount.'}
          </p>
        </div>
      )}

      {result && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {/* Two figures, never one, and never summed. The greyed one is what
              would have applied had the act been the other way round. */}
          {[
            {
              key: 'COMPENSATION',
              label: 'Section 25C compensation',
              hint: `50% of basic and DA, ${result.payableDays} payable days`,
              value: result.compensation,
            },
            {
              key: 'FULL_WAGES_AS_IF_CONTINUED',
              label: 'Full wages, as if they had continued',
              hint: 'Owed where the act was unlawful. Not compensation.',
              value: result.illegalityExposure,
            },
          ].map((card) => {
            const applies = result.applicableLiability === card.key;

            return (
              <div
                key={card.key}
                className={`p-5 rounded-xl border ${
                  applies
                    ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/40 dark:bg-indigo-900/10'
                    : 'border-gray-200 dark:border-slate-800 opacity-60'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs text-gray-500 dark:text-slate-500">
                    {card.label}
                  </p>
                  {applies && (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                      applies
                    </span>
                  )}
                </div>
                <p className="text-2xl font-serif text-gray-900 dark:text-white mt-1">
                  {formatCurrency(card.value)}
                </p>
                <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">
                  {card.hint}
                </p>
              </div>
            );
          })}
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
        Spells of lay-off
      </h2>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-slate-900/50">
            <tr className="text-left text-xs text-gray-500 dark:text-slate-500">
              <th className="p-3 font-medium">Workman</th>
              <th className="p-3 font-medium">Section 25B service</th>
              <th className="p-3 font-medium">Days</th>
              <th className="p-3 font-medium">Rolling ceiling</th>
              <th className="p-3 font-medium text-right">Compensation</th>
              <th className="p-3 font-medium text-right">If unlawful</th>
            </tr>
          </thead>
          <tbody>
            {spells.map((row) => (
              <tr
                key={String(row.workmanId)}
                className="border-t border-gray-100 dark:border-slate-800 align-top"
              >
                <td className="p-3">
                  <p className="text-gray-900 dark:text-white">{row.name}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-500">
                    {row.category || '—'}
                  </p>
                </td>

                <td className="p-3 text-xs">
                  <p
                    className={
                      row.service.qualified
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    }
                  >
                    {row.service.counted}/{row.service.required} days
                  </p>
                  {row.service.breakdown?.LAYOFF > 0 && (
                    // Worth showing: lay-off days count toward the service that
                    // qualifies for lay-off compensation, which is the part an
                    // attendance ledger gets backwards.
                    <p className="text-gray-500 dark:text-slate-500 mt-0.5">
                      incl. {row.service.breakdown.LAYOFF} laid-off days
                    </p>
                  )}
                  {row.service.breakdown?.MATERNITY_LEAVE > 0 && (
                    <p className="text-gray-500 dark:text-slate-500">
                      maternity capped at {row.service.maternityCapDays}
                    </p>
                  )}
                </td>

                <td className="p-3 text-xs text-gray-600 dark:text-slate-400">
                  <p>{row.compensation.laidOffDays} laid off</p>
                  {row.compensation.weeklyHolidays > 0 && (
                    <p className="text-gray-500 dark:text-slate-500">
                      less {row.compensation.weeklyHolidays} weekly holidays
                    </p>
                  )}
                  {row.compensation.disentitled.map((entry) => (
                    <p
                      key={entry.reason}
                      className="text-orange-700 dark:text-orange-400"
                      title={entry.label}
                    >
                      less {entry.days} ·{' '}
                      {DISENTITLEMENT_LABELS[entry.reason] || entry.reason}
                    </p>
                  ))}
                </td>

                <td className="p-3">
                  <CeilingBar compensation={row.compensation} />
                </td>

                <td className="p-3 text-right text-gray-900 dark:text-white">
                  {formatCurrency(row.compensation.compensation)}
                  <p className="text-[11px] text-gray-500 dark:text-slate-500">
                    {formatCurrency(row.compensation.compensableRate)}/day
                  </p>
                </td>

                <td className="p-3 text-right text-gray-500 dark:text-slate-500">
                  {formatCurrency(row.exposure.amount)}
                  <p className="text-[11px] text-gray-400 dark:text-slate-600">
                    full wages
                  </p>
                </td>
              </tr>
            ))}

            {!spells.length && (
              <tr>
                <td
                  colSpan={6}
                  className="p-6 text-center text-sm text-gray-500 dark:text-slate-500"
                >
                  No spells of lay-off recorded for this year.
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
                  <th className="p-3 font-medium">Act</th>
                  <th className="p-3 font-medium">Lawful</th>
                  <th className="p-3 font-medium text-right">Compensation</th>
                  <th className="p-3 font-medium text-right">If unlawful</th>
                  <th className="p-3 font-medium">Applies</th>
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
                    <td className="p-3 text-gray-600 dark:text-slate-400">
                      {ACTION_LABELS[row.action] || row.action}
                    </td>
                    <td className="p-3 text-xs">
                      {row.lawful ? (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          Yes
                        </span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400">
                          No
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right text-gray-600 dark:text-slate-400">
                      {formatCurrency(row.compensation)}
                    </td>
                    <td className="p-3 text-right text-gray-600 dark:text-slate-400">
                      {formatCurrency(row.illegalityExposure)}
                    </td>
                    <td className="p-3 text-xs text-gray-900 dark:text-white">
                      {row.applicableLiability === 'COMPENSATION'
                        ? 'Compensation'
                        : 'Full wages'}
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

export default LayoffRegister;
