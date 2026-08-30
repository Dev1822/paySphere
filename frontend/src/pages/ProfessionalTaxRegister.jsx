import { useCallback, useEffect, useMemo, useState } from 'react';

import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDate } from '../utils/formatLocale';

/**
 * Professional tax — Article 276 and the state enactments (#1876).
 *
 * The page is organised **by registration certificate**, not by employee and
 * not by one national total. The state that applies is the state of the place
 * of work, so a company with offices in two states holds two certificates,
 * remits to two authorities on two schedules, and there is no combined figure
 * anybody can pay. Drawing one total at the top would be a number with no
 * challan behind it.
 *
 * Each state card carries **two amounts that are never added**: what was
 * deducted from employees under the registration certificate, and the
 * employer's own annual liability under the enrolment certificate. The second
 * is the company's tax on the trade it carries on and is owed whether or not a
 * single employee crosses a slab; the product has never had a concept of it,
 * which is exactly why it is drawn beside the deduction rather than folded into
 * it.
 *
 * Half-yearly states are drawn **as half-years**. Tamil Nadu and Kerala levy on
 * the aggregate of six months, and showing twelve monthly rows for them would
 * imply a monthly slab that does not exist — a reader would then reconcile
 * against a monthly figure and find it does not tie.
 *
 * The **accrued/paid pair** at the bottom is the section 16(iii) hand-off.
 * Professional tax actually paid is deductible from salary income; professional
 * tax deducted and not yet remitted is not. They are shown as two numbers with
 * the gap named, because it is the gap that flows into TDS.
 */

const PERIODICITY_LABELS = {
  MONTHLY: 'Monthly',
  HALF_YEARLY: 'Half-yearly',
  ANNUAL: 'Annual',
  NOT_LEVIED: 'Not levied',
};

const FINDING_LABELS = {
  NOT_LEVIED_IN_STATE: 'This state does not levy professional tax',
  WORK_STATE_MISSING: 'No work state recorded',
  NO_RULE_FOR_STATE: 'No slab table for this state',
  RULE_PREDATES_PERIOD: 'The rule in force predates this period',
  ANNUAL_CEILING_APPLIED: 'Capped at the Article 276 ceiling',
  HALF_YEARLY_ATTRIBUTED: 'A half-yearly liability attributed across months',
  PERSON_EXEMPT: 'Exempt under the state enactment',
  DEDUCTED_NOT_REMITTED: 'Deducted and not yet remitted',
  LOCAL_BODY_NOT_SET: 'No local body recorded',
  ENROLMENT_NOT_RECORDED: 'No enrolment certificate recorded',
  DEDUCTION_DISAGREES_WITH_PAYROLL:
    'The computed deduction disagrees with the payroll line',
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
    return 'You do not have permission to view the professional tax register.';
  }
  return response.data?.message || fallback;
};

const money = (value) => formatCurrency(Number(value) || 0);

const currentFinancialYear = () => {
  const now = new Date();
  return now.getUTCMonth() + 1 >= 4
    ? now.getUTCFullYear()
    : now.getUTCFullYear() - 1;
};

/**
 * One registration certificate.
 *
 * The two amounts sit in separate rows with their certificates named, so that
 * a reader cannot take them as parts of one figure. They are remitted under
 * different certificates, on different schedules, and one of them is not
 * deducted from anybody.
 */
