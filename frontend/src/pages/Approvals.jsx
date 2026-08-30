import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useCtrlEnterSubmit from '../hooks/useCtrlEnterSubmit';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../utils/formatLocale';

const MONTH_NAMES = [
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
const MAX_REASON_LENGTH = 500;


const formatPeriod = (month, year) => {
  const name = MONTH_NAMES[Number(month) - 1];
  return name ? `${name} ${year}` : `${month}/${year}`;
};

/**
 * Turn an axios failure into something a user can act on.
 *
 * Every handler on this page used to `alert("Failed to approve payroll")`
 * regardless of what went wrong, discarding the per-record detail the API now
 * returns (#458). A 403 from the new APPROVE_PAYROLL guard and a 409 from an
 * illegal transition are very different problems and need different wording.
 */
const describeError = (error, fallback) => {
  const response = error?.response;
  if (!response) {
    return 'Could not reach the server. Check your connection and try again.';
  }

  if (response.status === 403) {
    return "You do not have permission to approve payroll. Ask an account owner to grant you the 'Approve payroll' permission.";
  }
  if (response.status === 409) {
    if (
      Array.isArray(response.data?.staleEmployeeVersions) &&
      response.data.staleEmployeeVersions.length > 0
    ) {
      return (
        response.data.message ||
        'Employee data changed after the payroll was calculated. Review and recalculate the affected payroll before approving it.'
      );
    }

    return (
      response.data?.message ||
      'This payroll was changed by another user. Reload the approvals list and review it before trying again.'
    );
  }
  const data = response.data || {};
  const parts = [];

  if (data.message) parts.push(data.message);

  if (
    Array.isArray(data.invalidTransition) &&
    data.invalidTransition.length > 0
  ) {
    parts.push(
      data.invalidTransition
        .map((item) => `${item.employeeName || 'A record'}: ${item.reason}`)
        .join('; '),
    );
  }

  if (Array.isArray(data.notFound) && data.notFound.length > 0) {
    parts.push(
      `${data.notFound.length} record(s) could not be found in your workspace.`,
    );
  }

  return parts.length > 0 ? parts.join(' — ') : fallback;
};

const Approvals = () => {
  const rejectFormRef = useRef(null);
  useCtrlEnterSubmit(rejectFormRef);
  const [pending, setPending] = useState([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [rejectTargets, setRejectTargets] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const { toast: globalToast } = useToast();

  const notify = useCallback((severity, message) => {
    if (severity === 'success') globalToast.success(message);
    else if (severity === 'error') globalToast.error(message);
    else if (severity === 'warning') globalToast.warning(message);
    else globalToast.info(message);
  }, [globalToast]);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const res = await api.get('/api/payroll/approvals');
      const rows = Array.isArray(res.data?.pending) ? res.data.pending : [];
      setPending(rows);
      setPendingTotal(Number(res.data?.pendingTotalNetSalary) || 0);
      // Drop any selection that no longer exists in the refreshed queue.
      setSelectedIds((prev) => {
        const live = new Set(rows.map((r) => r._id));
        return new Set([...prev].filter((id) => live.has(id)));
      });
    } catch (error) {
      setPending([]);
      setPendingTotal(0);
      setLoadError(describeError(error, 'Could not load the approvals queue.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const allSelected = useMemo(
    () => pending.length > 0 && selectedIds.size === pending.length,
    [pending.length, selectedIds.size],
  );

  const selectedTotal = useMemo(
    () =>
      pending
        .filter((p) => selectedIds.has(p._id))
        .reduce((sum, p) => sum + (Number(p.netSalary) || 0), 0),
    [pending, selectedIds],
  );

  const selectedList = useMemo(() => [...selectedIds], [selectedIds]);

  const toggleOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((prev) =>
      prev.size === pending.length
        ? new Set()
        : new Set(pending.map((p) => p._id)),
    );
  };

  /**
   * Approve a batch.
   *
   * The API reports per-record outcomes, so a batch where some rows did not
   * apply is surfaced as a warning rather than a clean success — the previous
   * implementation optimistically removed every id from the list regardless of
   * what the server actually did.
   */
  const handleApprove = async (ids) => {
    if (ids.length === 0 || busy) return;

    setBusy(true);
    try {
      const versions = Object.fromEntries(
        pending
          .filter((payroll) => ids.includes(payroll._id))
          .map((payroll) => [payroll._id, payroll.__v]),
      );

      const res = await api.post('/api/payroll/approve', {
        payrollIds: ids,
        versions,
      });      const {
        approvedCount = 0,
        notFound = [],
        invalidTransition = [],
      } = res.data || {};

      const skipped = notFound.length + invalidTransition.length;
      if (skipped > 0) {
        notify(
          'warning',
          `Approved ${approvedCount} of ${ids.length}. ${skipped} could not be approved.`,
        );
      } else {
        notify(
          'success',
          `Approved ${approvedCount} payroll record${approvedCount !== 1 ? 's' : ''}.`,
        );
      }

      await fetchPending();
    } catch (error) {
      notify('error', describeError(error, 'Failed to approve payroll.'));
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async (event) => {
    event.preventDefault();

    const ids = rejectTargets || [];
    const reason = rejectReason.trim();

    if (ids.length === 0 || reason === '' || busy) return;

    setBusy(true);
    try {
      const res = await api.post('/api/payroll/reject', {
        payrollIds: ids,
        reason,
      });
      const {
        rejectedCount = 0,
        notFound = [],
        invalidTransition = [],
      } = res.data || {};

      const skipped = notFound.length + invalidTransition.length;
      if (skipped > 0) {
        notify(
          'warning',
          `Rejected ${rejectedCount} of ${ids.length}. ${skipped} could not be rejected.`,
        );
      } else {
        notify(
          'success',
          `Rejected ${rejectedCount} payroll record${rejectedCount !== 1 ? 's' : ''}.`,
        );
      }

      setRejectTargets(null);
      setRejectReason('');
      await fetchPending();
    } catch (error) {
      notify('error', describeError(error, 'Failed to reject payroll.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-serif text-gray-900 dark:text-white">
            Pending Approvals
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-500 mt-1">
            Review submitted payroll runs before they can be paid or emailed.
          </p>
        </div>

        {!loading && pending.length > 0 && (
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
              Awaiting approval
            </p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">
              {formatCurrency(pendingTotal)}
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-500">
              across {pending.length} record{pending.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

      {loadError && (
        <div className="mb-6">
          <Alert
            severity="error"
            action={
              <button
                onClick={fetchPending}
                className="px-3 py-1 text-sm font-semibold underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              >
                Retry
              </button>
            }
          >
            {loadError}
          </Alert>
        </div>
      )}

      {loading ? (
        <ApprovalsSkeleton />
      ) : pending.length === 0 && !loadError ? (
        <div className="p-10 text-center border border-dashed border-gray-300 dark:border-slate-700 rounded-xl">
          <p className="text-gray-500 dark:text-slate-500">
            There are no pending approvals.
          </p>
        </div>
      ) : (
        pending.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-gray-50 dark:bg-slate-900/60 rounded-xl border border-gray-200 dark:border-slate-800">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="w-4 h-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                />
                Select all
              </label>

              {selectedIds.size > 0 && (
                <>
                  <span className="text-sm text-gray-500 dark:text-slate-500">
                    {selectedIds.size} selected ·{' '}
                    {formatCurrency(selectedTotal)}
                  </span>
                  <div className="ml-auto flex gap-2">
                    <button
                      disabled={busy}
                      onClick={() => handleApprove(selectedList)}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm transition"
                    >
                      Approve selected
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => setRejectTargets(selectedList)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm transition"
                    >
                      Reject selected
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="grid gap-4">
              {pending.map((p) => (
                <div
                  key={p._id}
                  className="p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl flex flex-wrap justify-between items-center gap-4 shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p._id)}
                      onChange={() => toggleOne(p._id)}
                      aria-label={`Select ${p.employeeName}`}
                      className="w-4 h-4"
                    />
                    <div>
                      <p className="font-semibold text-lg text-gray-900 dark:text-white">
                        {p.employeeName}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-slate-500">
                        {formatPeriod(p.month, p.year)} · Net{' '}
                        {formatCurrency(p.netSalary, p.currency)}
                      </p>
                      {p.submittedBy?.fullName && (
                        <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                          Submitted by {p.submittedBy.fullName}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      disabled={busy}
                      onClick={() => handleApprove([p._id])}
                      aria-label={`Approve ${p.employeeName}`}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm transition"
                    >
                      Approve
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => setRejectTargets([p._id])}
                      aria-label={`Reject ${p.employeeName}`}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm transition"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )
      )}

      {rejectTargets && (
        <div role="dialog" aria-modal="true" aria-label="Reject payroll record" className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl w-full max-w-md">
            <h3 className="text-lg font-bold mb-1 text-gray-900 dark:text-white">
              Reject {rejectTargets.length} payroll record
              {rejectTargets.length !== 1 ? 's' : ''}
            </h3>
            <p className="text-sm text-gray-500 dark:text-slate-500 mb-4">
              The reason is recorded against the run and shown to whoever
              resubmits it.
            </p>

            <form ref={rejectFormRef} onSubmit={handleReject}>
              <textarea
                className="w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent mb-1 text-gray-900 dark:text-white min-h-24 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                placeholder="Reason for rejection…"
                aria-label="Reason for rejection"
                value={rejectReason}
                maxLength={MAX_REASON_LENGTH}
                onChange={(e) => setRejectReason(e.target.value)}
                required
              />
              <p className="text-xs text-gray-500 dark:text-slate-500 mb-4 text-right">
                {rejectReason.length}/{MAX_REASON_LENGTH}
              </p>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRejectTargets(null);
                    setRejectReason('');
                  }}
                  className="px-4 py-2 text-gray-500 dark:text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || rejectReason.trim() === ''}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                >
                  Confirm reject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Approvals;
