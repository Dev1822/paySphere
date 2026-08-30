import { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Pagination from '../components/common/Pagination';
import SettlementsSkeleton from '../components/common/skeleton/SettlementsSkeleton';
import api from '../services/api';
import { formatCurrency, formatDate } from '../utils/formatLocale';
import { useToast } from '../context/ToastContext';
import HandoverWizard from '../components/handover/HandoverWizard';

const STATUS_LABELS = {
  draft: 'Draft',
  pending_approval: 'Pending approval',
  approved: 'Approved',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

const STATUS_STYLES = {
  draft: 'bg-gray-200 text-gray-700 dark:bg-slate-800 dark:text-slate-300',
  pending_approval:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

const EXIT_TYPES = [
  { value: 'resignation', label: 'Resignation' },
  { value: 'termination', label: 'Termination' },
  { value: 'retirement', label: 'Retirement' },
  { value: 'end_of_contract', label: 'End of contract' },
];


const describeError = (error, fallback) => {
  const response = error?.response;
  if (!response) return 'Could not reach the server.';

  const data = response.data || {};
  if (Array.isArray(data.errors) && data.errors.length > 0) {
    return data.errors.join('; ');
  }
  if (response.status === 403) {
    return 'You do not have permission to manage settlements.';
  }
  return data.message || fallback;
};

const Settlements = () => {
  const [settlements, setSettlements] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [showHandoverWizard, setShowHandoverWizard] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 10;

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    employeeId: '',
    lastWorkingDay: new Date().toISOString().slice(0, 10),
    exitType: 'resignation',
    unusedLeaveDays: '',
    noticePeriodDays: '',
    noticeServedDays: '',
    assetRecovery: '',
    advanceRecovery: '',
    bonus: '',
    notes: '',
    allowNegative: false,
  });

  const [preview, setPreview] = useState(null);
  const [formError, setFormError] = useState('');
  const { toast: globalToast } = useToast();

  const notify = useCallback((severity, message) => {
    if (severity === 'success') globalToast.success(message);
    else if (severity === 'error') globalToast.error(message);
    else if (severity === 'warning') globalToast.warning(message);
    else globalToast.info(message);
  }, [globalToast]);

  const fetchSettlements = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const params = {
        page,
        limit,
        ...(statusFilter ? { status: statusFilter } : {}),
      };

      const res = await api.get('/api/settlements', { params });

      setSettlements(res.data?.settlements || []);
      setTotalPages(res.data?.totalPages || 1);
      setTotalCount(res.data?.totalCount || 0);
    } catch (error) {
      setSettlements([]);
      setLoadError(describeError(error, 'Could not load settlements.'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page, limit]);

  useEffect(() => {
    fetchSettlements();
  }, [fetchSettlements]);

  // Reset to page 1 whenever status filter changes
  const handleFilterChange = (status) => {
    setStatusFilter(status);
    setPage(1);
  };

  useEffect(() => {
    if (!showForm || employees.length > 0) return;

    api
      .get('/api/employees', { params: { limit: 100 } })
      .then((res) => setEmployees(res.data?.employees || []))
      .catch(() => setEmployees([]));
  }, [showForm, employees.length]);

  const setField = (field) => (event) => {
    const value =
      event.target.type === 'checkbox'
        ? event.target.checked
        : event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    setPreview(null);
    setFormError('');
  };

  const canPreview = useMemo(
    () => Boolean(form.employeeId && form.lastWorkingDay),
    [form.employeeId, form.lastWorkingDay],
  );

  const handlePreview = async () => {
    if (!canPreview) return;

    try {
      const lastWorkingDayDate = form.lastWorkingDay
        ? new Date(form.lastWorkingDay + 'T12:00:00.000Z')
        : undefined;
      const res = await api.get('/api/settlements/preview', {
        params: {
          employeeId: form.employeeId,
          lastWorkingDay: lastWorkingDayDate,
          unusedLeaveDays: form.unusedLeaveDays || undefined,
          noticePeriodDays: form.noticePeriodDays || undefined,
          noticeServedDays: form.noticeServedDays || undefined,
          assetRecovery: form.assetRecovery || undefined,
          advanceRecovery: form.advanceRecovery || undefined,
          bonus: form.bonus || undefined,
        },
      });
      setPreview(res.data);
      setFormError('');
    } catch (error) {
      setPreview(null);
      setFormError(describeError(error, 'Could not compute the settlement.'));
    }
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setFormError('');

    try {
      const lastWorkingDayDate = form.lastWorkingDay
        ? new Date(form.lastWorkingDay + 'T12:00:00.000Z')
        : undefined;

      await api.post('/api/settlements/initiate', {
        employeeId: form.employeeId,
        lastWorkingDay: lastWorkingDayDate,
        exitType: form.exitType,
        noticePeriodDays: form.noticePeriodDays || undefined,
        noticeServedDays: form.noticeServedDays || undefined,
      });

      await api.post('/api/settlements', {
        employeeId: form.employeeId,
        lastWorkingDay: lastWorkingDayDate,
        unusedLeaveDays: Number(form.unusedLeaveDays) || 0,
        noticePeriodDays: form.noticePeriodDays
          ? Number(form.noticePeriodDays)
          : undefined,
        noticeServedDays: form.noticeServedDays
          ? Number(form.noticeServedDays)
          : undefined,
        assetRecovery: Number(form.assetRecovery) || 0,
        advanceRecovery: Number(form.advanceRecovery) || 0,
        bonus: Number(form.bonus) || 0,
        notes: form.notes,
        allowNegative: form.allowNegative,
      });

      notify('success', 'Settlement drafted.');
      setShowForm(false);
      setPreview(null);
      setPage(1);
      await fetchSettlements();
    } catch (error) {
      setFormError(describeError(error, 'Could not create the settlement.'));
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (id, action, body = {}) => {
    if (busy) return;

    setBusy(true);
    try {
      await api.post(`/api/settlements/${id}/${action}`, body);
      notify('success', `Settlement ${action.replace('-', ' ')}.`);
      await fetchSettlements();
    } catch (error) {
      notify(
        'error',
        describeError(error, `Could not ${action} the settlement.`),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async (id) => {
    const reason = window.prompt('Reason for sending this back?');
    if (!reason || !reason.trim()) return;
    await runAction(id, 'reject', { reason: reason.trim() });
  };

  const s = preview?.settlement;

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-serif text-gray-900 dark:text-white">
            Full &amp; Final Settlements
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Offboard an employee with a final statement — their payroll history
            is preserved.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowHandoverWizard(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm transition"
          >
            Initiate Handover
          </button>

          <button
            onClick={() => setShowForm((v) => !v)}
            aria-expanded={showForm}
            aria-label={showForm ? 'Close exit form' : 'Start an exit'}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition"
          >
            {showForm ? 'Close' : 'Start an exit'}
          </button>
        </div>
      </div>

      {showHandoverWizard && (
        <HandoverWizard
          onClose={() => setShowHandoverWizard(false)}
          onSuccess={() => {
            notify('success', 'Handover plan initiated successfully.');
          }}
        />
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl grid gap-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="text-sm text-gray-700 dark:text-slate-300">
              Employee
              <select
                required
                value={form.employeeId}
                onChange={setField('employeeId')}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              >
                <option value="">Select an employee…</option>
                {employees.map((emp) => (
                  <option key={emp._id} value={emp._id}>
                    {emp.fullName}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-gray-700 dark:text-slate-300">
              Last working day
              <input
                required
                type="date"
                value={form.lastWorkingDay}
                onChange={setField('lastWorkingDay')}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              />
            </label>

            <label className="text-sm text-gray-700 dark:text-slate-300">
              Exit type
              <select
                value={form.exitType}
                onChange={setField('exitType')}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              >
                {EXIT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>

            {[
              ['unusedLeaveDays', 'Unused leave (days)'],
              ['noticePeriodDays', 'Notice period (days)'],
              ['noticeServedDays', 'Notice served (days)'],
              ['bonus', 'Ex-gratia / bonus'],
              ['advanceRecovery', 'Advance recovery'],
              ['assetRecovery', 'Asset recovery'],
            ].map(([field, label]) => (
              <label
                key={field}
                className="text-sm text-gray-700 dark:text-slate-300"
              >
                {label}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form[field]}
                  onChange={setField(field)}
                  className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
                />
              </label>
            ))}
          </div>

          <label className="text-sm text-gray-700 dark:text-slate-300">
            Notes
            <input
              type="text"
              maxLength={1000}
              value={form.notes}
              onChange={setField('notes')}
              className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
            />
          </label>

          {formError && <Alert severity="error">{formError}</Alert>}

          {s && (
            <div className="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-2">
                    Earnings
                  </p>
                  {[
                    [
                      'Prorated salary',
                      s.earnings.proratedSalary,
                      s.explanations.proratedSalary,
                    ],
                    [
                      'Leave encashment',
                      s.earnings.leaveEncashment,
                      s.explanations.leaveEncashment,
                    ],
                    ['Gratuity', s.earnings.gratuity, s.explanations.gratuity],
                    ['Bonus / ex-gratia', s.earnings.bonus, null],
                  ].map(([label, amount, explanation]) => (
                    <div key={label} className="mb-1.5">
                      <div className="flex justify-between text-sm text-gray-800 dark:text-slate-200">
                        <span>{label}</span>
                        <span>{formatCurrency(amount)}</span>
                      </div>
                      {explanation && (
                        <p className="text-xs text-gray-400 dark:text-slate-500">
                          {explanation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-2">
                    Deductions
                  </p>
                  {[
                    [
                      'Notice shortfall',
                      s.deductions.noticeShortfall,
                      s.explanations.noticeShortfall,
                    ],
                    ['Advance recovery', s.deductions.advanceRecovery, null],
                    ['Asset recovery', s.deductions.assetRecovery, null],
                  ].map(([label, amount, explanation]) => (
                    <div key={label} className="mb-1.5">
                      <div className="flex justify-between text-sm text-gray-800 dark:text-slate-200">
                        <span>{label}</span>
                        <span>{formatCurrency(amount)}</span>
                      </div>
                      {explanation && (
                        <p className="text-xs text-gray-400 dark:text-slate-500">
                          {explanation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-200 dark:border-slate-700 flex justify-between items-center">
                <span className="font-semibold text-gray-900 dark:text-white">
                  Net settlement
                </span>
                <span
                  className={`text-xl font-semibold ${
                    s.netSettlement < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-blue-600 dark:text-blue-400'
                  }`}
                >
                  {formatCurrency(s.netSettlement)}
                </span>
              </div>

              {preview.validation && !preview.validation.ok && (
                <div className="mt-3">
                  <Alert severity="warning">
                    {preview.validation.errors.join('; ')}
                  </Alert>
                  <label className="flex items-center gap-2 mt-2 text-sm text-gray-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={form.allowNegative}
                      onChange={setField('allowNegative')}
                    />
                    I confirm the recovery amounts and want to proceed
                  </label>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handlePreview}
              disabled={!canPreview}
              className="px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-sm font-semibold text-gray-700 dark:text-slate-300 disabled:opacity-50"
            >
              Calculate
            </button>
            <button
              type="submit"
              disabled={busy || !form.employeeId}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm"
            >
              {busy ? 'Saving…' : 'Create settlement'}
            </button>
          </div>
        </form>
      )}

      {/* Status Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {['', 'draft', 'pending_approval', 'approved', 'paid', 'cancelled'].map(
          (status) => (
            <button
              key={status || 'all'}
              onClick={() => handleFilterChange(status)}
              aria-label={`Filter by ${status ? STATUS_LABELS[status] : 'All'} status`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                statusFilter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400'
              }`}
            >
              {status ? STATUS_LABELS[status] : 'All'}
            </button>
          ),
        )}
      </div>

      {loadError && (
        <Alert
          severity="error"
          className="mb-4"
          action={
            <button
              onClick={fetchSettlements}
              className="px-3 py-1 text-sm font-semibold underline"
            >
              Retry
            </button>
          }
        >
          {loadError}
        </Alert>
      )}

      {loading ? (
        <SettlementsSkeleton />
      ) : settlements.length === 0 && !loadError ? (
        <div className="p-10 text-center border border-dashed border-gray-300 dark:border-slate-700 rounded-xl">
          <p className="text-gray-500 dark:text-slate-400">
            No settlements recorded yet.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4">
            {settlements.map((item) => (
              <div
                key={item._id}
                className="p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl"
              >
                <div className="flex flex-wrap justify-between items-start gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-lg text-gray-900 dark:text-white">
                        {item.employeeName}
                      </p>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          STATUS_STYLES[item.status] || STATUS_STYLES.draft
                        }`}
                      >
                        {STATUS_LABELS[item.status] || item.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                      Last working day {formatDate(item.lastWorkingDay)}
                    </p>
                    <p className="text-sm text-gray-700 dark:text-slate-300 mt-1">
                      Gross {formatCurrency(item.grossEarnings)} − deductions{' '}
                      {formatCurrency(item.totalDeductions)} ={' '}
                      <strong
                        className={
                          item.netSettlement < 0
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-gray-900 dark:text-white'
                        }
                      >
                        {formatCurrency(item.netSettlement)}
                      </strong>
                    </p>
                    {item.rejectionReason && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        Sent back: {item.rejectionReason}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {item.status === 'draft' && (
                      <button
                        disabled={busy}
                        onClick={() => runAction(item._id, 'submit')}
                        aria-label={`Submit settlement for ${item.employeeName}`}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold"
                      >
                        Submit for approval
                      </button>
                    )}
                    {item.status === 'pending_approval' && (
                      <>
                        <button
                          disabled={busy}
                          onClick={() => runAction(item._id, 'approve')}
                          aria-label={`Approve settlement for ${item.employeeName}`}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold"
                        >
                          Approve
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => handleReject(item._id)}
                          aria-label={`Send back settlement for ${item.employeeName}`}
                          className="px-3 py-1.5 border border-red-500 text-red-600 dark:text-red-400 rounded-lg text-sm font-semibold disabled:opacity-50"
                        >
                          Send back
                        </button>
                      </>
                    )}
                    {item.status === 'approved' && (
                      <button
                        disabled={busy}
                        onClick={() => runAction(item._id, 'mark-paid')}
                        aria-label={`Mark paid and offboard ${item.employeeName}`}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold"
                      >
                        Mark paid &amp; offboard
                      </button>
                    )}
                    {['draft', 'pending_approval', 'approved'].includes(
                      item.status,
                    ) && (
                      <button
                        disabled={busy}
                        onClick={() => runAction(item._id, 'cancel')}
                        aria-label={`Cancel settlement for ${item.employeeName}`}
                        className="px-3 py-1.5 border border-gray-300 dark:border-slate-700 text-gray-600 dark:text-slate-400 rounded-lg text-sm font-semibold disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Reusable Standardized Pagination Component */}
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalCount}
            itemsPerPage={limit}
            onPageChange={(newPage) => setPage(newPage)}
          />
        </div>
      )}
    </div>
  );
};

export default Settlements;
