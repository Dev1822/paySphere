import { useCallback, useEffect, useMemo, useState } from 'react';

import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatDate } from '../utils/formatLocale';

/**
 * Child and Adolescent Labour Act, 1986 (#1877).
 *
 * **There is no currency on this page, anywhere, and that is the design.**
 *
 * An underage engagement has no compensable amount. Section 14's punishment is
 * imprisonment and a fine on conviction — a criminal penalty rather than a
 * liability that accrues — and it is not a price for the engagement. A rupee
 * figure here would be read as one, and would end up in a compliance provision
 * alongside a PF arrear. So every number on this page is a count of people, a
 * count of occurrences, or a duration in minutes.
 *
 * The page **leads with the prohibited engagements as a blocking banner**, not
 * as a row in a table. A child on the payroll and an adolescent who worked a
 * seven-hour day are both findings, and sorting them together by date would put
 * them side by side — but only one of the two has a lawful version. The banner
 * says how many people, and it does not offer a way to dismiss it.
 *
 * Below that the section 7 roster, where the numbers are **minutes against a
 * limit**. The six-hour ceiling is inclusive of the interval, which is the part
 * that catches people out: six hours of work plus the one-hour interval the Act
 * requires is a seven-hour day and is over. The bar drawn on each day shows the
 * span from first start to last end rather than the sum of the spells, because
 * that is what the ceiling measures.
 *
 * The **overtime line** is a sentence and not a figure. `workingHoursCompliance`
 * answers an excess hour with the section 59 double rate; section 7(4)
 * prohibits overtime for a young person outright, and the page says so in words
 * where a reader would otherwise look for an amount.
 */

const CLASSIFICATION_LABELS = {
  CHILD: 'Child — under 14',
  ADOLESCENT: 'Adolescent — 14 to under 18',
  ADULT: '18 or above',
};

const CLASSIFICATION_TONE = {
  CHILD: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
  ADOLESCENT:
    'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300',
  ADULT: 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300',
};

const FINDING_LABELS = {
  CHILD_EMPLOYED: 'A child is engaged',
  CHILD_EXCEPTION_UNEVIDENCED: 'A section 3 exception with nothing behind it',
  CHILD_EXCEPTION_SCHOOLING: 'The work interferes with schooling',
  ADOLESCENT_IN_HAZARDOUS_OCCUPATION:
    'An adolescent in a Schedule occupation or process',
  SPELL_EXCEEDS_LIMIT: 'A spell longer than three hours',
  INTERVAL_SHORT: 'An interval shorter than an hour',
  DAY_EXCEEDS_LIMIT: 'A day longer than six hours including the interval',
  NIGHT_WORK: 'Work between 7 p.m. and 8 a.m.',
  OVERTIME_WORKED: 'Overtime, which section 7(4) prohibits outright',
  NO_WEEKLY_DAY_OFF: 'No whole day off in the week',
  DAY_OFF_CHANGED_TOO_OFTEN: 'The notified day off moved more than once',
  AGE_BASIS_WEAK: 'The age rests on a self-declaration',
  NOT_IN_REGISTER: 'Not on the section 11 register',
  TURNS_EIGHTEEN_IN_PERIOD: 'Turns eighteen — the limits fall away then',
  NO_DATE_OF_BIRTH: 'No date of birth on record',
};

const SEVERITY_TONE = {
  PROHIBITED:
    'bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-200 border-red-300 dark:border-red-800',
  BREACH:
    'bg-orange-50 dark:bg-orange-900/20 text-orange-900 dark:text-orange-300 border-orange-200 dark:border-orange-900',
  INFORMATIONAL:
    'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-900',
};

const AGE_BASIS_LABELS = {
  SELF_DECLARED: 'Self-declared',
  AADHAAR: 'Aadhaar',
  SCHOOL_CERTIFICATE: 'School certificate',
  BIRTH_CERTIFICATE: 'Birth certificate',
  MEDICAL_CERTIFICATE: 'Section 10 medical certificate',
};

const describeError = (error, fallback) => {
  const response = error?.response;
  if (!response) return 'Could not reach the server. Check your connection.';
  if (response.status === 403) {
    return 'You do not have permission to view the young persons register.';
  }
  return response.data?.message || fallback;
};

const hoursAndMinutes = (minutes) => {
  const total = Math.max(0, Number(minutes) || 0);
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
};

/**
 * Minutes against the section 7 ceiling.
 *
 * A bar rather than a number because the inclusive ceiling is the thing people
 * misread: the filled part is the span from first start to last end, which is
 * what the six hours measures, and the overflow is drawn past the line rather
 * than clipped so a seven-hour day looks like one.
 */