const StateCard = ({ registration }) => (
  <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          {registration.state}
        </h3>
        <p className="text-xs text-gray-500 dark:text-slate-400">
          {PERIODICITY_LABELS[registration.periodicity] ||
            registration.periodicity}
          {registration.levyLevel === 'LOCAL_BODY' && ' · levied by local body'}
          {' · '}
          {registration.employeeCount}{' '}
          {registration.employeeCount === 1 ? 'employee' : 'employees'}
        </p>
      </div>

      {!registration.enrolled && (
        <span className="text-[11px] px-2 py-1 rounded bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300">
          No enrolment certificate
        </span>
      )}
    </div>

    <dl className="mt-4 space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-sm text-gray-600 dark:text-slate-300">
          Deducted from employees
          <span className="block text-[11px] text-gray-400 dark:text-slate-600">
            Registration certificate
          </span>
        </dt>
        <dd className="text-lg font-semibold text-gray-900 dark:text-white tabular-nums">
          {money(registration.deductedFromEmployees)}
        </dd>
      </div>

      <div className="flex items-baseline justify-between gap-3 pt-3 border-t border-dashed border-gray-200 dark:border-slate-700">
        <dt className="text-sm text-gray-600 dark:text-slate-300">
          Employer&rsquo;s own liability
          <span className="block text-[11px] text-gray-400 dark:text-slate-600">
            Enrolment certificate · deducted from nobody
          </span>
        </dt>
        <dd className="text-lg font-semibold text-gray-900 dark:text-white tabular-nums">
          {money(registration.employerEnrolmentLiability)}
        </dd>
      </div>
    </dl>

    <p className="text-[11px] text-gray-400 dark:text-slate-600 mt-3">
      Two certificates, two returns. These figures are remitted separately and
      are not added here.
    </p>
  </div>
);

