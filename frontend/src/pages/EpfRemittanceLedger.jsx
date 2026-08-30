import { useCallback, useEffect, useMemo, useState } from 'react';

import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDate } from '../utils/formatLocale';

/**
 * EPF belated remittance — sections 7Q and 14B (#1875).
 *
 * The page leads with **two figures side by side and never their sum**, which
 * is the whole design. Section 7Q interest is twelve per cent per annum and no
 * authority under the Act can waive it, so it is a provision. Section 14B
 * damages are graded from five to twenty-five per cent and the Board can waive
 * them to nil under paragraph 32B, so they may be a disclosure instead. A
 * single "PF penalty" tile would be provided for in full by whoever read it,
 * including the part sitting behind a waiver application — so there is no such
 * tile, and the gap between the two cards is deliberate rather than a layout
 * accident.
 *
 * The **member-share banner** sits above both. Where the twelve per cent was
 * deducted from wages and not remitted, the money was never the employer's. It
 * is not discharged by paying interest and it survives a full waiver of
 * damages, so it is drawn as a red banner rather than as a third number in the
 * row — a reader scanning three tiles would net it against the other two.
 *
 * The **slab column** on each default shows the days and the band those days
 * put the arrear in, because the band is the least intuitive part of the
 * computation: a month eleven days late and a month eight months late do not
 * average, and seeing 5% next to 25% on adjacent rows is the fastest way to
 * understand why.
 *
 * Open defaults sort to the top. A cleared default is a number to provide for;
 * an open one is still running, and the figure on the screen is out of date the
 * next morning.
 */

const COMPONENT_LABELS = {
  EMPLOYEE_SHARE: 'Member share (A/c 1)',
  EMPLOYER_SHARE: 'Employer share (A/c 1)',
  PENSION: 'Pension (A/c 10)',
  EDLI: 'EDLI (A/c 21)',
  ADMIN_CHARGES: 'Admin charges (A/c 2)',
};

const SLAB_LABELS = {
  UNDER_TWO_MONTHS: 'Under 2 months · 5%',
  TWO_TO_UNDER_FOUR_MONTHS: '2 to under 4 months · 10%',
  FOUR_TO_UNDER_SIX_MONTHS: '4 to under 6 months · 15%',
  SIX_MONTHS_AND_ABOVE: '6 months and above · 25%',
};

const SLAB_TONE = {
  UNDER_TWO_MONTHS:
    'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300',
  TWO_TO_UNDER_FOUR_MONTHS:
    'bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300',
  FOUR_TO_UNDER_SIX_MONTHS:
    'bg-rose-50 dark:bg-rose-900/20 text-rose-800 dark:text-rose-300',
  SIX_MONTHS_AND_ABOVE:
    'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
};

const FINDING_LABELS = {
  DEFAULT_OPEN: 'Still outstanding',
  DEFAULT_CLEARED_LATE: 'Remitted late',
  EMPLOYEE_SHARE_WITHHELD: 'Member share deducted and not remitted',
  DAMAGES_CAPPED: 'Damages capped at the arrears',
  WAIVER_PENDING: 'A paragraph 32B application is pending',
  WAIVER_GRANTED: 'Damages waived under paragraph 32B',
  GRACE_APPLIED: 'A grace period is configured',
  SECTION_7A_DETERMINATION: 'Determined under section 7A',
  NO_REMITTANCE_RECORDED: 'No remittance recorded at all',
  OVER_REMITTED: 'Remitted beyond what was due',
};

const SEVERITY_TONE = {
  BREACH: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
  EXPOSURE:
    'bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300',
  INFORMATIONAL:
    'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
};

const WAIVER_LABELS = {
  NONE: 'No application',
  APPLIED: 'Applied — pending',
  GRANTED_IN_PART: 'Granted in part',
  GRANTED: 'Granted',
  REFUSED: 'Refused',
};

const describeError = (error, fallback) => {
  const response = error?.response;
  if (!response) return 'Could not reach the server. Check your connection.';
  if (response.status === 403) {
    return 'You do not have permission to view the EPF remittance ledger.';
  }
  return response.data?.message || fallback;
};

