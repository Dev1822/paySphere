import { useCallback, useEffect, useMemo, useState } from 'react';

import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatDate } from '../utils/formatLocale';

/**
 * EPF International Workers — paragraph 83 (#1971).
 *
 * The page leads with **certificates about to lapse, as a countdown**. A
 * Certificate of Coverage expiring is the highest-value thing here: the day
 * after, the worker attaches at full pay with no wage ceiling, and the
 * under-remittance compounds every month until somebody opens the PDF.
 * Extending one is an application to a foreign social security authority, so a
 * date is useless and ninety days of warning is the minimum that helps.
 *
 * **Every contribution is drawn against what the ceiling would have produced.**
 * ₹72,000 beside ₹1,800 looks like a bug to anybody who has only ever seen the
 * domestic path, and somebody will eventually "fix" it. The comparison column
 * and the sentence under it are what stop that — the large number is the right
 * one, and the page says so where it is read.
 *
 * **The withdrawal position is shown even when nobody has asked.** A domestic
 * member may withdraw after two months' unemployment and an International
 * Worker may not. Showing the refusal with its ground on the register means the
 * conversation happens before the member applies rather than after they are
 * turned down.
 *
 * **A determination that nobody has made is drawn as a question, not as
 * "domestic".** Defaulting an undetermined employee to the domestic rules is
 * the error that costs money, and it is the silent one.
 */

const STATUS_LABELS = {
  INTERNATIONAL_WORKER: 'International Worker',
  EXCLUDED_BY_CERTIFICATE: 'Detached by certificate',
  DOMESTIC: 'Domestic member',
  UNDETERMINED: 'Not yet determined',
};

const STATUS_TONE = {
  INTERNATIONAL_WORKER:
    'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300',
  EXCLUDED_BY_CERTIFICATE:
    'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300',
  DOMESTIC: 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300',
  UNDETERMINED:
    'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300',
};

const FINDING_LABELS = {
  STATUS_NOT_DETERMINED: 'Nobody has determined the paragraph 83 status',
  CEILING_APPLIED_TO_IW: 'Remitted on the domestic ceiling',
  CERTIFICATE_EXPIRING: 'The certificate is about to lapse',
  CERTIFICATE_EXPIRED: 'The certificate has lapsed',
  CERTIFICATE_FROM_NON_SSA_COUNTRY: 'The certificate detaches nobody',
  DEPUTATION_NOT_CLASSIFIED: 'A deputation with no determination against it',
  WITHDRAWAL_NOT_AVAILABLE: 'Withdrawal is not available on this ground',
  PENSION_NOT_AVAILABLE: 'No agreement provides for pension membership',
  IW_ONE_DUE: 'IW-1 due',
  IW_ONE_OVERDUE: 'IW-1 overdue',
};

const SEVERITY_TONE = {
  BREACH: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
  DUE: 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300',
  INFORMATIONAL:
    'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
};

const describeError = (error, fallback) => {
  const response = error?.response;
  if (!response) return 'Could not reach the server. Check your connection.';
  if (response.status === 403) {
    return 'You do not have permission to view the international worker register.';
  }
  return response.data?.message || fallback;
};

const rupees = (value) =>
  value === null || value === undefined
    ? '—'
    : `₹${Number(value).toLocaleString('en-IN')}`;

/**
 * Days until the certificate lapses.
 *
 * A countdown rather than a date. Extending one is an application to a foreign
 * authority, and a date leaves the reader to work out whether there is still
 * time to make it.
 */
const CertificateBadge = ({ position }) => {
  if (!position) {
    return <span className="text-gray-400 dark:text-slate-600">—</span>;
  }

  if (!position.detachmentAvailable) {
    return (
      <span className="text-[11px] px-2 py-1 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">
        No detachment article with {position.countryCode}
      </span>
    );
  }

  if (position.expired) {
    return (
      <span className="text-[11px] px-2 py-1 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">
        Lapsed {formatDate(position.validTo)} · attached since{' '}
        {formatDate(position.attachesFrom)}
      </span>
    );
  }

  if (position.expiring) {
    return (
      <span className="text-[11px] px-2 py-1 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300">
        {position.daysRemaining} days left · attaches{' '}
        {formatDate(position.attachesFrom)}
      </span>
    );
  }

  return (
    <span className="text-[11px] px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300">
      Valid to {formatDate(position.validTo)}
    </span>
  );
};