const ProfessionalTaxRegister = () => {
  const [financialYear, setFinancialYear] = useState(currentFinancialYear());

  const [assessment, setAssessment] = useState(null);
  const [rules, setRules] = useState(null);
  const [history, setHistory] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);

  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const [assessmentRes, rulesRes, historyRes] = await Promise.all([
        api.get('/api/professional-tax/assessment', {
          params: { financialYear },
        }),
        api.get('/api/professional-tax/rules'),
        api.get('/api/professional-tax/assessments'),
      ]);

      setAssessment(assessmentRes.data || null);
      setRules(rulesRes.data || null);
      setHistory(
        Array.isArray(historyRes.data?.assessments)
          ? historyRes.data.assessments
          : [],
      );
    } catch (error) {
      setLoadError(
        describeError(error, 'Could not load the professional tax register.'),
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
      await api.post('/api/professional-tax/assessments', { financialYear });
      toast('Assessment committed.', 'success');
      await load();
    } catch (error) {
      toast(describeError(error, 'Could not commit the assessment.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const result = assessment?.result;

  /** Employees with a problem first — those need an answer, not a look. */
  const employees = useMemo(() => {
    const rows = [...(result?.employees || [])];

    return rows.sort((a, b) => {
      const aIssues = (a.issues || []).length > 0 ? 0 : 1;
      const bIssues = (b.issues || []).length > 0 ? 0 : 1;
      if (aIssues !== bIssues) return aIssues - bIssues;
      return (b.accrued || 0) - (a.accrued || 0);
    });
  }, [result]);

  const gap = Math.max(
    0,
    (result?.accrued || 0) - (result?.paidForSection16iii || 0),
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-72 bg-gray-200 dark:bg-slate-800 rounded" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-40 bg-gray-200 dark:bg-slate-800 rounded-xl" />
            <div className="h-40 bg-gray-200 dark:bg-slate-800 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            Professional tax
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-2xl">
            Computed from the state slab in force at the place of work, not read
            back from a deduction line. Article 276 caps the year at{' '}
            {money(rules?.annualCeiling || 2500)} per person across every state
            they worked in.
          </p>
        </div>

        <div className="flex items-end gap-3">
          <label className="text-sm">
            <span className="block text-gray-500 dark:text-slate-400 mb-1">
              Financial year
            </span>
            <input
              type="number"
              value={financialYear}
              onChange={(event) =>
                setFinancialYear(Number(event.target.value) || financialYear)
              }
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm w-32"
            />
          </label>

          <button
            type="button"
            onClick={commit}
            disabled={busy || !employees.length}
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

      <section>
        <h2 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
          Registration certificates
        </h2>

        {(result?.registrations || []).length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">
            No state is levying for this year. That is either because nobody has
            a work state recorded, or because every work state on record does
            not levy — the findings below say which.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {result.registrations.map((registration) => (
              <StateCard key={registration.state} registration={registration} />
            ))}
          </div>
        )}

        <p className="text-xs text-gray-500 dark:text-slate-400 mt-3 max-w-3xl">
          One card per certificate, and no total across them. Each state is
          remitted to its own authority on its own schedule — a combined figure
          would not correspond to any challan.
        </p>
      </section>

      <section className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-800">
          <h2 className="text-sm font-medium text-gray-900 dark:text-white">
            Employees
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Half-yearly states are shown as half-years. Tamil Nadu and Kerala
            levy on the aggregate of six months, and a monthly row for them
            would imply a slab that does not exist.
          </p>
        </div>

        {employees.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-500 dark:text-slate-400">
            No employee has a work state recorded. Professional tax follows the
            place of work, and it is not inferred from the address — for anyone
            working away from where they live the address gives the wrong state
            while the deduction still looks reasonable.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-800/50 text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
                <tr>
                  <th className="text-left px-5 py-2">Employee</th>
                  <th className="text-left px-5 py-2">Work state</th>
                  <th className="text-left px-5 py-2">Periodicity</th>
                  <th className="text-right px-5 py-2">Year</th>
                  <th className="text-left px-5 py-2">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {employees.map((employee) => (
                  <tr key={String(employee.employeeId || employee.name)}>
                    <td className="px-5 py-3 text-gray-900 dark:text-white">
                      {employee.name || '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-700 dark:text-slate-300">
                      {employee.workState || (
                        <span className="text-red-700 dark:text-red-400">
                          not recorded
                        </span>
                      )}
                      {employee.localBody && (
                        <span className="block text-[11px] text-gray-400 dark:text-slate-600">
                          {employee.localBody}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-700 dark:text-slate-300">
                      {PERIODICITY_LABELS[employee.periodicity] || '—'}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-gray-900 dark:text-white">
                      {money(employee.accrued)}
                      {employee.ceilingApplied && (
                        <span className="block text-[11px] text-blue-700 dark:text-blue-400">
                          capped from {money(employee.accruedBeforeCeiling)}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(employee.issues || []).map((issue) => (
                          <span
                            key={`${employee.employeeId}-${issue.code}`}
                            className="text-[11px] px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300"
                          >
                            {FINDING_LABELS[issue.code] || issue.code}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/*
        The section 16(iii) hand-off. Two numbers with the gap named, because
        it is the gap that reaches TDS.
      */}
      <section className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
        <h2 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
          Section 16(iii)
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Deducted from employees over the year
            </p>
            <p className="text-xl font-semibold text-gray-900 dark:text-white tabular-nums">
              {money(result?.accrued)}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Actually paid to the state — allowable
            </p>
            <p className="text-xl font-semibold text-gray-900 dark:text-white tabular-nums">
              {money(result?.paidForSection16iii)}
            </p>
          </div>
        </div>

        {gap > 0 && (
          <p className="mt-3 text-sm text-orange-800 dark:text-orange-300">
            {money(gap)} was deducted and has not reached the state. Section
            16(iii) allows professional tax <em>actually paid</em>, so this
            amount is not allowable to the employee this year whatever their
            payslip shows — and the difference lands in Form 24Q rather than
            here.
          </p>
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
                  <span className="opacity-70"> · {row.authority}</span>
                </span>
                <span className="tabular-nums">
                  {row.count} {row.count === 1 ? 'occurrence' : 'occurrences'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
        <h2 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
          Committed years
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Nothing committed yet.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {history.map((row) => (
              <li
                key={row._id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 dark:border-slate-800 pb-2 last:border-0"
              >
                <span className="text-gray-700 dark:text-slate-300">
                  FY {row.financialYear}-
                  {String((row.financialYear + 1) % 100).padStart(2, '0')}
                  <span className="text-gray-400 dark:text-slate-600">
                    {' '}
                    · {row.registrations?.length || 0} certificates
                  </span>
                </span>
                <span className="text-xs text-gray-500 dark:text-slate-400 tabular-nums">
                  accrued {money(row.accrued)} · paid{' '}
                  {money(row.paidForSection16iii)} ·{' '}
                  {formatDate(row.updatedAt || row.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default ProfessionalTaxRegister;