const money = (value) => formatCurrency(Number(value) || 0);

/**
 * The two liabilities, drawn apart.
 *
 * A component rather than two blocks of markup so that adding a third card
 * summing them is a change somebody has to make on purpose.
 */
const LiabilityCard = ({ title, amount, statute, note, tone, footer }) => (
  <div
    className={`rounded-xl border p-5 ${tone} border-gray-200 dark:border-slate-700`}
  >
    <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
      {statute}
    </p>
    <h3 className="text-sm font-medium text-gray-700 dark:text-slate-200 mt-1">
      {title}
    </h3>
    <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-2 tabular-nums">
      {money(amount)}
    </p>
    <p className="text-xs text-gray-500 dark:text-slate-400 mt-2 leading-relaxed">
      {note}
    </p>
    {footer}
  </div>
);

/** One default line, with the band its delay put it in. */
const SlabBadge = ({ slab, days }) => {
  if (!slab)
    return <span className="text-gray-400 dark:text-slate-600">—</span>;

  return (
    <span
      className={`inline-flex flex-col gap-0.5 px-2 py-1 rounded text-[11px] ${
        SLAB_TONE[slab] || SLAB_TONE.UNDER_TWO_MONTHS
      }`}
    >
      <span className="font-medium">{SLAB_LABELS[slab] || slab}</span>
      <span className="opacity-75">{days} days late</span>
    </span>
  );
};

const currentMonthKey = () => {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
};

