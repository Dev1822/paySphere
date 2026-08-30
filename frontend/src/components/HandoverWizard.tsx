import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import api from '../services/api';

type HandoverStatus =
  | 'In Progress'
  | 'Pending Manager Review'
  | 'Pending IT Review'
  | 'Cleared'
  | 'Blocked';

type KnowledgeTransfer = {
  _id: string;
  title: string;
  description?: string;
  category:
    | 'Code Repository'
    | 'Client Contact'
    | 'Process Document'
    | 'Credentials'
    | 'Other';
  link?: string;
  attachmentUrl?: string;
  isMandatory: boolean;
  isCompleted: boolean;
  completedAt?: string | null;
};

type AssetRecovery = {
  _id: string;
  assetName: string;
  assetTag?: string;
  condition: 'Pending Return' | 'Returned Good' | 'Returned Damaged' | 'Lost';
  recoveryNotes?: string;
  recoveredAt?: string | null;
  payrollDeduction?: number;
};

type AccessRevocation = {
  _id: string;
  systemName: string;
  accessLevel?: string;
  isRevoked: boolean;
  revokedAt?: string | null;
};

export type HandoverPlan = {
  _id: string;
  employeeId: string;
  exitDate: string;
  knowledgeTransfers: KnowledgeTransfer[];
  assetRecoveries: AssetRecovery[];
  accessRevocations: AccessRevocation[];
  employeeSignOff: boolean;
  managerSignOff: boolean;
  managerSignOffDate?: string | null;
  managerRemarks?: string;
  itSignOff: boolean;
  itSignOffDate?: string | null;
  clearanceScore: number;
  status: HandoverStatus;
  isFnFBlocked: boolean;
};

type Employee = {
  _id: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  role?: string;
};

export type HandoverWizardProps = {
  initialPlan?: HandoverPlan | null;
  onComplete?: (plan: HandoverPlan) => void;
};

type ApiError = {
  response?: { data?: { message?: string } };
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  const apiError = error as ApiError;
  return apiError.response?.data?.message || fallback;
};

const employeeName = (employee: Employee): string =>
  employee.fullName ||
  [employee.firstName, employee.lastName].filter(Boolean).join(' ') ||
  'Unnamed employee';

const today = (): string => new Date().toISOString().slice(0, 10);

