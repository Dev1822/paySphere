import { useCallback, useEffect, useMemo, useState } from 'react';

import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDate } from '../utils/formatLocale';

/**
 * Employees' State Insurance Act, 1948 (#1768).
 *
 * The page is organised around the contribution period rather than the month,
 * because that is the unit the Act reasons in and a month-shaped page cannot
 * show the two facts that matter: who is being carried above the ceiling by the
 * Rule 50 proviso, and how the 78-day counts stand with the period part-filled.
 *
 * Employees being continued get their own band at the top rather than a badge in
 * the table. They are the ones a payroll will drop and the Act will not, they
 * are contributing on wages above the ceiling, and there are usually two or
 * three of them in a list of four hundred.
 *
 * Each row shows both wages. One figure would be a lie in one direction or the
 * other: the coverage test excludes overtime and the contribution base includes
 * it, so an employee on ₹20,000 with ₹2,000 of overtime is tested at ₹20,000 and
 * contributed on ₹22,000, and showing either alone makes the other look wrong.
 */

const FINDING_LABELS = {
  CEILING_CROSSED_MID_PERIOD:
    'Crossed the ceiling mid-period — carried to the end of it',
  CONTRIBUTION_BASE_CAPPED: 'The contribution base was capped',
  EMPLOYEE_EXEMPT_EMPLOYER_LIABLE:
    'Below the daily floor — employee exempt, employer still liable',
  BELOW_QUALIFYING_DAYS: 'Short of the 78 days needed for sickness benefit',
  LATE_REMITTANCE: 'Remitted after the fifteenth',
  NOT_APPLICABLE: 'Below the ten-employee threshold',
  DISABLED_EMPLOYER_EXEMPT: "Employer's share exempt for three years",
};

const STATUS_LABELS = {
  COVERED: 'Covered',
  CONTINUED: 'Continued — Rule 50',
  EXCLUDED: 'Above the ceiling',
  NOT_EMPLOYED: 'Not employed',
};

const STATUS_TONE = {
  COVERED:
    'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
  CONTINUED:
    'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300',
  EXCLUDED: 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400',
  NOT_EMPLOYED:
    'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-600',
};

const SEVERITY_TONE = {
  BREACH: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
  ADJUSTED:
    'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300',
  INFORMATIONAL:
    'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
};

const RULE_FIELDS = [
  ['wageCeiling', 'Wage ceiling', 'Rule 50'],
  ['disabledWageCeiling', 'Ceiling, disability', 'Rule 50, proviso'],
  ['employeeRatePercent', "Employee's share, %", 'Regulation 51'],
  ['employerRatePercent', "Employer's share, %", 'Regulation 51'],
  ['dailyWageFloor', 'Daily wage floor', 'Section 42(1)'],
  ['benefitQualifyingDays', 'Days for sickness benefit', 'Regulation 52A'],
  ['employedHeadcount', 'Persons employed', 'Section 2(12)'],
  ['dueDayOfMonth', 'Due on the', 'Regulation 31'],
];

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
    return 'You do not have permission to view the ESI register.';
  }
  return response.data?.message || fallback;
};

