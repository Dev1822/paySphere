import { useCallback, useEffect, useMemo, useState } from 'react';

import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDate } from '../utils/formatLocale';

/**
 * Apprentices Act, 1961 (#1771).
 *
 * Two things get their own space because nothing else in the product can show
 * them.
 *
 * The **band** is drawn as a range with a marker, not as a number, because it is
 * a floor *and* a ceiling: engaging too many is a breach in its own right and
 * not a way to make up an earlier shortfall. A single "3 of 4 required" line
 * would imply that more is always better.
 *
 * The **headcount table** shows the same establishment counted under each
 * statute, side by side. This is the module's whole subject — an apprentice is
 * inside the section 8 base and outside the provident fund, ESI, bonus and
 * gratuity ones — and it is only visible when the numbers sit next to each
 * other. Elsewhere in the product the headcount is a single figure and there is
 * nothing to notice.
 *
 * Lapsed registrations sort to the top of the roll. They carry the retrospective
 * liability, they are usually two rows in a list of forty, and the page they are
 * buried in is the page nobody scrolls.
 */

const QUALIFICATION_LABELS = {
  SCHOOL_5_TO_9: 'School, class 5–9',
  SCHOOL_10: 'School, class 10',
  SCHOOL_12: 'School, class 12',
  NATIONAL_OR_STATE_TRADE_CERTIFICATE: 'Trade certificate',
  DIPLOMA: 'Diploma',
  DEGREE: 'Degree',
};

const STATUTE_LABELS = {
  APPRENTICES_ACT: 'Apprentices Act, section 8',
  FACTORIES_ACT: 'Factories Act, section 15',
  PROVIDENT_FUND: 'Provident fund',
  ESI: 'ESI',
  BONUS: 'Payment of Bonus Act',
  GRATUITY: 'Gratuity',
};

/** Which conventions include an apprentice, for the table's own column. */
const COUNTS_APPRENTICES = {
  APPRENTICES_ACT: true,
  FACTORIES_ACT: true,
  PROVIDENT_FUND: false,
  ESI: false,
  BONUS: false,
  GRATUITY: false,
};

const STATUTE_ORDER = [
  'APPRENTICES_ACT',
  'FACTORIES_ACT',
  'PROVIDENT_FUND',
  'ESI',
  'BONUS',
  'GRATUITY',
];

const REGISTRATION_LABELS = {
  REGISTERED: 'Registered',
  PENDING: 'Pending',
  LAPSED: 'Lapsed',
};

const REGISTRATION_TONE = {
  REGISTERED:
    'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
  PENDING:
    'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300',
  LAPSED: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
};

const FINDING_LABELS = {
  BELOW_BAND_FLOOR: 'Below the 2.5% floor',
  ABOVE_BAND_CEILING: 'Above the 15% ceiling',
  FRESHER_SUB_QUOTA_UNMET: 'The fresher sub-quota is unmet',
  STIPEND_BELOW_PRESCRIBED: 'Stipend below the Rule 11 minimum',
  REGISTRATION_LAPSED: 'A contract not registered within thirty days',
  REGISTRATION_PENDING: 'Registration still inside the window',
  NAPS_ATTENDANCE_UNMET: 'Below the attendance needed to claim NAPS',
  NOT_APPLICABLE: 'Below the thirty-worker threshold',
  HOLIDAY_DEDUCTED: 'A holiday treated as an absence',
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
    return 'You do not have permission to view the apprentice register.';
  }
  return response.data?.message || fallback;
};

const currentFinancialYear = () => {
  const now = new Date();
  return now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
};

