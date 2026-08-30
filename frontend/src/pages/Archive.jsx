import { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import EmptyState from '../components/common/EmptyState';
import { formatCurrency } from '../utils/currency';
import { formatDate } from '../utils/formatLocale';
import DashboardSkeleton from '../components/common/skeleton/DashboardSkeleton';
import Sidebar from '../components/Sidebar';
import { useAppStore } from '../store/useAppStore';

/**
 * The archive of soft-deleted employees (#759, #897).
 *
 * Read-only until now, which made the soft delete effectively permanent: the
 * records were there, the model supported putting them back, and the only way
 * to actually do it was a mongo shell. An undo that a person cannot reach is
 * not an undo.
 */
export default function Archive() {
  const navigate = useNavigate();
  const logout = useAppStore((state) => state.logout);
  const [archivedEmployees, setArchivedEmployees] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Keyed by employee id rather than a single boolean: two restores can be in
  // flight at once, and a shared flag would spin every card on the page.
  const [restoring, setRestoring] = useState({});
  const [restoreError, setRestoreError] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const companyName = localStorage.getItem('companyName') || 'PaySphere';

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const fetchArchive = useCallback(async (requestedPage) => {
    setLoading(true);
    try {
      const response = await api.get('/api/archive/employees', {
        params: { page: requestedPage },
      });
      setArchivedEmployees(response.data.data || []);
      setTotal(response.data.total || 0);
      setTotalPages(response.data.totalPages || 1);
      setError(null);
    } catch {
      setError('Failed to fetch archived records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArchive(page);
  }, [fetchArchive, page]);

  const handleRestore = async (employee) => {
    // The one destructive-looking action on this page is actually the
    // non-destructive one, but it does put a person back into payroll
    // calculations, so it is worth a beat of confirmation.
    const confirmed = window.confirm(
      `Restore ${employee.fullName}? They will reappear in the employee directory and in payroll runs.`,
    );
    if (!confirmed) return;

    setRestoring((current) => ({ ...current, [employee._id]: true }));
    setRestoreError(null);

    // Optimistic: the card goes immediately, because the common case is that it
    // worked and leaving it in place reads as a broken button. The failure path
    // below puts it back rather than silently diverging from the server.
    const previous = archivedEmployees;
    setArchivedEmployees((current) =>
      current.filter((e) => e._id !== employee._id),
    );

    try {
      await api.put(`/api/employees/${employee._id}/restore`);
      setTotal((current) => Math.max(current - 1, 0));

      // Refetched rather than trusted: with the page now one short, the row
      // that should move up from the next page is only knowable from the
      // server.
      await fetchArchive(page);
    } catch (err) {
      setArchivedEmployees(previous);
      setRestoreError(
        err?.response?.data?.message ||
          `Could not restore ${employee.fullName}. Please try again.`,
      );
    } finally {
      setRestoring((current) => {
        const next = { ...current };
        delete next[employee._id];
        return next;
      });
    }
  };

  const currency = localStorage.getItem('currency') || 'INR';

  if (loading && archivedEmployees.length === 0) {
    return <DashboardSkeleton />;
  }

  return (
    <>
      <Sidebar
        companyName={companyName}
        activePage="Archive"
        setActivePage={() => {}}
        isSidebarOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onLogout={handleLogout}
      />
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950 md:ml-56 p-4 sm:p-8">
        <button
          type="button"
          onClick={() => setIsSidebarOpen(true)}
          aria-label="Open sidebar"
          className="md:hidden mb-4 p-2 text-gray-600 dark:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
        >
          ☰
        </button>
        <div className="animate-in fade-in zoom-in duration-500">
      <Helmet>
        <title>Archive | PaySphere</title>
      </Helmet>

      <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl sm:text-4xl font-serif text-gray-900 dark:text-white">
            Archive
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
            View and restore soft-deleted records.
            {total > 0 && (
              <span className="ml-1 font-medium text-gray-700 dark:text-slate-300">
                {total} archived.
              </span>
            )}
          </p>
        </div>
      </div>

      {restoreError && (
        <div
          role="alert"
          className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100"
        >
          {restoreError}
        </div>
      )}

      {error ? (
        <div role="alert" className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100">
          {error}
        </div>
      ) : archivedEmployees.length === 0 ? (
        <EmptyState
          title="No archived records"
          description="Deleted employees will appear here."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {archivedEmployees.map((emp) => (
              <div
                key={emp._id}
                className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-900/30 opacity-75 transition-all"
              >
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                  {emp.fullName}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                  {emp.role} {emp.department ? `• ${emp.department}` : ''}
                </p>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600 dark:text-slate-300">
                    Base Pay:
                  </span>
                  <span className="font-semibold">
                    {formatCurrency(emp.monthlySalary, currency)}
                  </span>
                </div>
                {emp.deletedAt && (
                  <div className="flex justify-between items-center text-sm mt-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-300">
                      Deleted On:
                    </span>
                    <span className="text-red-500 font-medium">
                      {formatDate(emp.deletedAt)}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleRestore(emp)}
                  disabled={Boolean(restoring[emp._id])}
                  className="mt-4 w-full px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {restoring[emp._id] ? 'Restoring…' : 'Restore'}
                </button>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-8">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page <= 1 || loading}
                className="px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page >= totalPages || loading}
                className="px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
        </div>
      </main>
    </>
  );
}