const EsiContribution = () => {
  const now = new Date();

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [assessment, setAssessment] = useState(null);
  const [rules, setRules] = useState(null);
  const [draft, setDraft] = useState(null);
  const [returns, setReturns] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [showRules, setShowRules] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);

  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const [assessmentRes, returnsRes] = await Promise.all([
        api.get('/api/esi/assessment', { params: { month, year } }),
        api.get('/api/esi/returns'),
      ]);

      setAssessment(assessmentRes.data || null);
      setRules(assessmentRes.data?.rules || null);
      setDraft(assessmentRes.data?.rules || null);
      setReturns(
        Array.isArray(returnsRes.data?.returns) ? returnsRes.data.returns : [],
      );
    } catch (error) {
      setLoadError(describeError(error, 'Could not load the ESI register.'));
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    load();
  }, [load]);

  const fileReturn = async () => {
    setBusy(true);
    try {
      await api.post('/api/esi/returns', { month, year });
      toast('Return filed and coverage state recorded.', 'success');
      await load();
    } catch (error) {
      toast(describeError(error, 'Could not file the return.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveRules = async (event) => {
    event.preventDefault();
    setBusy(true);

    try {
      await api.put('/api/esi/rules', draft);
      toast('Rules saved.', 'success');
      setShowRules(false);
      await load();
    } catch (error) {
      toast(describeError(error, 'Could not save the rules.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const setDraftField = (key) => (event) =>
    setDraft((previous) => ({
      ...previous,
      [key]: Number(event.target.value),
    }));

  const result = assessment?.result;

  /** This month's row out of each employee's whole-period walk. */
  const rows = useMemo(() => {
    const employees = result?.employees || [];

    return employees
      .map((employee) => {
        const current = employee.months.find(
          (entry) => entry.month === month && entry.year === year,
        );

        return current ? { employee, current } : null;
      })
      .filter(Boolean)
      .filter(({ current }) => current.status !== 'NOT_EMPLOYED')
      .sort((a, b) => {
        // Continued first — they are the ones a payroll drops and the Act does
        // not, and there are two of them in four hundred.
        const rank = (status) => (status === 'CONTINUED' ? 0 : 1);
        return rank(a.current.status) - rank(b.current.status);
      });
  }, [result, month, year]);

  const continued = useMemo(
    () => rows.filter(({ current }) => current.status === 'CONTINUED'),
    [rows],
  );

  const shortOfBenefit = useMemo(
    () =>
      (result?.employees || []).filter(
        (employee) => employee.qualifyingDays > 0 && !employee.benefitEligible,
      ),
    [result],
  );

  if (loading) {
    return (
      <div className="p-4 sm:p-8">
        <p className="text-sm text-gray-500 dark:text-slate-500">
          Loading the ESI contribution period…
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-serif text-gray-900 dark:text-white">
            Employees&rsquo; State Insurance
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-500 mt-1 max-w-2xl">
            Coverage attaches to the contribution period, not the payslip.{' '}
            {assessment?.period?.label} — feeding benefit in{' '}
            {assessment?.benefitPeriod?.label}.
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
              className="mt-1 block w-24 p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
            />
          </label>

          <button
            type="button"
            onClick={() => setShowRules((previous) => !previous)}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-700 text-sm text-gray-700 dark:text-slate-300"
          >
            {showRules ? 'Hide rules' : 'Rules'}
          </button>

          <button
            type="button"
            onClick={fileReturn}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm disabled:opacity-50"
          >
            {busy ? 'Working…' : 'File return'}
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
          The establishment employs fewer than ten people, so the Act does not
          apply. These figures are what would be payable rather than what is.
        </div>
      )}

      {showRules && draft && (
        <form
          onSubmit={saveRules}
          className="mb-8 p-5 rounded-xl border border-gray-200 dark:border-slate-800"
        >
          <h2 className="text-lg font-serif text-gray-900 dark:text-white mb-1">
            The notified figures
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-500 mb-4 max-w-2xl">
            Lowering the ceiling removes people from the scheme while they are
            still drawing benefit three months later — the benefit period lags
            the contribution period. The change is audited.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {RULE_FIELDS.map(([key, label, citation]) => (
              <label
                key={key}
                className="text-sm text-gray-700 dark:text-slate-300"
              >
                {label}
                <span className="block text-xs text-gray-400 dark:text-slate-600">
                  {citation}
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={draft[key] ?? ''}
                  onChange={setDraftField(key)}
                  className="mt-1 block w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
                />
              </label>
            ))}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="mt-4 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm disabled:opacity-50"
          >
            Save rules
          </button>
        </form>
      )}

      {result && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <div className="p-4 rounded-xl border border-gray-200 dark:border-slate-800">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
                In the scheme
              </p>
              <p className="text-2xl font-serif text-gray-900 dark:text-white mt-1">
                {result.coveredCount}
                <span className="text-base text-gray-400 dark:text-slate-600">
                  {' '}
                  / {result.employeeCount}
                </span>
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                Tested on wages excluding overtime, against{' '}
                {formatCurrency(rules?.wageCeiling || 0)}.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-gray-200 dark:border-slate-800">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
                Employee&rsquo;s share
              </p>
              <p className="text-2xl font-serif text-gray-900 dark:text-white mt-1">
                {formatCurrency(result.employeeTotal)}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                {rules?.employeeRatePercent}%, rounded up per employee.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-gray-200 dark:border-slate-800">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
                Employer&rsquo;s share
              </p>
              <p className="text-2xl font-serif text-gray-900 dark:text-white mt-1">
                {formatCurrency(result.employerTotal)}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                {rules?.employerRatePercent}%, rounded up separately — the total
                is not four per cent of anything.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-gray-200 dark:border-slate-800">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
                Short of benefit
              </p>
              <p className="text-2xl font-serif text-gray-900 dark:text-white mt-1">
                {shortOfBenefit.length}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                Under {rules?.benefitQualifyingDays} contribution days so far in
                this period.
              </p>
            </div>
          </div>

          {continued.length > 0 && (
            <div className="mb-8 p-5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40">
              <h2 className="text-lg font-serif text-amber-900 dark:text-amber-200">
                Carried by the Rule 50 proviso
              </h2>
              <p className="text-sm text-amber-800 dark:text-amber-300/90 mt-1 mb-3 max-w-3xl">
                These employees are above the ceiling and still in the scheme
                until {formatDate(assessment?.period?.end)}. Their contribution
                is on the wages actually paid, not on the ceiling — the Act sets
                no cap on the base.
              </p>

              <div className="flex flex-wrap gap-2">
                {continued.map(({ employee, current }) => (
                  <span
                    key={String(employee.employeeId)}
                    className="px-3 py-1.5 rounded-lg bg-white/70 dark:bg-slate-900/40 text-xs text-amber-900 dark:text-amber-200"
                  >
                    {employee.employeeName} · crossed{' '}
                    {formatDate(current.continuedFrom)} · contributing on{' '}
                    {formatCurrency(current.contributionWage)}
                  </span>
                ))}
              </div>
            </div>
          )}

          <h2 className="text-lg font-serif text-gray-900 dark:text-white mb-3">
            {MONTHS[month - 1]} {year}
          </h2>

          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800 mb-8">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-900/40 text-left">
                <tr className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
                  <th className="p-3">Employee</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Tested on</th>
                  <th className="p-3 text-right">Contributed on</th>
                  <th className="p-3 text-right">Days</th>
                  <th className="p-3 text-right">Employee</th>
                  <th className="p-3 text-right">Employer</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ employee, current }) => {
                  const key = String(employee.employeeId);
                  const differs =
                    current.contributionWage > 0 &&
                    current.contributionWage !== current.coverageWage;

                  return (
                    <tr
                      key={key}
                      className="border-t border-gray-100 dark:border-slate-800/60 align-top"
                    >
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() =>
                            setExpanded(expanded === key ? null : key)
                          }
                          className="text-left text-gray-900 dark:text-white hover:underline"
                        >
                          {employee.employeeName || 'Unnamed'}
                        </button>

                        {expanded === key && (
                          <div className="mt-3 space-y-1">
                            <p className="text-xs text-gray-500 dark:text-slate-500">
                              {employee.qualifyingDays} contribution days ·{' '}
                              {employee.benefitEligible
                                ? 'eligible for sickness benefit'
                                : `needs ${rules?.benefitQualifyingDays}`}
                            </p>

                            {employee.months.map((entry) => (
                              <div
                                key={`${entry.year}-${entry.month}`}
                                className="flex items-baseline justify-between gap-3 text-xs text-gray-600 dark:text-slate-400"
                              >
                                <span>
                                  {MONTHS[entry.month - 1]} ·{' '}
                                  {STATUS_LABELS[entry.status]}
                                </span>
                                <span>
                                  {formatCurrency(entry.contributionWage)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="p-3">
                        <span
                          className={`px-2 py-1 rounded text-xs whitespace-nowrap ${STATUS_TONE[current.status]}`}
                        >
                          {STATUS_LABELS[current.status]}
                        </span>
                      </td>

                      <td className="p-3 text-right text-gray-700 dark:text-slate-300 whitespace-nowrap">
                        {formatCurrency(current.coverageWage)}
                      </td>

                      <td className="p-3 text-right whitespace-nowrap">
                        <span
                          className={
                            differs
                              ? 'text-indigo-700 dark:text-indigo-300'
                              : 'text-gray-700 dark:text-slate-300'
                          }
                        >
                          {formatCurrency(current.contributionWage)}
                        </span>
                        {differs && (
                          <span className="block text-xs text-gray-400 dark:text-slate-600">
                            overtime included
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-right text-gray-700 dark:text-slate-300">
                        {current.daysWorked}
                      </td>

                      <td className="p-3 text-right text-gray-700 dark:text-slate-300 whitespace-nowrap">
                        {formatCurrency(current.employeeContribution)}
                      </td>

                      <td className="p-3 text-right text-gray-700 dark:text-slate-300 whitespace-nowrap">
                        {formatCurrency(current.employerContribution)}
                      </td>
                    </tr>
                  );
                })}

                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="p-6 text-center text-sm text-gray-500 dark:text-slate-500"
                    >
                      No payroll rows for this month.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {result.summary.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-serif text-gray-900 dark:text-white mb-3">
                Across the period
              </h2>
              <div className="flex flex-wrap gap-2">
                {result.summary.map((entry) => (
                  <span
                    key={entry.code}
                    className={`px-3 py-1.5 rounded-lg text-xs ${SEVERITY_TONE[entry.severity]}`}
                  >
                    {FINDING_LABELS[entry.code] || entry.code} ·{' '}
                    {entry.employeeCount} employee
                    {entry.employeeCount === 1 ? '' : 's'} · {entry.section}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <h2 className="text-lg font-serif text-gray-900 dark:text-white mb-3">
        Returns filed
      </h2>

      <div className="rounded-xl border border-gray-200 dark:border-slate-800 divide-y divide-gray-100 dark:divide-slate-800/60">
        {returns.map((entry) => (
          <div
            key={entry._id}
            className="p-3 flex flex-wrap items-baseline justify-between gap-3"
          >
            <div>
              <p className="text-sm text-gray-900 dark:text-white">
                {MONTHS[entry.month - 1]} {entry.year}
                <span className="text-gray-400 dark:text-slate-600">
                  {' '}
                  · {entry.periodLabel}
                </span>
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-500">
                {entry.coveredCount} covered
                {entry.continuedCount > 0 &&
                  ` · ${entry.continuedCount} carried by Rule 50`}{' '}
                · due {formatDate(entry.dueOn)}
              </p>
            </div>

            <div className="text-right">
              <p className="text-sm text-gray-900 dark:text-white">
                {formatCurrency(entry.total)}
              </p>
              {entry.daysLate > 0 && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {entry.daysLate} days late · {formatCurrency(entry.interest)}{' '}
                  interest + {formatCurrency(entry.damages)} damages
                </p>
              )}
            </div>
          </div>
        ))}

        {returns.length === 0 && (
          <p className="p-6 text-center text-sm text-gray-500 dark:text-slate-500">
            No return has been filed yet.
          </p>
        )}
      </div>
    </div>
  );
};

export default EsiContribution;
