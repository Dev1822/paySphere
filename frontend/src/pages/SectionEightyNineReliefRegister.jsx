import { useCallback, useEffect, useMemo, useState } from 'react';

import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatDate } from '../utils/formatLocale';

/**
 * Section 89(1) relief on salary arrears (#1969).
 *
 * The page leads with **the relief and the authority to give it as two
 * numbers**, because they are two answers. A relief of ₹40,000 that cannot yet
 * be applied is not a relief of nil, and a screen that showed one figure would
 * either tell the employee they have nothing to claim or tell the employer they
 * may reduce a deduction they may not. Both numbers are on the header, and the
 * gap between them is labelled with what would close it.
 *
 * **The four terms of Rule 21A(2) are shown, not just their result.** The
 * employee signs a return carrying this number and defends it personally. A
 * relief that cannot be broken back into the tax on the year of receipt with
 * and without the arrear, and the additional tax each relation year would have
 * borne, cannot be checked by the person who bears the consequence.
 *
 * **A relation year the module could not price is drawn as a gap, never as a
 * zero.** A zero in the "additional tax" column is a claim — it says the year
 * would have borne no extra tax — and a missing rate table has made no such
 * claim. Those rows carry their reason and are counted in the header, because a
 * relief computed over a subset of the years it relates to is not a smaller
 * relief but a wrong one.
 *
 * **Section 192(2A) is rendered, not assumed.** The condition sits directly
 * under the relief figure, where somebody about to act on the figure will read
 * it, and it names whose money is at risk. A payroll that reduces the deduction
 * without Form 10E has short-deducted, and the section 201(1A) interest is the
 * employer's rather than the employee's.
 */

const GAP_LABELS = {
  NO_RATE_TABLE: 'No rate table for this year',
  NO_ASSESSED_INCOME: 'No assessed income recorded',
  REGIME_NOT_RECORDED: 'No regime recorded',
};

const FINDING_LABELS = {
  FORM_10E_NOT_FURNISHED: 'Form 10E has not been furnished',
  FORM_10E_FURNISHED_AFTER_RETURN: 'Form 10E followed the return',
  RATE_TABLE_MISSING: 'The year of receipt has no rate table',
  RELATION_YEAR_INCOMPLETE: 'A relation year could not be priced',
  NO_RELIEF_ARISES: 'No relief arises',
  RELIEF_AVAILABLE_NOT_APPLIED: 'Relief available and not yet given',
  REGIME_CHANGED_ACROSS_YEARS: 'The regime changed across the years',
  ALLOCATION_DOES_NOT_RECONCILE: 'The spread does not add back to the arrear',
};

const SEVERITY_TONE = {
  BREACH: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
  DUE: 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300',
  INFORMATIONAL:
    'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
};

const REGIME_LABELS = {
  OLD: 'Old regime',
  NEW: 'Section 115BAC',
};

const describeError = (error, fallback) => {
  const response = error?.response;
  if (!response) return 'Could not reach the server. Check your connection.';
  if (response.status === 403) {
    return 'You do not have permission to view the section 89(1) register.';
  }
  return response.data?.message || fallback;
};

const rupees = (value) =>
  value === null || value === undefined
    ? '—'
    : `₹${Number(value).toLocaleString('en-IN')}`;

/**
 * One term of Rule 21A(2), with its label.
 *
 * Drawn as a labelled figure rather than as a table cell so the terms read as a
 * derivation rather than as data — the reader is meant to follow the
 * subtraction, not scan for a value.
 */
const Term = ({ label, value, tone = '' }) => (
  <div>
    <div className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-slate-500">
      {label}
    </div>
    <div
      className={`text-sm font-medium ${tone || 'text-gray-900 dark:text-white'}`}
    >
      {rupees(value)}
    </div>
  </div>
);

/**
 * The relation-year row.
 *
 * A gap is rendered with its reason in the cell where the figure would be. It
 * is deliberately not a dash: a dash reads as nil and nil is a claim.
 */
const RelationYearRow = ({ year }) => (
  <tr className="border-t border-gray-100 dark:border-slate-800">
    <td className="py-2 pr-4 text-gray-900 dark:text-white">{year.label}</td>
    <td className="py-2 pr-4 text-gray-500 dark:text-slate-400">
      {REGIME_LABELS[year.regime] || '—'}
    </td>
    <td className="py-2 pr-4 text-right">{rupees(year.arrearShare)}</td>
    <td className="py-2 pr-4 text-right">{rupees(year.assessedIncome)}</td>
    <td className="py-2 pr-4 text-right">{rupees(year.taxWithout)}</td>
    <td className="py-2 pr-4 text-right">{rupees(year.taxWith)}</td>
    <td className="py-2 text-right">
      {year.gap ? (
        <span
          className="text-[11px] px-2 py-1 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300"
          title={year.reason}
        >
          {GAP_LABELS[year.gap] || year.gap}
        </span>
      ) : (
        <span className="font-medium">{rupees(year.additionalTax)}</span>
      )}
    </td>
  </tr>
);

