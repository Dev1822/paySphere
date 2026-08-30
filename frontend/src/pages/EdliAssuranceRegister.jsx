import { useCallback, useEffect, useMemo, useState } from 'react';

import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDate } from '../utils/formatLocale';

/**
 * EDLI paragraph 22 — the assurance benefit (#1878).
 *
 * The page is built around **the twelve-month window drawn as twelve months**,
 * because that is the part of the computation nobody can check from a single
 * figure. Each month shows what was actually paid alongside what the ₹15,000
 * ceiling allowed of it, so a member on ₹40,000 with two months of loss of pay
 * can be seen to have a capped average of ₹12,500 rather than ₹15,000 — and a
 * family quoted the resulting benefit can see where it came from.
 *
 * The **binding boundary is named next to the figure**. A benefit sitting
 * exactly on ₹7,00,000 looks like a coincidence and is not one: thirty-five
 * times the ceiling is ₹5,25,000, the bonus cap is ₹1,75,000, and they sum to
 * the overall cap. Saying "capped at the bonus" or "the floor applied" beside
 * the number is the difference between a figure and an explanation.
 *
 * The **minimum badge is conditional and says so**. ₹2,50,000 applies only
 * where the member had twelve months of continuous employment preceding the
 * month of death, which may run across establishments — so the badge carries
 * the months and what they rest on. A floor resting on an unsupported
 * declaration and one resting on a passbook produce the same number, and the
 * page should not let them look the same.
 *
 * The **exempted shortfall is its own row and is never added to the benefit**.
 * It is the part of the same benefit the group policy did not cover, not an
 * additional payment, and it is a liability of the establishment that accepted
 * the exemption rather than of the insurer.
 */

const BINDING_LABELS = {
  NONE: 'No cap or floor applied',
  WAGE_CEILING: 'The wage ceiling bound',
  BONUS_CAP: 'Capped at the bonus limit',
  OVERALL_CAP: 'Capped at the overall limit',
  MINIMUM: 'The statutory floor applied',
};

const BINDING_TONE = {
  NONE: 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300',
  WAGE_CEILING:
    'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
  BONUS_CAP:
    'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300',
  OVERALL_CAP:
    'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300',
  MINIMUM:
    'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300',
};

const PAYEE_LABELS = {
  NOMINEE: 'Nominee under Form 2',
  FAMILY: 'Family, as the scheme defines it',
  LEGAL_HEIR: 'Legal heir',
  UNRESOLVED: 'No payee on record',
};

const SERVICE_BASIS_LABELS = {
  THIS_ESTABLISHMENT: 'This establishment’s records',
  SERVICE_CERTIFICATE: 'A service certificate',
  PASSBOOK: 'The EPF passbook',
  DECLARED: 'Declared, and not yet supported',
};

const FINDING_LABELS = {
  WINDOW_INCOMPLETE: 'Shorter service — averaged over the actual period',
  ZERO_WAGE_MONTHS_IN_WINDOW: 'Months with no wages inside the window',
  WAGE_CEILING_BINDING: 'Wages above the ceiling in at least one month',
  BONUS_CAP_APPLIED: 'The bonus was capped',
  OVERALL_CAP_APPLIED: 'The overall cap applied',
  MINIMUM_APPLIED: 'The statutory floor applied',
  MINIMUM_NOT_AVAILABLE: 'The floor is not available — service is short',
  PRIOR_SERVICE_DECLARED_ONLY: 'The floor rests on a declaration alone',
  NO_NOMINATION: 'No valid Form 2 nomination',
  PAYEE_UNRESOLVED: 'No payee on record at all',
  NOMINEE_SHARES_INCOMPLETE: 'The nominated shares do not total 100%',
  EXEMPTED_POLICY_SHORTFALL: 'The group policy pays less than the scheme',
  EXEMPTED_POLICY_NOT_RECORDED: 'No policy benefit recorded to compare',
  RULES_PREDATE_DEATH: 'Computed under an earlier rule set',
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
    return 'You do not have permission to view the EDLI register.';
  }
  return response.data?.message || fallback;
};

const money = (value) => formatCurrency(Number(value) || 0);