const DayBar = ({ minutes, limitMinutes }) => {
  const limit = Math.max(1, Number(limitMinutes) || 360);
  const worked = Math.max(0, Number(minutes) || 0);
  const within = Math.min(worked, limit);
  const over = Math.max(0, worked - limit);

  const pct = (value) => `${Math.min(100, (value / limit) * 100)}%`;

  return (
    <div className="min-w-[160px]">
      <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100 dark:bg-slate-800">
        <div
          className="bg-indigo-500 dark:bg-indigo-400"
          style={{ width: pct(within) }}
          title={`${hoursAndMinutes(within)} within the ceiling`}
        />
        {over > 0 && (
          <div
            className="bg-red-500 dark:bg-red-400"
            style={{ width: pct(over) }}
            title={`${hoursAndMinutes(over)} beyond it`}
          />
        )}
      </div>
      <p className="text-[11px] text-gray-500 dark:text-slate-500 mt-1">
        {hoursAndMinutes(worked)} of {hoursAndMinutes(limit)} inclusive
      </p>
    </div>
  );
};

const YoungPersonsRegister = () => {
  const [establishment, setEstablishment] = useState('');

  const [assessment, setAssessment] = useState(null);
  const [rules, setRules] = useState(null);
  const [ageRecords, setAgeRecords] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);

  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const [assessmentRes, rulesRes, ageRes] = await Promise.all([
        api.get('/api/young-persons/assessment', {
          params: { establishment },
        }),
        api.get('/api/young-persons/rules'),
        api.get('/api/young-persons/age-records'),
      ]);

      setAssessment(assessmentRes.data || null);
      setRules(rulesRes.data || null);
      setAgeRecords(
        Array.isArray(ageRes.data?.records) ? ageRes.data.records : [],
      );
    } catch (error) {
      setLoadError(
        describeError(error, 'Could not load the young persons register.'),
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
      await api.post('/api/young-persons/assessments', { establishment });
      toast('Assessment committed.', 'success');
      await load();
    } catch (error) {
      toast(describeError(error, 'Could not commit the assessment.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const result = assessment?.result;

  /** People with a prohibited finding first, then a breach, then the rest. */
  const people = useMemo(() => {
    const rank = (person) => {
      const severities = (person.findings || []).map((row) => row.severity);
      if (severities.includes('PROHIBITED')) return 0;
      if (severities.includes('BREACH')) return 1;
      return 2;
    };

    return [...(result?.people || [])].sort((a, b) => rank(a) - rank(b));
  }, [result]);

  const prohibited = result?.prohibited || [];

  const prohibitedPeople = useMemo(
    () => new Set(prohibited.map((finding) => String(finding.personId))).size,
    [prohibited],
  );

  const dayLimitMinutes = (rules?.rules?.maxDayHoursInclusive || 6) * 60;

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-72 bg-gray-200 dark:bg-slate-800 rounded" />
          <div className="h-24 bg-gray-200 dark:bg-slate-800 rounded-xl" />
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
            Children and adolescents
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-2xl">
            Section 3 bars a child from any occupation; section 3A bars an
            adolescent from the Schedule; section 7 sets the hours for those who
            may be engaged. These are not the Factories Act limits.
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
              placeholder="Blank for the default"
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm w-56"
            />
          </label>

          <button
            type="button"
            onClick={commit}
            disabled={busy || !people.length}
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
        A banner rather than a row, with no dismiss. These findings have no
        lawful version, and putting them in the table would let them sort next
        to an adolescent who worked a long day.
      */}
      {prohibited.length > 0 && (
        <div className="rounded-xl border-2 border-red-400 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-5">
          <p className="text-xs uppercase tracking-wide text-red-800 dark:text-red-300">
            Prohibited engagements
          </p>
          <p className="text-2xl font-semibold text-red-900 dark:text-red-200 mt-1">
            {prohibitedPeople} {prohibitedPeople === 1 ? 'person' : 'people'}
          </p>
          <ul className="mt-3 space-y-1.5">
            {prohibited.map((finding, index) => (
              <li
                key={`${finding.personId}-${finding.code}-${index}`}
                className="text-sm text-red-800 dark:text-red-300"
              >
                <span className="font-medium">{finding.name || 'Unnamed'}</span>{' '}
                — {FINDING_LABELS[finding.code] || finding.code}
                <span className="opacity-70"> · {finding.section}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-red-800 dark:text-red-300 mt-3 max-w-3xl">
            There is no permitted variant of these engagements and no amount
            attached to them. Section 14&rsquo;s punishment is imprisonment and
            a fine on conviction — a criminal penalty, not a cost this page can
            state.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
            Children engaged
          </p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">
            {result?.childrenEngaged ?? 0}
          </p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            Under fourteen. Section 3 bars any occupation or process.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
            Adolescents engaged
          </p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">
            {result?.adolescentsEngaged ?? 0}
          </p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            Fourteen to under eighteen. Permitted outside the Schedule, under
            section 7.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
            Overtime
          </p>
          <p className="text-base font-medium text-gray-900 dark:text-white mt-1">
            Prohibited
          </p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            Section 7(4). The section 59 double rate does not apply — there is
            no rate at which the hour becomes lawful.
          </p>
        </div>
      </div>

      <section className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-800">
          <h2 className="text-sm font-medium text-gray-900 dark:text-white">
            Register
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Classification is computed as at today. Somebody engaged lawfully as
            an adolescent turns eighteen during their employment and the limits
            fall away on that day.
          </p>
        </div>

        {people.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-500 dark:text-slate-400">
            No age record exists yet. An empty register is not an establishment
            with no young persons — it is an establishment nobody has checked.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-800/50 text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
                <tr>
                  <th className="text-left px-5 py-2">Person</th>
                  <th className="text-left px-5 py-2">Classification</th>
                  <th className="text-left px-5 py-2">Age rests on</th>
                  <th className="text-left px-5 py-2">Findings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {people.map((person) => (
                  <tr key={String(person.personId)}>
                    <td className="px-5 py-3">
                      <p className="text-gray-900 dark:text-white font-medium">
                        {person.name || 'Unnamed'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        Born {formatDate(person.dateOfBirth)}
                        {person.ageYears !== null &&
                          ` · ${person.ageYears} years`}
                      </p>
                    </td>

                    <td className="px-5 py-3">
                      <span
                        className={`inline-block px-2 py-1 rounded text-[11px] ${
                          CLASSIFICATION_TONE[person.classification] ||
                          CLASSIFICATION_TONE.ADULT
                        }`}
                      >
                        {CLASSIFICATION_LABELS[person.classification] ||
                          'Not determinable'}
                      </span>
                    </td>

                    <td className="px-5 py-3 text-gray-700 dark:text-slate-300">
                      {AGE_BASIS_LABELS[person.ageBasis] || person.ageBasis}
                    </td>

                    <td className="px-5 py-3">
                      <div className="space-y-1.5">
                        {(person.findings || []).map((finding, index) => (
                          <div
                            key={`${person.personId}-${finding.code}-${index}`}
                            className={`px-2 py-1 rounded border text-[11px] ${
                              SEVERITY_TONE[finding.severity] ||
                              SEVERITY_TONE.INFORMATIONAL
                            }`}
                          >
                            <span className="font-medium">
                              {FINDING_LABELS[finding.code] || finding.code}
                            </span>
                            <span className="opacity-70">
                              {' '}
                              · {finding.section}
                            </span>
                            {finding.minutes != null &&
                              finding.limitMinutes != null && (
                                <div className="mt-1">
                                  <DayBar
                                    minutes={finding.minutes}
                                    limitMinutes={finding.limitMinutes}
                                  />
                                </div>
                              )}
                          </div>
                        ))}
                        {(person.findings || []).length === 0 && (
                          <span className="text-gray-400 dark:text-slate-600">
                            —
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
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
                className={`flex flex-wrap items-center justify-between gap-3 px-3 py-2 rounded border text-sm ${
                  SEVERITY_TONE[row.severity] || SEVERITY_TONE.INFORMATIONAL
                }`}
              >
                <span>
                  {FINDING_LABELS[row.code] || row.code}
                  <span className="opacity-70"> · {row.section}</span>
                </span>
                <span>
                  {row.personCount}{' '}
                  {row.personCount === 1 ? 'person' : 'people'} · {row.count}{' '}
                  {row.count === 1 ? 'occurrence' : 'occurrences'}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-3">
            Counts of people and occurrences. Nothing on this page is a currency
            figure, and nothing here belongs in a compliance provision.
          </p>
        </section>
      )}

      <section className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
        <h2 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
          Section 7 limits in force
        </h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div>
            <dt className="text-xs text-gray-500 dark:text-slate-400">
              Longest spell
            </dt>
            <dd className="text-gray-900 dark:text-white">
              {rules?.rules?.maxSpellHours ?? 3} hours
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-slate-400">
              Interval after a spell
            </dt>
            <dd className="text-gray-900 dark:text-white">
              {rules?.rules?.minIntervalHours ?? 1} hour
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-slate-400">
              Day, including the interval
            </dt>
            <dd className="text-gray-900 dark:text-white">
              {hoursAndMinutes(dayLimitMinutes)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-slate-400">
              No work between
            </dt>
            <dd className="text-gray-900 dark:text-white">
              {rules?.rules?.nightBarFromHour ?? 19}:00 and{' '}
              {String(rules?.rules?.nightBarToHour ?? 8).padStart(2, '0')}:00
            </dd>
          </div>
        </dl>

        {rules?.schedule && (
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-4">
            Schedule as it stands from {rules.schedule.effectiveFrom}:{' '}
            {rules.schedule.occupations?.join(', ').toLowerCase()}, and the
            hazardous processes incorporated from the{' '}
            {rules.schedule.processesReference}.
          </p>
        )}
      </section>
    </div>
  );
};

export default YoungPersonsRegister;