const SectionEightyNineReliefRegister = () => {
  const [employeeId, setEmployeeId] = useState('');

  const [position, setPosition] = useState(null);
  const [rules, setRules] = useState(null);
  const [rateTables, setRateTables] = useState([]);

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const { toast } = useToast();

  const load = useCallback(async () => {
    if (!employeeId) {
      setPosition(null);
      return;
    }

    setLoading(true);
    setLoadError('');

    try {
      const [positionRes, rulesRes, tablesRes] = await Promise.all([
        api.get('/api/section-89-relief/position', { params: { employeeId } }),
        api.get('/api/section-89-relief/rules'),
        api.get('/api/section-89-relief/rate-tables'),
      ]);

      setPosition(positionRes.data || null);
      setRules(rulesRes.data || null);
      setRateTables(
        Array.isArray(tablesRes.data?.tables) ? tablesRes.data.tables : [],
      );
    } catch (error) {
      setLoadError(
        describeError(error, 'Could not load the section 89(1) register.'),
      );
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    load();
  }, [load]);

  const applyRelief = async (claimId) => {
    try {
      await api.patch(`/api/section-89-relief/claims/${claimId}/apply`);
      toast('Relief given in the TDS computation.', 'success');
      load();
    } catch (error) {
      // A 409 here is the section 192(2A) refusal, and its message is the
      // reason. Surfacing the server's own words rather than a generic failure
      // is the point: the user needs to know what would let them proceed.
      toast(describeError(error, 'Could not give the relief.'), 'error');
    }
  };

  const result = position?.result;

  /**
   * Assessments ordered by what needs doing: the ones blocked on Form 10E
   * first, then the ones ready to be given, then the settled ones.
   */
  const assessments = useMemo(() => {
    const rows = result?.assessments || [];

    const rank = (row) => {
      if (row.relief?.gap) return 0;
      if (row.reliefComputed > 0 && !row.authority?.mayApply) return 1;
      if (row.reliefComputed > 0 && row.reliefApplicable > 0) return 2;
      return 3;
    };

    return [...rows].sort((a, b) => rank(a) - rank(b));
  }, [result]);

  const coveredYears = position?.assessmentYearsCovered || [];

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            Section 89(1) relief
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-2xl">
            Where salary is paid in arrears, the bunching can tax an employee at
            a rate their real position never reached. The relief is the
            difference between the tax on the year of receipt and the tax each
            relation year <strong>would have borne at its own rates</strong>.
          </p>
        </div>

        <label className="text-sm">
          <span className="block text-gray-500 dark:text-slate-400 mb-1">
            Employee
          </span>
          <input
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value.trim())}
            placeholder="Employee id"
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm w-72"
          />
        </label>
      </header>

      {loadError && (
        <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {loadError}
        </div>
      )}

      {loading && (
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-72 bg-gray-200 dark:bg-slate-800 rounded" />
          <div className="h-48 bg-gray-200 dark:bg-slate-800 rounded-xl" />
        </div>
      )}

      {!loading && !employeeId && (
        <div className="rounded-xl border border-gray-200 dark:border-slate-800 px-4 py-8 text-center text-sm text-gray-500 dark:text-slate-400">
          Enter an employee to see the arrears they have received and the relief
          each one earns.
        </div>
      )}

      {!loading && result && (
        <>
          {/* The two numbers. See the header comment — they are two answers. */}
          <section className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 dark:border-slate-800 p-4">
              <div className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-slate-500">
                Relief computed
              </div>
              <div className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">
                {rupees(result.totalReliefComputed)}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-slate-800 p-4">
              <div className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-slate-500">
                Relief the employer may give
              </div>
              <div className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">
                {rupees(result.totalReliefApplicable)}
              </div>
              {result.totalReliefComputed > result.totalReliefApplicable && (
                <div className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
                  The difference is waiting on Form 10E.
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-slate-800 p-4">
              <div className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-slate-500">
                Findings
              </div>
              <div className="flex gap-2 mt-2 flex-wrap">
                {Object.entries(result.severityCounts || {}).map(
                  ([severity, count]) =>
                    count > 0 ? (
                      <span
                        key={severity}
                        className={`text-[11px] px-2 py-1 rounded ${SEVERITY_TONE[severity]}`}
                      >
                        {count} {severity.toLowerCase()}
                      </span>
                    ) : null,
                )}
              </div>
            </div>
          </section>

          {/* Section 192(2A), where somebody acting on the figure will read it. */}
          <p className="text-xs text-gray-500 dark:text-slate-400 border-l-2 border-gray-200 dark:border-slate-700 pl-3">
            {result.conditional}
          </p>

          {result.receiptYearsWithMoreThanOneArrear?.length > 0 && (
            <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 text-sm text-blue-800 dark:text-blue-300">
              More than one arrear was received in{' '}
              {result.receiptYearsWithMoreThanOneArrear.join(', ')}. Two arrears
              paid in one year are one bunching — the reliefs above are computed
              separately and should not simply be added.
            </div>
          )}

          <section className="space-y-4">
            {assessments.map((assessment, index) => (
              <article
                key={assessment.arrear.id || index}
                className="rounded-xl border border-gray-200 dark:border-slate-800 p-4 space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                      {rupees(assessment.arrear.amount)} received{' '}
                      {formatDate(assessment.arrear.paidOn)}
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                      Relating to {formatDate(assessment.arrear.relatesFrom)} —{' '}
                      {formatDate(assessment.arrear.relatesTo)} · year of
                      receipt {assessment.arrear.receiptLabel}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-slate-500">
                        Relief
                      </div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-white">
                        {assessment.relief?.gap
                          ? '—'
                          : rupees(assessment.reliefComputed)}
                      </div>
                    </div>

                    {assessment.reliefComputed > 0 &&
                      assessment.authority?.mayApply && (
                        <button
                          type="button"
                          onClick={() => applyRelief(assessment.arrear.id)}
                          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium"
                        >
                          Give in TDS
                        </button>
                      )}
                  </div>
                </div>

                {/* The four terms. See the header comment. */}
                {!assessment.relief?.gap && (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 rounded-lg bg-gray-50 dark:bg-slate-900/60 p-3">
                    <Term
                      label="Tax including the arrears"
                      value={assessment.relief.taxIncludingArrears}
                    />
                    <Term
                      label="Tax excluding the arrears"
                      value={assessment.relief.taxExcludingArrears}
                    />
                    <Term
                      label="Tax on the bunching"
                      value={assessment.relief.taxOnBunching}
                    />
                    <Term
                      label="Additional tax across the relation years"
                      value={assessment.relief.relationYearAdditionalTax}
                    />
                  </div>
                )}

                {assessment.relief?.incompleteRelationYears > 0 && (
                  <div className="text-xs text-amber-800 dark:text-amber-300">
                    {assessment.relief.incompleteRelationYears} relation year(s)
                    could not be priced. The relief above is computed over the
                    rest, which makes it wrong rather than smaller.
                  </div>
                )}

                {assessment.relief?.relationYears?.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 dark:text-slate-500">
                          <th className="pb-2 pr-4">Year</th>
                          <th className="pb-2 pr-4">Regime</th>
                          <th className="pb-2 pr-4 text-right">Share</th>
                          <th className="pb-2 pr-4 text-right">Assessed</th>
                          <th className="pb-2 pr-4 text-right">Tax</th>
                          <th className="pb-2 pr-4 text-right">
                            Tax as increased
                          </th>
                          <th className="pb-2 text-right">Additional</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assessment.relief.relationYears.map((year) => (
                          <RelationYearRow
                            key={year.financialYear}
                            year={year}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {assessment.findings?.length > 0 && (
                  <ul className="space-y-2">
                    {assessment.findings.map((finding, findingIndex) => (
                      <li
                        key={findingIndex}
                        className="flex items-start gap-3 text-xs"
                      >
                        <span
                          className={`px-2 py-1 rounded shrink-0 ${SEVERITY_TONE[finding.severity]}`}
                        >
                          {FINDING_LABELS[finding.code] || finding.code}
                        </span>
                        <span className="text-gray-500 dark:text-slate-400">
                          {finding.detail}{' '}
                          <span className="text-gray-400 dark:text-slate-600">
                            ({finding.authority})
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}

            {assessments.length === 0 && (
              <div className="rounded-xl border border-gray-200 dark:border-slate-800 px-4 py-8 text-center text-sm text-gray-500 dark:text-slate-400">
                No arrears recorded for this employee.
              </div>
            )}
          </section>

          {/*
            The rate tables are shown because their absence is the most common
            reason a relief cannot be computed, and a gap is only actionable if
            you can see which year is missing.
          */}
          <section className="rounded-xl border border-gray-200 dark:border-slate-800 p-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Rate tables on file
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
              A relation year with no table here is refused rather than priced
              at this year&rsquo;s rates.
            </p>

            <div className="flex flex-wrap gap-2 mt-3">
              {coveredYears.map((year) => (
                <span
                  key={year}
                  className="text-[11px] px-2 py-1 rounded bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300"
                >
                  AY {year}-{String((year + 1) % 100).padStart(2, '0')}
                </span>
              ))}
              {coveredYears.length === 0 && (
                <span className="text-xs text-amber-800 dark:text-amber-300">
                  None. No relief can be computed until at least the year of
                  receipt and each relation year has a table.
                </span>
              )}
            </div>

            {rateTables.length > 0 && (
              <div className="text-xs text-gray-400 dark:text-slate-600 mt-3">
                {rateTables.length} table(s) across{' '}
                {new Set(rateTables.map((table) => table.regime)).size}{' '}
                regime(s).
                {rules?.rules?.rule
                  ? ` Computed under ${rules.rules.rule}.`
                  : ''}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default SectionEightyNineReliefRegister;