const monthLabel = (row) => `${row.year}-${String(row.month).padStart(2, '0')}`;

/**
 * The averaging window, drawn as twelve months.
 *
 * The bar shows the capped figure against the actual, because the cap is
 * applied **per month** and not to the average — a member on ₹40,000 for six
 * months and nothing for six has a capped average of ₹7,500, not ₹15,000, and
 * that difference is half the benefit.
 */
const WindowStrip = ({ months, ceiling }) => {
  const scale = Math.max(
    ceiling || 15000,
    ...months.map((month) => month.actual || 0),
    1,
  );

  return (
    <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
      {months.map((month) => {
        const actual = Number(month.actual) || 0;
        const capped = Number(month.capped) || 0;

        return (
          <div key={monthLabel(month)} className="text-center">
            <div
              className="h-20 flex flex-col justify-end bg-gray-100 dark:bg-slate-800 rounded overflow-hidden"
              title={`${monthLabel(month)} — paid ${money(actual)}, counted ${money(capped)}`}
            >
              {actual > capped && (
                <div
                  className="bg-gray-300 dark:bg-slate-600"
                  style={{ height: `${((actual - capped) / scale) * 100}%` }}
                />
              )}
              <div
                className={
                  capped === 0
                    ? 'bg-red-300 dark:bg-red-800'
                    : 'bg-indigo-500 dark:bg-indigo-400'
                }
                style={{
                  height: `${Math.max((capped / scale) * 100, capped === 0 ? 4 : 0)}%`,
                }}
              />
            </div>
            <p className="text-[10px] text-gray-500 dark:text-slate-500 mt-1">
              {String(month.month).padStart(2, '0')}
            </p>
          </div>
        );
      })}
    </div>
  );
};

