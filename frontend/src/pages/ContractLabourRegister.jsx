import { useCallback, useEffect, useMemo, useState } from 'react';

import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDate } from '../utils/formatLocale';

/**
 * Contract labour compliance (#1700).
 *
 * The page opens on the applicability answer rather than on the register,
 * because "does this Act apply to us" is genuinely contested — the test is a
 * maximum over a trailing twelve months, and most establishments believe they
 * are out of scope on the strength of their current headcount. Showing the peak
 * and the day it happened is the whole argument in one line.
 *
 * Findings are grouped by severity with exposure first. Everything else on the
 * page is a register that is out of order; exposure is money the principal
 * employer may have to find, and it belongs at the top.
 */

const SEVERITY_ORDER = ['EXPOSURE', 'HIGH', 'MEDIUM', 'LOW'];

const SEVERITY_LABELS = {
  EXPOSURE: 'Section 21 exposure',
  HIGH: 'Serious',
  MEDIUM: 'Needs attention',
  LOW: 'Upcoming',
};

const SEVERITY_TONE = {
  EXPOSURE: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
  HIGH: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300',
  MEDIUM: 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300',
  LOW: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
};

const FINDING_LABELS = {
  UNLICENSED: 'No licence — section 12',
  LICENCE_EXPIRED: 'Licence expired — section 12',
  LICENCE_EXPIRING: 'Licence expiring — rule 29',
  LICENCE_CAPACITY_EXCEEDED: 'More workmen than the licence authorises',
  WAGES_UNEVIDENCED: 'No wage-payment evidence — section 21',
  PF_UNEVIDENCED: 'No provident fund remittance evidence',
  ESI_UNEVIDENCED: 'No employees’ state insurance remittance evidence',
  WAGE_PARITY_GAP: 'Wage parity gap — rule 25(2)(v)(a)',
  RETURN_OVERDUE: 'Form XXV annual return overdue — rule 82',
};

const REGISTERS = [
  ['XII', 'Form XII — register of contractors'],
  ['XIII', 'Form XIII — register of workmen'],
  ['XVII', 'Form XVII — wage register'],
];

const describeError = (error, fallback) => {
  const response = error?.response;
  if (!response) return 'Could not reach the server. Check your connection.';
  if (response.status === 403) {
    return 'You do not have permission to view the contract labour register.';
  }
  return response.data?.message || fallback;
};

const emptyContractor = {
  name: '',
  workNature: '',
  establishment: '',
  licenceNumber: '',
  licensingOfficer: '',
  licenceValidFrom: '',
  licenceValidTo: '',
  licensedWorkmen: '',
  securityDeposit: '',
};