const InternationalWorkerRegister = () => {
  const [establishment, setEstablishment] = useState('');

  const [position, setPosition] = useState(null);
  const [rules, setRules] = useState(null);
  const [expiring, setExpiring] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const [positionRes, rulesRes, expiringRes] = await Promise.all([
        api.get('/api/international-workers/position', {
          params: { establishment },
        }),
        api.get('/api/international-workers/rules'),
        api.get('/api/international-workers/certificates/expiring'),
      ]);

      setPosition(positionRes.data || null);
      setRules(rulesRes.data || null);
      setExpiring(
        Array.isArray(expiringRes.data?.certificates)
          ? expiringRes.data.certificates
          : [],
      );
    } catch (error) {
      setLoadError(
        describeError(
          error,
          'Could not load the international worker register.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [establishment]);

  useEffect(() => {
    load();
  }, [load]);

  const checkWithdrawal = async (employeeId) => {
    try {
      const response = await api.get('/api/international-workers/withdrawal', {
        params: { employeeId, ground: 'TWO_MONTHS_UNEMPLOYED' },
      });
      // The reason, not the verdict. A member told "no" with no reason applies
      // again next month.
      toast(response.data?.withdrawal?.reason || 'No answer returned.', 'info');
    } catch (error) {
      toast(
        describeError(error, 'Could not check the withdrawal position.'),
        'error',
      );
    }
  };

  const result = position?.result;

  /**
   * Workers ordered by what needs doing: lapsed certificates first, then
   * expiring, then undetermined, then everything else.
   */
  const workers = useMemo(() => {
    const rows = result?.assessments || [];

    const rank = (row) => {
      if (row.certificate?.expired) return 0;
      if (row.certificate?.expiring) return 1;
      if (row.status?.status === 'UNDETERMINED') return 2;
      if (row.status?.status === 'INTERNATIONAL_WORKER') return 3;
      return 4;
    };

    return [...rows].sort((a, b) => rank(a) - rank(b));
  }, [result]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-72 bg-gray-200 dark:bg-slate-800 rounded" />
          <div className="h-48 bg-gray-200 dark:bg-slate-800 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            International workers
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-2xl">
            Paragraph 83 has <strong>no wage ceiling</strong>. Contribution is
            on full monthly pay including the portion paid outside India, and a
            Certificate of Coverage stops it only for as long as the certificate
            runs.
          </p>
        </div>

        <label className="text-sm">
          <span className="block text-gray-500 dark:text-slate-400 mb-1">
            Establishment
          </span>
          <input
            value={establishment}
            onChange={(event) => setEstablishment(event.target.value)}
            placeholder="Blank for the default"
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm w-56"
          />
        </label>
      </header>

      {loadError && (
        <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {loadError}
        </div>
      )}

      {/* The countdown block, at the top. See the page comment. */}
      {expiring.length > 0 && (
        <section className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-900/10 p-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Certificates lapsing
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            The day after a certificate lapses the worker attaches at full pay
            with no ceiling. Extending one is an application to a foreign
            authority and takes time.
          </p>

          <ul className="mt-3 space-y-2">
            {expiring.map((certificate) => (
              <li
                key={certificate._id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span className="text-gray-900 dark:text-white">
                  {String(certificate.employeeId)} · {certificate.countryCode}
                </span>
                <CertificateBadge position={certificate.position} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {result && (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 dark:border-slate-800 p-4">
              <div className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-slate-500">
                International workers
              </div>
              <div className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">
                {
                  workers.filter(
                    (row) => row.status?.status === 'INTERNATIONAL_WORKER',
                  ).length
                }
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-slate-800 p-4">
              <div className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-slate-500">
                Understated if the ceiling were applied
              </div>
              <div className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">
                {rupees(result.contributionUnderstatementIfCeilingApplied)}
              </div>
              <div className="text-[11px] text-gray-400 dark:text-slate-600 mt-1">
                per month, across the register
              </div>
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

          <section className="rounded-xl border border-gray-200 dark:border-slate-800 p-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              The register
            </h2>

            <div className="overflow-x-auto mt-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 dark:text-slate-500">
                    <th className="pb-2 pr-4">Employee</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Certificate</th>
                    <th className="pb-2 pr-4 text-right">Basis</th>
                    <th className="pb-2 pr-4 text-right">
                      The ceiling would have given
                    </th>
                    <th className="pb-2 text-right">Withdrawal</th>
                  </tr>
                </thead>
                <tbody>
                  {workers.map((row) => (
                    <tr
                      key={String(row.employeeId)}
                      className="border-t border-gray-100 dark:border-slate-800"
                    >
                      <td className="py-2 pr-4 text-gray-900 dark:text-white">
                        {String(row.employeeId)}
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={`text-[11px] px-2 py-1 rounded ${STATUS_TONE[row.status?.status]}`}
                        >
                          {STATUS_LABELS[row.status?.status] ||
                            row.status?.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        <CertificateBadge position={row.certificate} />
                      </td>
                      <td className="py-2 pr-4 text-right font-medium">
                        {rupees(row.contribution?.basis)}
                      </td>
                      {/* The comparison. See the page comment. */}
                      <td className="py-2 pr-4 text-right text-gray-400 dark:text-slate-600">
                        {rupees(row.contribution?.ceilingWouldHaveBeen)}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => checkWithdrawal(row.employeeId)}
                          className="text-[11px] px-2 py-1 rounded border border-gray-200 dark:border-slate-700"
                        >
                          Check
                        </button>
                      </td>
                    </tr>
                  ))}

                  {workers.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-6 text-center text-gray-500 dark:text-slate-400"
                      >
                        No paragraph 83 determinations recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Where somebody about to "fix" the large figure will read it. */}
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-3 border-l-2 border-gray-200 dark:border-slate-700 pl-3">
              {result.notes?.noWageCeiling}
            </p>
          </section>

          {result.findings?.length > 0 && (
            <section className="rounded-xl border border-gray-200 dark:border-slate-800 p-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                Findings
              </h2>

              <ul className="mt-3 space-y-2">
                {result.findings.map((finding, index) => (
                  <li key={index} className="flex items-start gap-3 text-xs">
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
            </section>
          )}

          <p className="text-xs text-gray-500 dark:text-slate-400 border-l-2 border-gray-200 dark:border-slate-700 pl-3">
            {result.notes?.withdrawalIsNotAvailableOnUnemployment}
          </p>

          {rules?.note && (
            <p className="text-xs text-gray-400 dark:text-slate-600">
              {rules.note}
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default InternationalWorkerRegister;