const EdliAssuranceRegister = () => {
  const [establishment, setEstablishment] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [dateOfDeath, setDateOfDeath] = useState('');

  const [preview, setPreview] = useState(null);
  const [rules, setRules] = useState(null);
  const [claims, setClaims] = useState([]);
  const [exemption, setExemption] = useState(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);

  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const [rulesRes, claimsRes, exemptionRes] = await Promise.all([
        api.get('/api/edli/rules'),
        api.get('/api/edli/claims', { params: { establishment } }),
        api.get('/api/edli/exemption', { params: { establishment } }),
      ]);

      setRules(rulesRes.data || null);
      setClaims(
        Array.isArray(claimsRes.data?.claims) ? claimsRes.data.claims : [],
      );
      setExemption(exemptionRes.data?.exemption || null);
    } catch (error) {
      setLoadError(describeError(error, 'Could not load the EDLI register.'));
    } finally {
      setLoading(false);
    }
  }, [establishment]);

  useEffect(() => {
    load();
  }, [load]);

  const runPreview = async () => {
    if (!employeeId || !dateOfDeath) {
      toast('An employee and a date of death are needed.', 'error');
      return;
    }

    setBusy(true);
    try {
      const response = await api.get('/api/edli/preview', {
        params: { employeeId, dateOfDeath, establishment },
      });
      setPreview(response.data?.claim || null);
    } catch (error) {
      toast(describeError(error, 'Could not compute the claim.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    setBusy(true);
    try {
      await api.post('/api/edli/claims', {
        employeeId,
        dateOfDeath,
        establishment,
      });
      toast('Claim committed.', 'success');
      setPreview(null);
      await load();
    } catch (error) {
      toast(describeError(error, 'Could not commit the claim.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const ceiling = rules?.inForce?.wageCeiling || 15000;

  const windowMonths = useMemo(() => preview?.wages?.months || [], [preview]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-gray-200 dark:bg-slate-800 rounded" />
          <div className="h-40 bg-gray-200 dark:bg-slate-800 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          EDLI assurance
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-2xl">
          What the scheme pays on a death in service. Thirty-five times the
          capped average of the twelve months preceding the month of death, plus
          half the average balance, with the floor where twelve months of
          continuous employment support it.
        </p>
      </header>

      {loadError && (
        <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {loadError}
        </div>
      )}

      {exemption?.exempted && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
          <p className="text-sm text-amber-900 dark:text-amber-300">
            This establishment is exempted under section 17(2A) and runs a group
            policy{exemption.insurer ? ` with ${exemption.insurer}` : ''}. The
            exemption is conditional on that policy paying{' '}
            <strong>not less than</strong> the scheme would, so paragraph 22 is
            computed here anyway — for an unexempted establishment the EPFO does
            this arithmetic, and for an exempted one nobody else does.
          </p>
        </div>
      )}

      <section className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
        <h2 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
          Compute a claim
        </h2>

        <div className="grid gap-3 sm:grid-cols-4">
          <label className="text-sm">
            <span className="block text-gray-500 dark:text-slate-400 mb-1">
              Establishment
            </span>
            <input
              value={establishment}
              onChange={(event) => setEstablishment(event.target.value)}
              placeholder="Blank for the default"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
            />
          </label>

          <label className="text-sm">
            <span className="block text-gray-500 dark:text-slate-400 mb-1">
              Member
            </span>
            <input
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
              placeholder="Employee id"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
            />
          </label>

          <label className="text-sm">
            <span className="block text-gray-500 dark:text-slate-400 mb-1">
              Date of death
            </span>
            <input
              type="date"
              value={dateOfDeath}
              onChange={(event) => setDateOfDeath(event.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
            />
          </label>

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={runPreview}
              disabled={busy}
              className="px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-700 text-sm font-medium disabled:opacity-50"
            >
              {busy ? 'Computing…' : 'Compute'}
            </button>
            <button
              type="button"
              onClick={commit}
              disabled={busy || !preview}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-50"
            >
              Commit
            </button>
          </div>
        </div>
      </section>

      {preview && (
        <>
          <section className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
                  Assurance payable
                </p>
                <p className="text-3xl font-semibold text-gray-900 dark:text-white mt-1 tabular-nums">
                  {money(preview.benefit)}
                </p>
                <span
                  className={`inline-block mt-2 px-2 py-1 rounded text-[11px] ${
                    BINDING_TONE[preview.binding] || BINDING_TONE.NONE
                  }`}
                >
                  {BINDING_LABELS[preview.binding] || preview.binding}
                </span>
              </div>

              <div className="text-right">
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Paid to
                </p>
                <p className="text-sm text-gray-900 dark:text-white">
                  {PAYEE_LABELS[preview.payees?.limb] || preview.payees?.limb}
                </p>
                {(preview.payees?.payees || []).map((payee) => (
                  <p
                    key={payee.name}
                    className="text-xs text-gray-500 dark:text-slate-400"
                  >
                    {payee.name}
                    {payee.sharePercent ? ` · ${payee.sharePercent}%` : ''}
                  </p>
                ))}
              </div>
            </div>

            <dl className="grid gap-4 sm:grid-cols-3 mt-5 pt-5 border-t border-gray-100 dark:border-slate-800">
              <div>
                <dt className="text-xs text-gray-500 dark:text-slate-400">
                  35 × capped average wages
                </dt>
                <dd className="text-lg text-gray-900 dark:text-white tabular-nums">
                  {money(preview.assuranceComponent)}
                </dd>
                <p className="text-[11px] text-gray-400 dark:text-slate-600">
                  Average {money(Math.round(preview.wages?.average || 0))} over{' '}
                  {preview.wages?.divisor} months
                </p>
              </div>

              <div>
                <dt className="text-xs text-gray-500 dark:text-slate-400">
                  50% of the average balance
                </dt>
                <dd className="text-lg text-gray-900 dark:text-white tabular-nums">
                  {money(preview.bonusComponent)}
                </dd>
                {preview.bonusCapped && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    capped from {money(preview.bonusBeforeCap)}
                  </p>
                )}
              </div>

              <div>
                <dt className="text-xs text-gray-500 dark:text-slate-400">
                  Statutory floor
                </dt>
                <dd className="text-lg text-gray-900 dark:text-white tabular-nums">
                  {preview.minimumAvailable
                    ? money(preview.rules?.minimumBenefit)
                    : 'Not available'}
                </dd>
                <p className="text-[11px] text-gray-400 dark:text-slate-600">
                  {preview.continuous?.months} months continuous ·{' '}
                  {SERVICE_BASIS_LABELS[preview.continuous?.basis] ||
                    preview.continuous?.basis}
                </p>
              </div>
            </dl>

            {preview.exemption?.applies && (
              <div className="mt-5 pt-5 border-t border-gray-100 dark:border-slate-800">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
                  Section 17(2A) comparison
                </p>
                <div className="flex flex-wrap gap-6 mt-2 text-sm">
                  <span className="text-gray-700 dark:text-slate-300">
                    Scheme would pay{' '}
                    <span className="tabular-nums font-medium">
                      {money(preview.exemption.schemeBenefit)}
                    </span>
                  </span>
                  <span className="text-gray-700 dark:text-slate-300">
                    Policy pays{' '}
                    <span className="tabular-nums font-medium">
                      {preview.exemption.policyBenefit === null
                        ? 'not recorded'
                        : money(preview.exemption.policyBenefit)}
                    </span>
                  </span>
                  {preview.exemption.shortfall > 0 && (
                    <span className="text-red-700 dark:text-red-400">
                      Shortfall{' '}
                      <span className="tabular-nums font-medium">
                        {money(preview.exemption.shortfall)}
                      </span>
                    </span>
                  )}
                </div>
                {preview.exemption.shortfall > 0 && (
                  <p className="text-xs text-red-700 dark:text-red-400 mt-2 max-w-3xl">
                    The shortfall is not added to the benefit above. It is the
                    part of the same benefit the policy did not cover, and it is
                    a liability of the establishment that accepted the exemption
                    rather than of the insurer.
                  </p>
                )}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
            <h2 className="text-sm font-medium text-gray-900 dark:text-white">
              The averaging window
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 mb-4">
              The twelve months preceding the month of death. The solid bar is
              what counted after the {money(ceiling)} ceiling; the grey above it
              is what was paid and did not count. A month with no wages is a
              month of the window, not a month to skip.
            </p>

            <WindowStrip months={windowMonths} ceiling={ceiling} />
          </section>

          {preview.findings?.length > 0 && (
            <section className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
              <h2 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                Findings
              </h2>
              <ul className="space-y-2">
                {preview.findings.map((finding, index) => (
                  <li
                    key={`${finding.code}-${index}`}
                    className={`px-3 py-2 rounded text-sm ${
                      SEVERITY_TONE[finding.severity] ||
                      SEVERITY_TONE.INFORMATIONAL
                    }`}
                  >
                    <span className="font-medium">
                      {FINDING_LABELS[finding.code] || finding.code}
                    </span>
                    <span className="opacity-70"> · {finding.authority}</span>
                    {finding.note && (
                      <p className="text-xs opacity-90 mt-1">{finding.note}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <section className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-800">
          <h2 className="text-sm font-medium text-gray-900 dark:text-white">
            Committed claims
          </h2>
        </div>

        {claims.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-500 dark:text-slate-400">
            No claims committed.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-800/50 text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
                <tr>
                  <th className="text-left px-5 py-2">Member</th>
                  <th className="text-left px-5 py-2">Date of death</th>
                  <th className="text-right px-5 py-2">Benefit</th>
                  <th className="text-left px-5 py-2">Boundary</th>
                  <th className="text-left px-5 py-2">Paid to</th>
                  <th className="text-right px-5 py-2">Shortfall</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {claims.map((claim) => (
                  <tr key={claim._id}>
                    <td className="px-5 py-3 text-gray-900 dark:text-white">
                      {claim.employeeId?.name || '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-700 dark:text-slate-300">
                      {formatDate(claim.dateOfDeath)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-gray-900 dark:text-white">
                      {money(claim.benefit)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] ${
                          BINDING_TONE[claim.binding] || BINDING_TONE.NONE
                        }`}
                      >
                        {BINDING_LABELS[claim.binding] || claim.binding}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-700 dark:text-slate-300">
                      {PAYEE_LABELS[claim.payeeLimb] || claim.payeeLimb}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {claim.exemptedShortfall > 0 ? (
                        <span className="text-red-700 dark:text-red-400">
                          {money(claim.exemptedShortfall)}
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-slate-600">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default EdliAssuranceRegister;