const ApprenticeshipCompliance = () => {
  const [financialYear, setFinancialYear] = useState(currentFinancialYear());

  const [assessment, setAssessment] = useState(null);
  const [history, setHistory] = useState([]);
  const [strengthDraft, setStrengthDraft] = useState(null);
  const [showStrength, setShowStrength] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);

  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const [assessmentRes, historyRes] = await Promise.all([
        api.get('/api/apprenticeships/assessment', {
          params: { financialYear },
        }),
        api.get('/api/apprenticeships/assessments'),
      ]);

      setAssessment(assessmentRes.data || null);
      setStrengthDraft(assessmentRes.data?.composition || null);
      setHistory(
        Array.isArray(historyRes.data?.assessments)
          ? historyRes.data.assessments
          : [],
      );
    } catch (error) {
      setLoadError(
        describeError(error, 'Could not load the apprentice register.'),
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
      await api.post('/api/apprenticeships/assessments', { financialYear });
      toast('Assessment committed.', 'success');
      await load();
    } catch (error) {
      toast(describeError(error, 'Could not commit the assessment.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveStrength = async (event) => {
    event.preventDefault();
    setBusy(true);

    try {
      await api.put('/api/apprenticeships/strength', {
        directEmployees: strengthDraft?.directEmployees || 0,
        contractWorkers: strengthDraft?.contractWorkers || 0,
        casualWorkers: strengthDraft?.casualWorkers || 0,
      });
      toast('Strength recorded.', 'success');
      setShowStrength(false);
      await load();
    } catch (error) {
      toast(describeError(error, 'Could not record the strength.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const setStrengthField = (key) => (event) =>
    setStrengthDraft((previous) => ({
      ...previous,
      [key]: Number(event.target.value),
    }));

  const result = assessment?.result;
  const band = result?.band;

  /** Lapsed registrations first — they carry the liability. */
  const apprentices = useMemo(() => {
    const rows = [...(result?.apprentices || [])];

    const rank = (status) =>
      status === 'LAPSED' ? 0 : status === 'PENDING' ? 1 : 2;

    return rows.sort(
      (a, b) => rank(a.registration.status) - rank(b.registration.status),
    );
  }, [result]);

  if (loading) {
    return (
      <div className="p-4 sm:p-8">
        <p className="text-sm text-gray-500 dark:text-slate-500">
          Loading the apprentice register…
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-serif text-gray-900 dark:text-white">
            Apprentices
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-500 mt-1 max-w-2xl">
            Section 18 says an apprentice is not a worker — so the same person
            is inside the section 8 band and outside the provident fund, ESI,
            bonus and gratuity headcounts.
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
            onClick={() => setShowStrength((previous) => !previous)}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-700 text-sm text-gray-700 dark:text-slate-300"
          >
            {showStrength ? 'Hide strength' : 'Record strength'}
          </button>

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

      {assessment?.composition && !assessment.composition.recorded && (
        <div className="mb-6 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 text-sm">
          No strength has been recorded, so the band is being measured against{' '}
          {assessment.composition.directEmployees} direct employees alone.
          Section 8 counts contract and casual workers too — somebody has to
          walk the site and count them, which is what Rule 7A assumes.
        </div>
      )}

      {showStrength && strengthDraft && (
        <form
          onSubmit={saveStrength}
          className="mb-8 p-5 rounded-xl border border-gray-200 dark:border-slate-800"
        >
          <h2 className="text-lg font-serif text-gray-900 dark:text-white mb-1">
            The establishment&rsquo;s strength
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-500 mb-4 max-w-2xl">
            The denominator of the whole obligation. Reducing it by ten lowers
            the floor and can make a shortfall disappear without a single
            apprentice being engaged, so the change is audited.
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ['directEmployees', 'Direct employees'],
              ['contractWorkers', 'Contract workers'],
              ['casualWorkers', 'Casual workers'],
            ].map(([key, label]) => (
              <label
                key={key}
                className="text-sm text-gray-700 dark:text-slate-300"
              >
                {label}
                <input
                  type="number"
                  min={0}
                  value={strengthDraft[key] ?? 0}
                  onChange={setStrengthField(key)}
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
            Record
          </button>
        </form>
      )}

      {band && !band.applicable && (
        <div className="mb-8 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-sm">
          Total strength is {band.totalStrength}. The obligation to engage
          apprentices starts at {assessment.rules?.applicabilityHeadcount}.
        </div>
      )}

      {band?.applicable && (
        <div className="mb-8 p-5 rounded-xl border border-gray-200 dark:border-slate-800">
          <div className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
            <h2 className="text-lg font-serif text-gray-900 dark:text-white">
              The section 8 band
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-500">
              {band.apprentices} engaged, against {band.floor} to {band.ceiling}{' '}
              on a total strength of {band.totalStrength}
            </p>
          </div>

          {/* A range with a marker rather than a number: engaging too many is a
              breach in its own right, and "3 of 4" would imply more is better. */}
          <div className="relative h-8 rounded-lg bg-gray-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="absolute inset-y-0 bg-emerald-100 dark:bg-emerald-900/30"
              style={{
                left: `${(band.floor / Math.max(band.ceiling * 1.4, 1)) * 100}%`,
                width: `${((band.ceiling - band.floor) / Math.max(band.ceiling * 1.4, 1)) * 100}%`,
              }}
            />
            <div
              className={`absolute inset-y-0 w-1 ${
                band.withinBand ? 'bg-emerald-600' : 'bg-red-600'
              }`}
              style={{
                left: `${Math.min(99, (band.apprentices / Math.max(band.ceiling * 1.4, 1)) * 100)}%`,
              }}
            />
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-3 mt-2 text-xs text-gray-500 dark:text-slate-500">
            <span>
              Floor {band.floor} &middot; {assessment.rules?.bandFloorPercent}%
            </span>
            <span>
              Ceiling {band.ceiling} &middot;{' '}
              {assessment.rules?.bandCeilingPercent}%
            </span>
          </div>

          {band.shortfall > 0 && (
            <p className="mt-3 p-2 rounded text-xs bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">
              {band.shortfall} more apprentice
              {band.shortfall === 1 ? '' : 's'} must be engaged to reach the
              floor.
            </p>
          )}

          {band.excess > 0 && (
            <p className="mt-3 p-2 rounded text-xs bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">
              {band.excess} beyond the ceiling. This is a breach in its own
              right, not a way to make up an earlier shortfall.
            </p>
          )}
        </div>
      )}

      {result?.strength && (
        <div className="mb-8">
          <h2 className="text-lg font-serif text-gray-900 dark:text-white mb-1">
            The same establishment, counted six ways
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-500 mb-3 max-w-2xl">
            The numbers differ because the statutes do. Elsewhere in the product
            a headcount is one figure, and there is nothing to notice.
          </p>

          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-900/40 text-left">
                <tr className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
                  <th className="p-3">Statute</th>
                  <th className="p-3">Apprentices counted</th>
                  <th className="p-3 text-right">Strength</th>
                </tr>
              </thead>
              <tbody>
                {STATUTE_ORDER.filter(
                  (statute) => result.strength[statute] !== undefined,
                ).map((statute) => (
                  <tr
                    key={statute}
                    className="border-t border-gray-100 dark:border-slate-800/60"
                  >
                    <td className="p-3 text-gray-900 dark:text-white">
                      {STATUTE_LABELS[statute]}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          COUNTS_APPRENTICES[statute]
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                            : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-500'
                        }`}
                      >
                        {COUNTS_APPRENTICES[statute] ? 'yes' : 'no'}
                      </span>
                    </td>
                    <td className="p-3 text-right text-gray-900 dark:text-white">
                      {result.strength[statute]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <div className="p-4 rounded-xl border border-gray-200 dark:border-slate-800">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
                Registered
              </p>
              <p className="text-2xl font-serif text-gray-900 dark:text-white mt-1">
                {result.registeredCount}
                <span className="text-base text-gray-400 dark:text-slate-600">
                  {' '}
                  / {result.apprenticeCount}
                </span>
              </p>
            </div>

            <div className="p-4 rounded-xl border border-gray-200 dark:border-slate-800">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
                Stipend shortfall
              </p>
              <p className="text-2xl font-serif text-gray-900 dark:text-white mt-1">
                {formatCurrency(result.stipendShortfall)}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                Against the Rule 11 prescribed minimums.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-gray-200 dark:border-slate-800">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
                NAPS receivable
              </p>
              <p className="text-2xl font-serif text-emerald-700 dark:text-emerald-300 mt-1">
                {formatCurrency(result.reimbursementReceivable)}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                A receivable, not a discount on the stipend.
              </p>
            </div>

            <div
              className={`p-4 rounded-xl border ${
                result.exposure > 0
                  ? 'border-orange-300 dark:border-orange-900/50 bg-orange-50 dark:bg-orange-900/20'
                  : 'border-gray-200 dark:border-slate-800'
              }`}
            >
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
                Unregistered exposure
              </p>
              <p
                className={`text-2xl font-serif mt-1 ${
                  result.exposure > 0
                    ? 'text-orange-800 dark:text-orange-200'
                    : 'text-gray-900 dark:text-white'
                }`}
              >
                {formatCurrency(result.exposure)}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                {result.lapsedCount} contract
                {result.lapsedCount === 1 ? '' : 's'} past the thirty days.
              </p>
            </div>
          </div>

          <h2 className="text-lg font-serif text-gray-900 dark:text-white mb-3">
            The roll
          </h2>

          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800 mb-8">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-900/40 text-left">
                <tr className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
                  <th className="p-3">Apprentice</th>
                  <th className="p-3">Qualification</th>
                  <th className="p-3">Registration</th>
                  <th className="p-3 text-right">Stipend paid</th>
                  <th className="p-3 text-right">Shortfall</th>
                  <th className="p-3 text-right">NAPS</th>
                  <th className="p-3 text-right">Exposure</th>
                </tr>
              </thead>
              <tbody>
                {apprentices.map((entry) => (
                  <tr
                    key={String(entry.apprenticeId)}
                    className="border-t border-gray-100 dark:border-slate-800/60"
                  >
                    <td className="p-3 text-gray-900 dark:text-white">
                      {entry.name}
                      {entry.isFresher && (
                        <span className="block text-xs text-gray-400 dark:text-slate-600">
                          fresher
                        </span>
                      )}
                    </td>

                    <td className="p-3 text-gray-700 dark:text-slate-300">
                      {QUALIFICATION_LABELS[entry.qualification] ||
                        entry.qualification}
                    </td>

                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded text-xs whitespace-nowrap ${REGISTRATION_TONE[entry.registration.status]}`}
                      >
                        {REGISTRATION_LABELS[entry.registration.status]}
                      </span>
                      {entry.registration.dueBy && (
                        <span className="block text-xs text-gray-400 dark:text-slate-600 mt-0.5">
                          due {formatDate(entry.registration.dueBy)}
                          {entry.registration.daysLate > 0 &&
                            ` · ${entry.registration.daysLate}d late`}
                        </span>
                      )}
                    </td>

                    <td className="p-3 text-right text-gray-700 dark:text-slate-300 whitespace-nowrap">
                      {formatCurrency(entry.stipendPaid)}
                    </td>

                    <td className="p-3 text-right whitespace-nowrap">
                      {entry.stipendShortfall > 0 ? (
                        <span className="text-red-600 dark:text-red-400">
                          {formatCurrency(entry.stipendShortfall)}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-slate-700">
                          —
                        </span>
                      )}
                    </td>

                    <td className="p-3 text-right text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                      {entry.reimbursement > 0
                        ? formatCurrency(entry.reimbursement)
                        : '—'}
                    </td>

                    <td className="p-3 text-right whitespace-nowrap">
                      {entry.exposure ? (
                        <span
                          className="text-orange-700 dark:text-orange-300"
                          title={`PF ${entry.exposure.providentFund}, ESI ${entry.exposure.esi}, bonus ${entry.exposure.bonus}, gratuity ${entry.exposure.gratuity}`}
                        >
                          {formatCurrency(entry.exposure.total)}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-slate-700">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))}

                {apprentices.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="p-6 text-center text-sm text-gray-500 dark:text-slate-500"
                    >
                      No apprentices on the roll for this year.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {result.summary.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-serif text-gray-900 dark:text-white mb-3">
                Findings
              </h2>
              <div className="flex flex-wrap gap-2">
                {result.summary.map((entry) => (
                  <span
                    key={entry.code}
                    className={`px-3 py-1.5 rounded-lg text-xs ${SEVERITY_TONE[entry.severity]}`}
                  >
                    {FINDING_LABELS[entry.code] || entry.code}
                    {entry.apprenticeCount > 0 &&
                      ` · ${entry.apprenticeCount} apprentice${entry.apprenticeCount === 1 ? '' : 's'}`}{' '}
                    · {entry.section}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <h2 className="text-lg font-serif text-gray-900 dark:text-white mb-3">
        Committed assessments
      </h2>

      <div className="rounded-xl border border-gray-200 dark:border-slate-800 divide-y divide-gray-100 dark:divide-slate-800/60">
        {history.map((entry) => (
          <div
            key={entry._id}
            className="p-3 flex flex-wrap items-baseline justify-between gap-3"
          >
            <div>
              <p className="text-sm text-gray-900 dark:text-white">
                {formatDate(entry.periodStart)} &ndash;{' '}
                {formatDate(entry.periodEnd)}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-500">
                {entry.apprenticeCount} apprentices on a strength of{' '}
                {entry.totalStrength}
                {entry.shortfall > 0 && ` · ${entry.shortfall} short`}
              </p>
            </div>

            {entry.exposure > 0 && (
              <span className="text-sm text-orange-700 dark:text-orange-300">
                {formatCurrency(entry.exposure)} exposed
              </span>
            )}
          </div>
        ))}

        {history.length === 0 && (
          <p className="p-6 text-center text-sm text-gray-500 dark:text-slate-500">
            No assessment has been committed yet.
          </p>
        )}
      </div>
    </div>
  );
};

export default ApprenticeshipCompliance;