const EpfRemittanceLedger = () => {
  const [establishment, setEstablishment] = useState('');
  const [position, setPosition] = useState(null);
  const [waivers, setWaivers] = useState([]);
  const [assessments, setAssessments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);

  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const [positionRes, waiverRes, assessmentRes] = await Promise.all([
        api.get('/api/epf-remittance/position', { params: { establishment } }),
        api.get('/api/epf-remittance/waivers', { params: { establishment } }),
        api.get('/api/epf-remittance/assessments', {
          params: { establishment },
        }),
      ]);

      setPosition(positionRes.data || null);
      setWaivers(
        Array.isArray(waiverRes.data?.waivers) ? waiverRes.data.waivers : [],
      );
      setAssessments(
        Array.isArray(assessmentRes.data?.assessments)
          ? assessmentRes.data.assessments
          : [],
      );
    } catch (error) {
      setLoadError(
        describeError(error, 'Could not load the EPF remittance ledger.'),
      );
    } finally {
      setLoading(false);
    }
  }, [establishment]);

  useEffect(() => {
    load();
  }, [load]);

  const commit = async () => {
    setBusy(true);
    try {
      await api.post('/api/epf-remittance/assessments', { establishment });
      toast('Assessment committed.', 'success');
      await load();
    } catch (error) {
      toast(describeError(error, 'Could not commit the assessment.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const result = position?.result;

  /**
   * Open defaults first — those are still running and the figure on screen is
   * out of date by the next morning. Then by the size of the arrear.
   */
  const months = useMemo(() => {
    const rows = [...(result?.months || [])];

    const isOpen = (row) =>
      (row.components || []).some((component) => component.outstanding > 0);

    return rows.sort((a, b) => {
      if (isOpen(a) !== isOpen(b)) return isOpen(a) ? -1 : 1;
      return (b.arrears || 0) - (a.arrears || 0);
    });
  }, [result]);

  const heldInTrust = result?.heldInTrust || 0;
  const contingent = result?.damagesContingentOnWaiver || 0;

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-gray-200 dark:bg-slate-800 rounded" />
          <div className="h-32 bg-gray-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-64 bg-gray-200 dark:bg-slate-800 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            EPF remittance — sections 7Q and 14B
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-2xl">
            What each wage month owed, when it was paid, and what the delay
            costs. The contribution itself is decided by the ECR and is not
            recomputed here.
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
              placeholder="EPF code, or blank for the default"
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm w-64"
            />
          </label>

          <button
            type="button"
            onClick={commit}
            disabled={busy || !months.length}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-50"
          >
            {busy ? 'Committing…' : 'Commit assessment'}
          </button>
        </div>
      </header>

      {loadError && (
        <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {loadError}
        </div>
      )}

      {/*
        Above the two liability cards, not beside them. This money was never the
        employer's, it is not discharged by paying interest, and it survives a
        full waiver of damages — a reader scanning three tiles in a row would
        net it against the other two.
      */}
      {heldInTrust > 0 && (
        <div className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-5">
          <p className="text-xs uppercase tracking-wide text-red-700 dark:text-red-400">
            Deducted from wages and not remitted
          </p>
          <p className="text-2xl font-semibold text-red-800 dark:text-red-300 mt-1 tabular-nums">
            {money(heldInTrust)}
          </p>
          <p className="text-sm text-red-700 dark:text-red-300 mt-2 max-w-3xl leading-relaxed">
            The member&rsquo;s twelve per cent was taken out of wages and has
            not reached the fund. This is not a contribution in arrears — it was
            never the establishment&rsquo;s money. Paying the interest below
            does not discharge it, and a waiver of the damages below does not
            touch it.
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <LiabilityCard
          statute="Section 7Q"
          title="Interest on belated remittance"
          amount={result?.interestUnderSection7Q}
          tone="bg-white dark:bg-slate-900"
          note="Simple interest at twelve per cent per annum on each arrear for the days it was outstanding. No authority under the Act can waive it, so this is a provision in every case."
        />

        <LiabilityCard
          statute="Section 14B"
          title="Damages under the paragraph 32A slabs"
          amount={result?.damagesPayableUnderSection14B}
          tone="bg-white dark:bg-slate-900"
          note="Graded by the length of each default, from five per cent under two months to twenty-five at six and above, capped at the arrears themselves."
          footer={
            <div className="mt-3 space-y-1 text-xs">
              {result?.damagesAssessedUnderSection14B !==
                result?.damagesPayableUnderSection14B && (
                <p className="text-gray-500 dark:text-slate-400">
                  Assessed before waiver:{' '}
                  <span className="tabular-nums">
                    {money(result?.damagesAssessedUnderSection14B)}
                  </span>
                </p>
              )}
              {contingent > 0 && (
                <p className="text-amber-700 dark:text-amber-400">
                  {money(contingent)} sits behind a pending paragraph 32B
                  application — payable, and disclosable as contingent.
                </p>
              )}
            </div>
          }
        />
      </div>

      {/*
        Said in words because the layout alone cannot say it: there is no third
        card, and the absence is the point.
      */}
      <p className="text-xs text-gray-500 dark:text-slate-400 max-w-3xl">
        These two figures are not added anywhere in this product. Interest under
        section 7Q cannot be waived by anyone; damages under section 14B can be
        waived to nil by the Board under paragraph 32B. A combined number would
        be provided for in full by whoever read it.
      </p>

      <section className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-800">
          <h2 className="text-sm font-medium text-gray-900 dark:text-white">
            Wage months
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Open defaults first. Arrears are shown per account because a challan
            can clear A/c 1 and leave A/c 10 short.
          </p>
        </div>

        {months.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-500 dark:text-slate-400">
            No wage months on the ledger yet. Nothing here is a nil liability —
            it is an empty ledger, which is a different thing.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-800/50 text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
                <tr>
                  <th className="text-left px-5 py-2">Wage month</th>
                  <th className="text-left px-5 py-2">Account</th>
                  <th className="text-right px-5 py-2">Due</th>
                  <th className="text-right px-5 py-2">Outstanding</th>
                  <th className="text-left px-5 py-2">Band</th>
                  <th className="text-right px-5 py-2">7Q interest</th>
                  <th className="text-right px-5 py-2">14B damages</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {months.flatMap((month) =>
                  (month.components || []).map((component, index) => (
                    <tr
                      key={`${month.key}-${component.component}`}
                      className={
                        component.outstanding > 0
                          ? 'bg-red-50/40 dark:bg-red-900/10'
                          : undefined
                      }
                    >
                      {index === 0 ? (
                        <td
                          className="px-5 py-3 align-top"
                          rowSpan={month.components.length}
                        >
                          <p className="font-medium text-gray-900 dark:text-white">
                            {month.key}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-slate-400">
                            Due {formatDate(month.dueDate)}
                          </p>
                          {month.basis === 'SECTION_7A' && (
                            <p className="text-[11px] text-orange-700 dark:text-orange-400 mt-1">
                              Determined under section 7A — runs from the
                              original due date
                            </p>
                          )}
                          {month.waiver?.state &&
                            month.waiver.state !== 'NONE' && (
                              <p className="text-[11px] text-blue-700 dark:text-blue-400 mt-1">
                                {WAIVER_LABELS[month.waiver.state]}
                              </p>
                            )}
                        </td>
                      ) : null}

                      <td className="px-5 py-3 text-gray-700 dark:text-slate-300">
                        {COMPONENT_LABELS[component.component] ||
                          component.component}
                        {component.heldInTrust && (
                          <span className="ml-2 text-[11px] text-red-700 dark:text-red-400">
                            held in trust
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3 text-right tabular-nums text-gray-700 dark:text-slate-300">
                        {money(component.amountDue)}
                      </td>

                      <td className="px-5 py-3 text-right tabular-nums">
                        {component.outstanding > 0 ? (
                          <span className="text-red-700 dark:text-red-400 font-medium">
                            {money(component.outstanding)}
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-slate-600">
                            cleared
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3">
                        <SlabBadge
                          slab={component.slab}
                          days={component.maxDelayDays}
                        />
                      </td>

                      <td className="px-5 py-3 text-right tabular-nums text-gray-700 dark:text-slate-300">
                        {money(component.interest?.amount)}
                      </td>

                      <td className="px-5 py-3 text-right tabular-nums text-gray-700 dark:text-slate-300">
                        {money(component.damages?.amount)}
                        {component.damages?.cappedFrom != null && (
                          <span className="block text-[11px] text-gray-400 dark:text-slate-600">
                            capped from {money(component.damages.cappedFrom)}
                          </span>
                        )}
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        )}
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
                <span className="tabular-nums">
                  {row.count} {row.count === 1 ? 'occurrence' : 'occurrences'}
                  {row.amount > 0 && ` · ${money(row.amount)}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
          <h2 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Paragraph 32B waivers
          </h2>
          {waivers.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-slate-400">
              No applications recorded.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {waivers.map((waiver) => (
                <li
                  key={waiver._id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 dark:border-slate-800 pb-2 last:border-0"
                >
                  <span className="text-gray-700 dark:text-slate-300">
                    {waiver.fromYear}-
                    {String(waiver.fromMonth).padStart(2, '0')} to{' '}
                    {waiver.toYear}-{String(waiver.toMonth).padStart(2, '0')}
                    {waiver.orderReference && (
                      <span className="text-gray-400 dark:text-slate-600">
                        {' '}
                        · {waiver.orderReference}
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-slate-400">
                    {WAIVER_LABELS[waiver.state] || waiver.state}
                    {waiver.state === 'GRANTED_IN_PART' &&
                      ` · ${waiver.waivedPercent}% waived`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-3">
            A waiver reaches the damages only. Section 7Q interest is unaffected
            by any of these.
          </p>
        </section>

        <section className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
          <h2 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Committed assessments
          </h2>
          {assessments.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Nothing committed yet.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {assessments.map((assessment) => (
                <li
                  key={assessment._id}
                  className="border-b border-gray-100 dark:border-slate-800 pb-2 last:border-0"
                >
                  <p className="text-gray-700 dark:text-slate-300">
                    As at {formatDate(assessment.asAt)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 tabular-nums">
                    7Q {money(assessment.interestUnderSection7Q)} · 14B{' '}
                    {money(assessment.damagesPayableUnderSection14B)}
                    {assessment.heldInTrust > 0 && (
                      <span className="text-red-700 dark:text-red-400">
                        {' '}
                        · held in trust {money(assessment.heldInTrust)}
                      </span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="text-xs text-gray-400 dark:text-slate-600">
        Position as at {formatDate(result?.asAt || currentMonthKey())}. Open
        defaults continue to run — the interest above is out of date tomorrow.
      </p>
    </div>
  );
};

export default EpfRemittanceLedger;