export default function HandoverWizard({
  initialPlan = null,
  onComplete,
}: HandoverWizardProps) {
  const [step, setStep] = useState(1);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState(initialPlan?.employeeId ?? '');
  const [exitDate, setExitDate] = useState(
    initialPlan?.exitDate ? initialPlan.exitDate.slice(0, 10) : today(),
  );
  const [plan, setPlan] = useState<HandoverPlan | null>(initialPlan);
  const [loading, setLoading] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [error, setError] = useState('');
  const [remarks, setRemarks] = useState(initialPlan?.managerRemarks ?? '');
  const [success, setSuccess] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!initialPlan) {
      setLoadingEmployees(true);
      api
        .get('/api/employees')
        .then((response) => {
          setEmployees((response.data?.employees ?? []) as Employee[]);
        })
        .catch((requestError: unknown) => {
          setError(getErrorMessage(requestError, 'Unable to load employees.'));
        })
        .finally(() => setLoadingEmployees(false));
    }
  }, [initialPlan]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step, success]);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee._id === employeeId),
    [employees, employeeId],
  );

  const progress = plan?.clearanceScore ?? 0;
  const canNext = Boolean(plan || (employeeId && exitDate));

  const updatePlan = async (
    request: Promise<{ data?: { plan?: HandoverPlan } }>,
    fallback: string,
  ) => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await request;
      if (response.data?.plan) {
        setPlan(response.data.plan);
        onComplete?.(response.data.plan);
      }
      setSuccess('Handover plan updated.');
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError, fallback));
    } finally {
      setLoading(false);
    }
  };

  const initiatePlan = async () => {
    if (!employeeId || !exitDate) return;
    await updatePlan(
      api.post('/api/handover/initiate', { employeeId, exitDate }),
      'Unable to initiate the handover plan.',
    );
  };

  const toggleKnowledgeTransfer = async (item: KnowledgeTransfer) => {
    if (!plan) return;
    await updatePlan(
      api.patch('/api/handover/knowledge-transfer', {
        planId: plan._id,
        ktId: item._id,
        isCompleted: !item.isCompleted,
      }),
      'Unable to update the knowledge-transfer task.',
    );
  };

  const updateAsset = async (
    item: AssetRecovery,
    condition: AssetRecovery['condition'],
  ) => {
    if (!plan) return;
    await updatePlan(
      api.patch('/api/handover/asset-recovery', {
        planId: plan._id,
        assetId: item._id,
        condition,
        recoveryNotes: item.recoveryNotes ?? '',
        payrollDeduction: item.payrollDeduction ?? 0,
      }),
      'Unable to update the asset-recovery item.',
    );
  };

  const revokeAccess = async (item: AccessRevocation) => {
    if (!plan || item.isRevoked) return;
    await updatePlan(
      api.patch('/api/handover/revoke-access', {
        planId: plan._id,
        accessId: item._id,
      }),
      'Unable to revoke this system access.',
    );
  };

  const signOff = async () => {
    if (!plan) return;
    await updatePlan(
      api.post('/api/handover/manager-signoff', {
        planId: plan._id,
        remarks: remarks.trim(),
      }),
      'Unable to record manager sign-off.',
    );
  };

  const generateCertificate = async () => {
    if (!plan || plan.clearanceScore < 100) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await api.post(`/api/handover/${plan._id}/certificate`);
      setSuccess(
        response.data?.message ||
          'Clearance certificate generated successfully.',
      );
    } catch (requestError: unknown) {
      setError(
        getErrorMessage(
          requestError,
          'Unable to generate the clearance certificate.',
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  const next = () => setStep((current) => Math.min(5, current + 1));
  const back = () => setStep((current) => Math.max(1, current - 1));

  const stepTitle = [
    'Start handover',
    'Knowledge transfer',
    'Asset recovery',
    'Access revocation',
    'Review & sign off',
  ][step - 1];

  if (success && !plan) {
    return (
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-green-200 bg-green-50 p-6 text-green-900">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-xl font-bold outline-none"
        >
          Handover started
        </h2>
        <p className="mt-2">{success}</p>
        <button
          type="button"
          className="mt-4 rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white"
          onClick={() => setSuccess('')}
        >
          Continue
        </button>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-5xl rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
      <header className="mb-6">
        <p className="text-xs font-bold uppercase tracking-wider text-brand-600">
          Offboarding
        </p>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-1 text-2xl font-bold text-gray-900 outline-none dark:text-white"
        >
          Handover Wizard
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          Complete knowledge transfer, asset recovery and access clearance
          before final settlement.
        </p>
      </header>

      <ol className="mb-6 grid grid-cols-5 gap-1" aria-label="Handover steps">
        {['Start', 'Knowledge', 'Assets', 'Access', 'Review'].map(
          (label, index) => {
            const number = index + 1;
            const active = number === step;
            const complete = number < step;
            return (
              <li key={label}>
                <button
                  type="button"
                  aria-current={active ? 'step' : undefined}
                  onClick={() => number <= (plan ? step : 1) && setStep(number)}
                  className={`w-full rounded-lg px-2 py-2 text-xs font-semibold ${
                    active
                      ? 'bg-brand-600 text-white'
                      : complete
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {number}. {label}
                </button>
              </li>
            );
          },
        )}
      </ol>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}
      {success && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700"
        >
          {success}
        </div>
      )}

      {step === 1 && !plan && (
        <div className="space-y-5">
          <div>
            <label
              htmlFor="handover-employee"
              className="mb-1 block text-sm font-semibold text-gray-700 dark:text-slate-300"
            >
              Employee
            </label>
            <select
              id="handover-employee"
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
              disabled={loadingEmployees || loading}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">
                {loadingEmployees ? 'Loading employees...' : 'Select employee'}
              </option>
              {employees.map((employee) => (
                <option key={employee._id} value={employee._id}>
                  {employeeName(employee)}
                </option>
              ))}
            </select>
            {selectedEmployee && (
              <p className="mt-1 text-xs text-gray-500">
                {selectedEmployee.department || 'Department not specified'} ·{' '}
                {selectedEmployee.role || 'Role not specified'}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="handover-exit-date"
              className="mb-1 block text-sm font-semibold text-gray-700 dark:text-slate-300"
            >
              Exit date
            </label>
            <input
              id="handover-exit-date"
              type="date"
              value={exitDate}
              min={today()}
              onChange={(event) => setExitDate(event.target.value)}
              disabled={loading}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <button
            type="button"
            disabled={!canNext || loading}
            onClick={initiatePlan}
            className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Starting...' : 'Start handover'}
          </button>
        </div>
      )}

      {plan && step === 1 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Summary
            label="Employee"
            value={
              selectedEmployee
                ? employeeName(selectedEmployee)
                : plan.employeeId
            }
          />
          <Summary
            label="Exit date"
            value={new Date(plan.exitDate).toLocaleDateString()}
          />
          <Summary label="Status" value={plan.status} />
        </div>
      )}

      {plan && step === 2 && (
        <TaskList
          title="Knowledge transfer"
          empty="No knowledge-transfer tasks assigned."
          items={plan.knowledgeTransfers}
          render={(item) => (
            <TaskRow
              key={item._id}
              title={item.title}
              description={item.description}
              required={item.isMandatory}
              completed={item.isCompleted}
              onToggle={() => toggleKnowledgeTransfer(item)}
              disabled={loading}
            />
          )}
        />
      )}

      {plan && step === 3 && (
        <TaskList
          title="Asset recovery"
          empty="No physical assets assigned."
          items={plan.assetRecoveries}
          render={(item) => (
            <div
              key={item._id}
              className="rounded-xl border border-gray-200 p-4 dark:border-slate-700"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {item.assetName}
                  </h3>
                  {item.assetTag && (
                    <p className="text-xs text-gray-500">
                      Tag: {item.assetTag}
                    </p>
                  )}
                </div>
                <select
                  value={item.condition}
                  disabled={loading}
                  onChange={(event) =>
                    updateAsset(
                      item,
                      event.target.value as AssetRecovery['condition'],
                    )
                  }
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  aria-label={`Condition for ${item.assetName}`}
                >
                  <option>Pending Return</option>
                  <option>Returned Good</option>
                  <option>Returned Damaged</option>
                  <option>Lost</option>
                </select>
              </div>
            </div>
          )}
        />
      )}

      {plan && step === 4 && (
        <TaskList
          title="Access revocation"
          empty="No access-revocation tasks assigned."
          items={plan.accessRevocations}
          render={(item) => (
            <div
              key={item._id}
              className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 p-4 dark:border-slate-700"
            >
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {item.systemName}
                </h3>
                <p className="text-xs text-gray-500">
                  {item.accessLevel || 'Standard'} access
                </p>
              </div>
              <button
                type="button"
                disabled={item.isRevoked || loading}
                onClick={() => revokeAccess(item)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                  item.isRevoked
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                    : 'bg-red-600 text-white disabled:opacity-50'
                }`}
              >
                {item.isRevoked ? 'Revoked' : 'Revoke access'}
              </button>
            </div>
          )}
        />
      )}

      {plan && step === 5 && (
        <div className="space-y-6">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-bold text-gray-900 dark:text-white">
                Clearance progress
              </h2>
              <strong
                className={
                  progress === 100 ? 'text-green-600' : 'text-brand-600'
                }
              >
                {progress}%
              </strong>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-gray-200 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-brand-600 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Summary
              label="Knowledge transfer"
              value={`${plan.knowledgeTransfers.filter((item) => item.isCompleted).length}/${plan.knowledgeTransfers.length} complete`}
            />
            <Summary
              label="Asset recovery"
              value={`${plan.assetRecoveries.filter((item) => item.condition !== 'Pending Return').length}/${plan.assetRecoveries.length} resolved`}
            />
            <Summary
              label="IT access"
              value={`${plan.accessRevocations.filter((item) => item.isRevoked).length}/${plan.accessRevocations.length} revoked`}
            />
            <Summary
              label="F&F status"
              value={plan.isFnFBlocked ? 'Blocked' : 'Eligible'}
            />
          </div>

          <div>
            <label
              htmlFor="manager-remarks"
              className="mb-1 block text-sm font-semibold text-gray-700 dark:text-slate-300"
            >
              Manager remarks
            </label>
            <textarea
              id="manager-remarks"
              rows={4}
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              disabled={loading || plan.managerSignOff}
              placeholder="Add final handover remarks..."
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            {!plan.managerSignOff && (
              <button
                type="button"
                disabled={loading}
                onClick={signOff}
                className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Record manager sign-off'}
              </button>
            )}
            {plan.clearanceScore === 100 && (
              <button
                type="button"
                disabled={loading}
                onClick={generateCertificate}
                className="rounded-lg border border-brand-600 px-4 py-2.5 text-sm font-semibold text-brand-700 disabled:opacity-50 dark:text-brand-300"
              >
                Generate clearance certificate
              </button>
            )}
          </div>

          <p
            className={`text-sm font-semibold ${plan.isFnFBlocked ? 'text-red-600' : 'text-green-600'}`}
          >
            {plan.isFnFBlocked
              ? 'Full & Final settlement remains blocked until mandatory clearance requirements are satisfied.'
              : 'Full & Final settlement is eligible to proceed.'}
          </p>
        </div>
      )}

      {plan && (
        <footer className="mt-8 flex justify-between border-t border-gray-200 pt-5 dark:border-slate-700">
          <button
            type="button"
            onClick={back}
            disabled={step === 1 || loading}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
          >
            Back
          </button>
          <button
            type="button"
            onClick={next}
            disabled={step === 5 || loading}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-gray-900"
          >
            Next
          </button>
        </footer>
      )}
    </section>
  );
}

type SummaryProps = { label: string; value: string };

function Summary({ label, value }: SummaryProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-800">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-1 font-semibold text-gray-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}

type TaskListProps<T> = {
  title: string;
  empty: string;
  items: T[];
  render: (item: T) => ReactNode;
};

function TaskList<T>({ title, empty, items, render }: TaskListProps<T>) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">
        {title}
      </h2>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-slate-700">
          {empty}
        </p>
      ) : (
        items.map(render)
      )}
    </div>
  );
}

type TaskRowProps = {
  title: string;
  description?: string;
  required: boolean;
  completed: boolean;
  disabled: boolean;
  onToggle: () => void;
};

function TaskRow({
  title,
  description,
  required,
  completed,
  disabled,
  onToggle,
}: TaskRowProps) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-gray-200 p-4 dark:border-slate-700">
      <button
        type="button"
        aria-label={`${completed ? 'Mark incomplete' : 'Complete'} ${title}`}
        aria-pressed={completed}
        disabled={disabled}
        onClick={onToggle}
        className={`mt-0.5 h-6 w-6 shrink-0 rounded-full border-2 ${
          completed
            ? 'border-green-500 bg-green-500 text-white'
            : 'border-gray-400 bg-white dark:bg-slate-800'
        }`}
      >
        {completed ? '✓' : ''}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3
            className={`font-semibold ${completed ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}
          >
            {title}
          </h3>
          {required && (
            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-800 dark:bg-red-900/30 dark:text-red-300">
              MANDATORY
            </span>
          )}
        </div>
        {description && (
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        )}
      </div>
    </div>
  );
}