const ContractLabourRegister = () => {
  const [assessment, setAssessment] = useState(null);
  const [contractors, setContractors] = useState([]);
  const [asAt, setAsAt] = useState('');

  const [draft, setDraft] = useState(emptyContractor);
  const [showContractorForm, setShowContractorForm] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);

  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const [assessmentRes, contractorRes] = await Promise.all([
        api.get('/api/contract-labour/assessment', {
          params: asAt ? { asAt } : undefined,
        }),
        api.get('/api/contract-labour/contractors'),
      ]);

      setAssessment(assessmentRes.data?.assessment || null);
      setContractors(
        Array.isArray(contractorRes.data?.contractors)
          ? contractorRes.data.contractors
          : [],
      );
    } catch (error) {
      setLoadError(
        describeError(error, 'Could not load the contract labour register.'),
      );
    } finally {
      setLoading(false);
    }
  }, [asAt]);

  useEffect(() => {
    load();
  }, [load]);

  const setDraftField = (key) => (event) =>
    setDraft((previous) => ({ ...previous, [key]: event.target.value }));

  const saveContractor = async (event) => {
    event.preventDefault();
    setBusy(true);

    try {
      await api.post('/api/contract-labour/contractors', {
        ...draft,
        licensedWorkmen: Number(draft.licensedWorkmen) || 0,
        securityDeposit: Number(draft.securityDeposit) || 0,
      });

      toast('Contractor registered.', 'success');
      setDraft(emptyContractor);
      setShowContractorForm(false);
      await load();
    } catch (error) {
      toast(
        describeError(error, 'Could not register the contractor.'),
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const bySeverity = useMemo(() => {
    const groups = new Map(SEVERITY_ORDER.map((level) => [level, []]));

    for (const finding of assessment?.findings || []) {
      const bucket = groups.get(finding.severity);
      if (bucket) bucket.push(finding);
    }

    return [...groups.entries()].filter(([, list]) => list.length > 0);
  }, [assessment]);

  if (loading) {
    return (
      <div className="p-4 sm:p-8">
        <p className="text-sm text-gray-500 dark:text-slate-500">
          Loading the contract labour register…
        </p>
      </div>
    );
  }

  const applicability = assessment?.applicability;
  const parity = assessment?.wageParity;

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-serif text-gray-900 dark:text-white">
            Contract labour
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-500 mt-1">
            Contract Labour (Regulation and Abolition) Act, 1970. What the
            principal employer is liable for, not what the contractor is owed.
          </p>
        </div>

        <label className="text-sm text-gray-700 dark:text-slate-300">
          As at
          <input
            type="date"
            value={asAt}
            onChange={(event) => setAsAt(event.target.value)}
            className="mt-1 block p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
          />
        </label>
      </div>

      {loadError && (
        <p
          role="alert"
          className="mb-6 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300"
        >
          {loadError}
        </p>
      )}

      {/* ── Applicability ────────────────────────────────────────────── */}
      {applicability && (
        <section
          className={`mb-6 p-5 rounded-xl border ${
            applicability.applicable
              ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900'
              : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800'
          }`}
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            {applicability.applicable
              ? 'The Act applies to this establishment'
              : 'The Act does not apply to this establishment'}
          </h2>
          <p className="text-sm text-gray-700 dark:text-slate-300">
            {applicability.reason}
          </p>
          <p className="mt-2 text-xs text-gray-500 dark:text-slate-500">
            Section 1(4) asks about <em>any day</em> of the preceding twelve
            months, so the test is the peak over{' '}
            {formatDate(applicability.windowFrom)} to{' '}
            {formatDate(applicability.windowTo)} — not the current headcount and
            not an average. The Occupational Safety, Health and Working
            Conditions Code raises the threshold to{' '}
            {applicability.successorThreshold} once its rules are notified.
          </p>
        </section>
      )}

      {applicability && !applicability.applicable ? (
        <p className="p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-sm text-gray-500 dark:text-slate-500">
          Nothing is assessed while the Act does not apply — reporting licence
          and section 21 findings would be reporting breaches of a statute this
          establishment is not covered by. Record deployments as they happen and
          this page will say when that changes.
        </p>
      ) : (
        <>
          {/* ── Findings ─────────────────────────────────────────────── */}
          <section className="mb-6 p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
            <div className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Findings
              </h2>
              {assessment?.exposure > 0 && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {formatCurrency(assessment.exposure)} of section 21 exposure,
                  recoverable from the contractors under section 21(4)
                </p>
              )}
            </div>

            {bySeverity.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-slate-500">
                Nothing outstanding. Every deployed month has wage, provident
                fund and insurance evidence, and every licence covers what is
                deployed against it.
              </p>
            ) : (
              <div className="space-y-4">
                {bySeverity.map(([severity, findings]) => (
                  <div key={severity}>
                    <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500 mb-2">
                      {SEVERITY_LABELS[severity]}
                    </p>
                    <ul className="space-y-2">
                      {findings.map((finding, index) => (
                        <li
                          key={`${finding.code}-${finding.contractorId || 'establishment'}-${index}`}
                          className={`p-3 rounded-lg text-sm ${SEVERITY_TONE[severity]}`}
                        >
                          <p className="font-medium">
                            {FINDING_LABELS[finding.code] || finding.code}
                            {finding.contractorName && (
                              <span className="font-normal">
                                {' '}
                                — {finding.contractorName}
                              </span>
                            )}
                          </p>
                          <p className="mt-0.5 opacity-90">{finding.detail}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Wage parity ──────────────────────────────────────────── */}
          {parity && parity.comparisons.length > 0 && (
            <section className="mb-6 p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                Wage parity — rule 25(2)(v)(a)
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-500 mb-4">
                Candidates, not conclusions. “Same or similar kind of work” is a
                judgement; this surfaces the designations the establishment also
                employs directly at a materially higher median, at a tolerance
                of {Math.round(parity.tolerance * 100)}%.
                {parity.monthlyCost > 0 && (
                  <>
                    {' '}
                    Closing every material gap would cost{' '}
                    {formatCurrency(parity.monthlyCost)} a month.
                  </>
                )}
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500 border-b border-gray-200 dark:border-slate-800">
                      <th className="py-2 pr-4">Designation</th>
                      <th className="py-2 pr-4 text-right">Workmen</th>
                      <th className="py-2 pr-4 text-right">Contract wage</th>
                      <th className="py-2 pr-4 text-right">
                        Directly employed
                      </th>
                      <th className="py-2 text-right">Gap</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-700 dark:text-slate-300">
                    {parity.comparisons.map((row) => (
                      <tr
                        key={row.designation}
                        className="border-b border-gray-100 dark:border-slate-800/60"
                      >
                        <td className="py-2 pr-4">{row.designation}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          {row.workmen}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          {formatCurrency(row.contractWage)}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          {row.comparable ? (
                            <>
                              {formatCurrency(row.directWage)}
                              <span className="block text-xs text-gray-500 dark:text-slate-500">
                                median of {row.directHeadcount}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-gray-500 dark:text-slate-500">
                              no comparator
                            </span>
                          )}
                        </td>
                        <td
                          className={`py-2 text-right tabular-nums ${
                            row.material
                              ? 'font-semibold text-red-600 dark:text-red-400'
                              : ''
                          }`}
                        >
                          {row.comparable ? `${row.gapPercent}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── Contractors ──────────────────────────────────────────── */}
          <section className="mb-6 p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Contractors
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                  A licence is sized against the peak month, not the latest — a
                  licence for twenty-five is breached by a month at forty even
                  if this month is back down to twenty.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowContractorForm((open) => !open)}
                className="px-3 py-1.5 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-700 dark:text-slate-300"
              >
                {showContractorForm ? 'Cancel' : 'Register a contractor'}
              </button>
            </div>

            {showContractorForm && (
              <form
                onSubmit={saveContractor}
                className="mb-5 p-4 rounded-lg bg-gray-50 dark:bg-slate-950 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                <label className="text-sm text-gray-700 dark:text-slate-300">
                  Name
                  <input
                    required
                    value={draft.name}
                    onChange={setDraftField('name')}
                    className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
                  />
                </label>

                <label className="text-sm text-gray-700 dark:text-slate-300">
                  Nature of work
                  <input
                    value={draft.workNature}
                    onChange={setDraftField('workNature')}
                    className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
                  />
                </label>

                <label className="text-sm text-gray-700 dark:text-slate-300">
                  Establishment
                  <input
                    value={draft.establishment}
                    onChange={setDraftField('establishment')}
                    className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
                  />
                </label>

                <label className="text-sm text-gray-700 dark:text-slate-300">
                  Licence number
                  <input
                    value={draft.licenceNumber}
                    onChange={setDraftField('licenceNumber')}
                    className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
                  />
                  <span className="block mt-1 text-xs text-gray-500 dark:text-slate-500">
                    Section 12 requires one at twenty workmen or more
                  </span>
                </label>

                <label className="text-sm text-gray-700 dark:text-slate-300">
                  Workmen the licence authorises
                  <input
                    type="number"
                    value={draft.licensedWorkmen}
                    onChange={setDraftField('licensedWorkmen')}
                    className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
                  />
                </label>

                <label className="text-sm text-gray-700 dark:text-slate-300">
                  Licence valid to
                  <input
                    type="date"
                    value={draft.licenceValidTo}
                    onChange={setDraftField('licenceValidTo')}
                    className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
                  />
                </label>

                <div className="sm:col-span-2 lg:col-span-3">
                  <button
                    type="submit"
                    disabled={busy}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm"
                  >
                    Register contractor
                  </button>
                </div>
              </form>
            )}

            {contractors.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-slate-500">
                No contractors on the register.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500 border-b border-gray-200 dark:border-slate-800">
                      <th className="py-2 pr-4">Contractor</th>
                      <th className="py-2 pr-4">Licence</th>
                      <th className="py-2 pr-4">Valid to</th>
                      <th className="py-2 pr-4 text-right">Authorised</th>
                      <th className="py-2 pr-4 text-right">Peak deployed</th>
                      <th className="py-2 text-right">Exposure</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-700 dark:text-slate-300">
                    {contractors.map((contractor) => {
                      const assessed = (assessment?.contractors || []).find(
                        (c) => c.contractorId === String(contractor._id),
                      );

                      return (
                        <tr
                          key={contractor._id}
                          className="border-b border-gray-100 dark:border-slate-800/60"
                        >
                          <td className="py-2 pr-4">
                            <span className="font-medium">
                              {contractor.name}
                            </span>
                            <span className="block text-xs text-gray-500 dark:text-slate-500">
                              {contractor.workNature}
                            </span>
                          </td>
                          <td className="py-2 pr-4">
                            {contractor.licenceNumber || (
                              <span className="text-xs text-gray-500 dark:text-slate-500">
                                none
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-4">
                            {contractor.licenceValidTo
                              ? formatDate(contractor.licenceValidTo)
                              : '—'}
                          </td>
                          <td className="py-2 pr-4 text-right tabular-nums">
                            {contractor.licensedWorkmen || '—'}
                          </td>
                          <td className="py-2 pr-4 text-right tabular-nums">
                            {assessed ? assessed.licence.deployedWorkmen : 0}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {assessed && assessed.exposure.exposure > 0 ? (
                              <span className="text-red-600 dark:text-red-400">
                                {formatCurrency(assessed.exposure.exposure)}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── Registers ────────────────────────────────────────────── */}
          <section className="p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Statutory registers
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-500 mb-4">
              In the prescribed column order. The Form XXV annual return is due
              by 15 February for the preceding calendar year.
            </p>

            <ul className="space-y-2">
              {REGISTERS.map(([form, label]) => (
                <li key={form}>
                  <a
                    href={`/api/contract-labour/registers/${form}`}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>

            {assessment?.annualReturn && (
              <p
                className={`mt-4 p-3 rounded-lg text-sm ${
                  assessment.annualReturn.overdue
                    ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300'
                    : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300'
                }`}
              >
                Form XXV for {assessment.annualReturn.year} was due by{' '}
                {formatDate(assessment.annualReturn.dueBy)}
                {assessment.annualReturn.filed
                  ? `, filed ${formatDate(assessment.annualReturn.filedOn)}`
                  : ' and has not been filed'}
                {assessment.annualReturn.overdue &&
                  ` — ${assessment.annualReturn.daysLate} days late`}
                .
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default ContractLabourRegister;
