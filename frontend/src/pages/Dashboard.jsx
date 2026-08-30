import { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  useDashboardSummary,
  useRecentActivity,
  usePayrollTrend,
} from '../hooks/useDashboardData';
import EmployeeCard from '../components/EmployeeCard';
import EmployeeExportActions from '../components/EmployeeExportActions';
import SettingsModal from '../components/SettingsModal';
import Sidebar from '../components/Sidebar';
import BottomNavBar from '../components/BottomNavBar'; // Added for #1025
import ThemeToggle from '../components/ThemeToggle';
import LanguageSwitcher from '../components/LanguageSwitcher';
import EmptyState from '../components/common/EmptyState';
import DashboardSkeleton from '../components/common/skeleton/DashboardSkeleton';
import EmployeeManagementSkeleton from '../components/common/skeleton/EmployeeManagementSkeleton';
import PayrollTableSkeleton from '../components/common/skeleton/PayrollTableSkeleton';
import DashboardGrid from '../components/dashboard/DashboardGrid';
import { useAppStore } from '../store/useAppStore';
import { useOnboardingStore } from '../store/useOnboardingStore';
import useCtrlEnterSubmit from '../hooks/useCtrlEnterSubmit';
import api from '../services/api';
import { formatCurrency, getCurrencySymbol } from '../utils/currency';
import { useToast } from '../context/ToastContext';
import Approvals from './Approvals';
import Loans from './Loans';
import Settlements from './Settlements';
import Archive from './Archive';
import ErrorBoundary, {
  ComponentFeedbackFallback,
} from '../components/common/ErrorBoundary';
import VirtualizedTable from '../components/common/VirtualizedTable'; // Added for #1030
import { EmployeeTableRow } from '../components/common/TableRow'; // Added for #1030

// Accept international phone numbers with an optional leading "+" and
// a national number of 7-15 digits. Mirrors backend validation behavior.
const PHONE_REGEX = /^\+?[1-9]\d{6,14}$/;

const normalizePhoneValue = (value) => value.trim().replace(/[()\s-]/g, '');

// Country codes offered in the Edit Employee phone field. Extend this list
// as needed — longer codes are checked first in getPhoneParts so a code like
// "+91" isn't mistakenly matched by a shorter unrelated prefix.
const COUNTRY_CODE_OPTIONS = [
  { value: '+91', label: '+91 (India)' },
  { value: '+1', label: '+1 (US/Canada)' },
  { value: '+44', label: '+44 (UK)' },
  { value: '+61', label: '+61 (Australia)' },
  { value: '+971', label: '+971 (UAE)' },
  { value: '+65', label: '+65 (Singapore)' },
];

// Split a stored, normalized phone number like "+919876543210" into its
// country-code and local-number parts for the edit form's two inputs.
// Falls back to +91 (the default used elsewhere in this file) when the
// number is empty or its prefix doesn't match a known option.
const getPhoneParts = (phone) => {
  if (!phone) {
    return { phoneCountryCode: '+91', phone: '' };
  }

  const sortedOptions = [...COUNTRY_CODE_OPTIONS].sort(
    (a, b) => b.value.length - a.value.length,
  );
  const match = sortedOptions.find((option) => phone.startsWith(option.value));

  if (match) {
    return {
      phoneCountryCode: match.value,
      phone: phone.slice(match.value.length),
    };
  }

  return { phoneCountryCode: '+91', phone: phone.replace(/^\+/, '') };
};

// Trigger a file download from the browser
const downloadFile = (url, filename) => {
  api
    .get(url, { responseType: 'blob' })
    .then((res) => {
      const blob = res.data;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    })
    .catch((err) => {
      console.error('Export failed:', err);
      window.dispatchEvent(
        new CustomEvent('toast:show', {
          detail: {
            message:
              'No payroll data found for the current month. Finalize payroll first.',
            type: 'warning',
          },
        }),
      );
    });
};

// --- Dashboard Overview Component ---
const DashboardOverview = ({
  search,
  setSearch,
  roleFilter,
  setRoleFilter,
  availableRoles = [],
  filtered,
  navigate,
  onAddUpdate,
  onAddEmployee,
  totalPayout,
  employeeCount,
  loading,
  payrolls,
  onEditEmployee,
}) => {
  const { t, i18n } = useTranslation();

  const currency = localStorage.getItem('currency') || 'INR';
  const payrollMap = {};
  (payrolls || []).forEach((p) => {
    payrollMap[p.employeeId] = p;
  });

  const [gettingStarted, setGettingStarted] = useState(() => {
    return localStorage.getItem('showGettingStartedCard') !== 'false';
  });

  useEffect(() => {
    localStorage.setItem('showGettingStartedCard', gettingStarted);
  }, [gettingStarted]);

  function handleCloseBtn() {
    setGettingStarted(false);
  }

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <>
      {/* Overview Header */}
      <div
        data-tour="dashboard-overview"
        className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-6 border-b border-gray-200 dark:border-slate-800"
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 mb-1">
            {t('dashboard.monthlyOverview', 'Monthly Overview')}
          </p>
          <h1 className="text-3xl sm:text-4xl font-serif text-gray-900 dark:text-white capitalize">
            {new Date().toLocaleString(i18n?.language || 'en', {
              month: 'long',
              year: 'numeric',
            })}
          </h1>
        </div>

        <div className="flex gap-3 w-full sm:w-auto mt-4 md:mt-0">
          <button
            onClick={() => navigate('/reports')}
            className="flex-1 cursor-pointer sm:flex-none px-5 py-2.5 border border-gray-200 dark:border-slate-800 dark:text-slate-200 rounded-lg text-sm font-semibold hover:shadow dark:hover:bg-slate-800 transition-colors"
          >
            {t('dashboard.reports', 'Reports')}
          </button>

          <button
            onClick={() =>
              downloadFile('/api/payroll/export-csv', `payroll-export.csv`)
            }
            className="flex-1 cursor-pointer sm:flex-none px-5 py-2.5 border border-gray-200 dark:border-slate-800 dark:text-slate-200 rounded-lg text-sm font-semibold hover:shadow dark:hover:bg-slate-800 transition-colors"
          >
            {t('dashboard.exportCsv', 'Export CSV')}
          </button>

          <button
            data-tour="run-payroll-btn"
            onClick={onAddUpdate}
            className="flex-1 cursor-pointer sm:flex-none px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-md shadow-blue-200 dark:shadow-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          >
            {t('dashboard.runPayroll', 'Run Payroll')}
          </button>
        </div>
      </div>

      {/* Dynamic Dashboard Grid (Replaces manual SummaryCards/Charts) */}
      <div className="space-y-6">
        <ErrorBoundary level="widget">
          <DashboardGrid />
        </ErrorBoundary>
      </div>

      {/* Stats */}
      <div className="flex flex-col sm:flex-row gap-4 mb-10">
        <div className="flex-1 bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm transition-colors duration-200">
          <p className="text-xs uppercase text-gray-500 dark:text-slate-500 font-bold mb-2">
            {t('dashboard.totalMonthlyPayout', 'Total Monthly Payout')}
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(totalPayout, currency)}
          </h2>
          <p className="text-gray-500 dark:text-slate-500 text-sm mt-2">
            {t('dashboard.employeesOnPayroll', {
              count: employeeCount,
              defaultValue: `${employeeCount} employees on payroll`,
            })}
          </p>
        </div>

        <div className="w-full sm:w-64 bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm transition-colors duration-200">
          <p className="text-xs uppercase text-gray-500 dark:text-slate-500 font-bold mb-2">
            {t('dashboard.employees', 'Employees')}
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
            {employeeCount}
          </h2>
          <p className="text-gray-500 dark:text-slate-500 text-sm">
            {t('dashboard.activeThisMonth', 'Active this month')}
          </p>
        </div>
      </div>

      {/* Getting Started */}
      {gettingStarted && (
        <div className="relative mx-auto my-8 max-w-2xl rounded-xl border border-gray-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={handleCloseBtn}
            aria-label={t(
              'dashboard.gettingStarted.dismiss',
              'Dismiss tutorial',
            )}
            className="absolute right-4 top-4 cursor-pointer rounded-full p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          >
            ✕
          </button>

          <h2 className="mb-2 text-2xl font-semibold text-gray-900 dark:text-white">
            {t('dashboard.gettingStarted.title', 'Getting Started')}
          </h2>
          <p className="text-gray-600 dark:text-slate-500">
            {t(
              'dashboard.gettingStarted.desc',
              'New to PaySphere? Watch this quick tutorial to learn how to navigate the application and get started.',
            )}
          </p>

          <div className="mt-5 flex flex-wrap gap-3 items-center">
            <a
              href="https://youtu.be/N3SizOsiNGw"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white transition-colors duration-200 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              {t('dashboard.gettingStarted.watch', '▶ Watch Tutorial')}
            </a>
            <button
              type="button"
              onClick={() => useOnboardingStore.getState().resetTour(navigate)}
              className="inline-flex items-center rounded-lg border border-blue-600 px-5 py-2.5 font-medium text-blue-600 dark:text-blue-400 transition-colors duration-200 hover:bg-blue-50 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 cursor-pointer"
            >
              ✨ Take Guided Tour
            </button>
          </div>
        </div>
      )}

      {/* Search + Role Filter + Export Roster */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('dashboard.employeeDirectory', 'Employee Directory')}
        </h2>

        <div className="flex flex-wrap gap-3 items-center w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none sm:w-64">
            <input
              value={search || ''}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t(
                'dashboard.searchEmployees',
                'Search employees...',
              )}
              className="w-full pl-9 pr-8 py-2 border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg text-sm focus:border-blue-500 outline-none transition-colors"
            />
            <svg
              className="w-4 h-4 absolute left-3 top-2.5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label={t('common.clear', 'Clear search')}
                className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {availableRoles.length > 0 && (
            <select
              value={roleFilter || ''}
              onChange={(e) => setRoleFilter(e.target.value)}
              aria-label={t('common.filter', 'Filter by role')}
              className="px-3 py-2 border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg text-sm focus:border-blue-500 outline-none transition-colors"
            >
              <option value="">{t('dashboard.allRoles', 'All Roles')}</option>
              {availableRoles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          )}

          {/* New Export Actions Component (Issue #511) */}
          <EmployeeExportActions employees={filtered} />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.length === 0 && !search && !roleFilter ? (
          <EmptyState
            title={t('dashboard.noEmployeesYet', 'No employees yet')}
            description={t(
              'dashboard.addFirstEmployee',
              'Add your first employee to get started with payroll.',
            )}
            action={
              <button
                onClick={onAddEmployee}
                className="px-6 py-2.5 bg-blue-600 cursor-pointer hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition shadow-md shadow-blue-200 dark:shadow-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              >
                {t('dashboard.addEmployee', '+ Add Employee')}
              </button>
            }
          />
        ) : filtered.length === 0 && (search || roleFilter) ? (
          <EmptyState
            title={t('dashboard.noEmployeesFound', 'No employees found')}
            description={t('dashboard.noMatchFound', {
              query: search || roleFilter,
              defaultValue: `No employees match "${search || roleFilter}". Try a different name or role.`,
            })}
          />
        ) : (
          filtered.map((emp) => (
            <EmployeeCard
              key={emp._id}
              emp={emp}
              payroll={payrollMap[emp._id]}
              variant="overview"
              onAddUpdate={onAddUpdate}
              onEdit={() => onEditEmployee(emp)}
            />
          ))
        )}

        {(filtered.length > 0 || search || roleFilter) && (
          <div
            data-tour="add-employee-btn"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && e.target.click()}
            onClick={onAddEmployee}
            className="border-2 border-dashed border-gray-300 dark:border-slate-800 rounded-xl flex items-center justify-center min-h-44 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-indigo-50/50 dark:hover:bg-slate-900/50 cursor-pointer transition duration-200"
          >
            <p className="text-gray-500 dark:text-slate-500 font-semibold">
              {t('dashboard.addEmployee', '+ Add Employee')}
            </p>
          </div>
        )}
      </div>
    </>
  );
};

// --- Employee Management Component ---
const EmployeeManagement = ({
  search,
  setSearch,
  roleFilter,
  setRoleFilter,
  availableRoles = [],
  employees,
  loading,
  onAddEmployee,
  onAddUpdate,
  payrolls,
  currentPage,
  totalPages,
  setCurrentPage,
  onDeleteEmployee,
  onEditEmployee,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const currency = localStorage.getItem('currency') || 'INR';
  const payrollMap = {};
  (payrolls || []).forEach((p) => {
    payrollMap[p.employeeId] = p;
  });

  const totalNet = employees.reduce((s, e) => {
    const p = payrollMap[e._id];
    return s + (p ? p.netSalary : e.monthlySalary || 0);
  }, 0);

  if (loading) {
    return <EmployeeManagementSkeleton />;
  }

  return (
    <main className="p-4 sm:p-8">
      {/* Summary */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-gray-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row justify-between items-center mb-8 gap-6 transition-colors duration-200">
        <div>
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-900/50 mb-4">
            {t('dashboard.payrollBadge', 'Payroll done in 30 seconds')}
          </span>
          <p className="text-sm text-gray-500 dark:text-slate-500 mb-1">
            {t('dashboard.finalSummary', 'Final Summary')}
          </p>
          <h1 className="text-3xl sm:text-4xl font-serif text-gray-900 dark:text-white mb-2">
            {formatCurrency(totalNet, currency)}
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-500">
            {t('dashboard.totalMonthlyPayoutFor', 'Total Monthly Payout for')}{' '}
            <span className="text-gray-700 dark:text-slate-200 font-semibold">
              {t('dashboard.employeeCount', {
                count: employees.length,
                defaultValue: `${employees.length} Employee${employees.length !== 1 ? 's' : ''}`,
              })}
            </span>
          </p>
        </div>

        <div className="flex gap-3 w-full sm:w-auto">
          <button
            onClick={onAddUpdate}
            className="flex-1 sm:flex-none cursor-pointer px-5 py-3 border border-gray-200 dark:border-slate-800 rounded-xl font-semibold text-gray-700 dark:text-slate-200 hover:shadow dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          >
            {t('dashboard.editUpdates', 'Edit Updates')}
          </button>
          <button
            className="flex-1 sm:flex-none cursor-pointer px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-200 dark:shadow-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            onClick={() =>
              api
                .post('/api/payroll/submit', {
                  activities: [],
                  month: new Date().getMonth() + 1,
                  year: new Date().getFullYear(),
                })
                .then(() =>
                  toast.success(
                    t(
                      'dashboard.toasts.payrollSubmitted',
                      'Payroll submitted for review!',
                    ),
                  ),
                )
                .catch((err) =>
                  toast.error(
                    err.response?.data?.message ||
                      t(
                        'dashboard.toasts.payrollSubmitFailed',
                        'Failed to submit payroll',
                      ),
                  ),
                )
            }
          >
            {t('dashboard.submitReview', 'Submit for Review')}
          </button>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('dashboard.employeeRoster', 'Employee Roster')}
        </h2>

        <div className="flex flex-wrap gap-3 items-center w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none sm:w-64">
            <input
              value={search || ''}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t(
                'dashboard.searchEmployees',
                'Search employees...',
              )}
              className="w-full pl-9 pr-8 py-2 border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg text-sm focus:border-blue-500 outline-none transition-colors"
            />
            <svg
              className="w-4 h-4 absolute left-3 top-2.5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label={t('common.clear', 'Clear search')}
                className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {availableRoles.length > 0 && (
            <select
              value={roleFilter || ''}
              onChange={(e) => setRoleFilter(e.target.value)}
              aria-label={t('common.filter', 'Filter by role')}
              className="px-3 py-2 border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg text-sm focus:border-blue-500 outline-none transition-colors"
            >
              <option value="">{t('dashboard.allRoles', 'All Roles')}</option>
              {availableRoles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Virtualized Employee Table (Issue #1030) */}
      <div className="h-[600px] w-full">
        {loading ? (
          <div className="flex items-center justify-center h-full bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
          </div>
        ) : (
          <VirtualizedTable
            data={employees}
            renderRow={EmployeeTableRow}
            rowHeight={64}
            headerHeight={44}
            header={
              <div className="flex items-center px-6 h-full text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400 min-w-[900px]">
                <div className="w-1/4 min-w-[200px]">
                  {t('dashboard.table.employee', 'Employee')}
                </div>
                <div className="w-1/5 min-w-[120px]">
                  {t('dashboard.table.role', 'Role')}
                </div>
                <div className="w-1/5 min-w-[120px]">
                  {t('dashboard.table.department', 'Department')}
                </div>
                <div className="w-1/5 text-right min-w-[100px]">
                  {t('dashboard.table.salary', 'Salary')}
                </div>
                <div className="w-1/5 text-center min-w-[100px]">
                  {t('dashboard.table.status', 'Status')}
                </div>
                <div className="w-16 min-w-[60px]"></div>
              </div>
            }
            emptyState={
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <p className="text-lg font-semibold text-gray-700 dark:text-slate-300">
                  {t('dashboard.noEmployeesFound', 'No employees found')}
                </p>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                  {t(
                    'dashboard.addFirstEmployee',
                    'Add your first employee to get started.',
                  )}
                </p>
              </div>
            }
          />
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-8">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
            className="px-4 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm font-semibold disabled:opacity-50 text-slate-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
          >
            {t('common.previous', 'Previous')}
          </button>
          <span className="text-sm text-gray-600 dark:text-slate-500">
            {t('common.page', {
              current: currentPage,
              total: totalPages,
              defaultValue: `Page ${currentPage} of ${totalPages}`,
            })}
          </span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
            className="px-4 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm font-semibold disabled:opacity-50 text-slate-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
          >
            {t('common.next', 'Next')}
          </button>
        </div>
      )}
    </main>
  );
};

// --- Edit Employee Modal Component ---
const EditEmployeeModal = ({ employee, onClose, onSave }) => {
  const { t } = useTranslation();
  const formRef = useRef(null);
  useCtrlEnterSubmit(formRef);
  const { phoneCountryCode: initialPhoneCountryCode, phone: initialPhone } =
    getPhoneParts(employee?.phone);
  const currency = localStorage.getItem('currency') || 'INR';
  // Custom role names from GET /api/roles for the Role datalist (#475)
  const [roleSuggestions, setRoleSuggestions] = useState([]);
  const [formData, setFormData] = useState({
    fullName: employee?.fullName || '',
    role: employee?.role || '',
    monthlySalary: employee?.monthlySalary || '',
    overtimeRate: employee?.overtimeRate || '',
    phoneCountryCode: initialPhoneCountryCode,
    phone: initialPhone,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/api/roles')
      .then((res) =>
        setRoleSuggestions((res.data?.roles || []).map((r) => r.name)),
      )
      .catch(() => setRoleSuggestions([]));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'phone' ? value.replace(/\D/g, '') : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const salary = Number(formData.monthlySalary);
    const otRate = Number(formData.overtimeRate);

    // Validation Check (Step 5)
    if (salary <= 0) {
      return setError(
        t(
          'dashboard.editModal.validation.salaryPositive',
          'Monthly salary must be a positive number.',
        ),
      );
    }
    if (otRate < 0) {
      return setError(
        t(
          'dashboard.editModal.validation.overtimeNonNegative',
          'Overtime rate cannot be negative.',
        ),
      );
    }

    // Phone validation
    const trimmedPhone = formData.phone.trim();
    const trimmedCountryCode = formData.phoneCountryCode?.trim() || '+91';
    const normalizedPhone = normalizePhoneValue(
      `${trimmedCountryCode}${trimmedPhone}`,
    );
    if (trimmedPhone && !PHONE_REGEX.test(normalizedPhone)) {
      return setError(
        t(
          'dashboard.editModal.validation.validPhone',
          'Enter a valid international phone number.',
        ),
      );
    }

    try {
      setSubmitting(true);
      await onSave(employee._id, {
        fullName: formData.fullName,
        role: formData.role,
        monthlySalary: salary,
        overtimeRate: otRate,
        phone: normalizedPhone || undefined,
        version: employee.__v,
      });    } catch {
      setError(
        t(
          'dashboard.editModal.validation.updateFailed',
          'Failed to update employee details.',
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!employee) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 transition-opacity">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-200 dark:border-slate-800">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          {t('dashboard.editModal.title', 'Edit Employee')}
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              {t('dashboard.editModal.fullName', 'Full Name')}
            </label>
            <input
              required
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              {t('dashboard.editModal.role', 'Role')}
            </label>
            <input
              required
              type="text"
              name="role"
              list="role-suggestions"
              value={formData.role}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
            />
            <datalist id="role-suggestions">
              {roleSuggestions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              {t('dashboard.editModal.phone', 'Phone Number')}
            </label>
            <div className="flex gap-2">
              <select
                name="phoneCountryCode"
                value={formData.phoneCountryCode}
                onChange={handleChange}
                className="w-36 px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
              >
                {COUNTRY_CODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                inputMode="numeric"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="9876543210"
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                {t('dashboard.editModal.monthlySalary', {
                  currency: getCurrencySymbol(currency),
                  defaultValue: `Monthly Salary (${getCurrencySymbol(currency)})`,
                })}
              </label>
              <input
                required
                type="number"
                name="monthlySalary"
                value={formData.monthlySalary}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                {t('dashboard.editModal.overtimeRate', {
                  currency: getCurrencySymbol(currency),
                  defaultValue: `Overtime Rate (${getCurrencySymbol(currency)})`,
                })}
              </label>
              <input
                required
                type="number"
                name="overtimeRate"
                min="0"
                value={formData.overtimeRate}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-8">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              {submitting
                ? t('dashboard.editModal.saving', 'Saving...')
                : t('dashboard.editModal.saveChanges', 'Save Changes')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Payroll Table Component ---
const PayrollTable = ({
  payrolls,
  loading,
  currentPage,
  totalPages,
  totalCount,
  setCurrentPage,
}) => {
  const { t, i18n } = useTranslation();
  const PAYROLL_LIMIT = 10;
  const startIdx = (currentPage - 1) * PAYROLL_LIMIT + 1;
  const endIdx = Math.min(currentPage * PAYROLL_LIMIT, totalCount);
  const currency = localStorage.getItem('currency') || 'INR';

  const STATUS_STYLE = {
    pending_approval:
      'bg-yellow-50 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800/40',
    approved:
      'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800/40',
    paid: 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/40',
    rejected:
      'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800/40',
    finalized:
      'bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800/40',
  };

  const MONTH_NAMES = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  const formatStatus = (s) => {
    if (!s) return t('common.unknown', 'Unknown');
    const key = s.toLowerCase();
    return t(
      `dashboard.statuses.${key}`,
      s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    );
  };

  if (loading) {
    return <PayrollTableSkeleton />;
  }

  return (
    <main className="p-4 sm:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            {t('dashboard.payrollHistory', 'Payroll History')}
          </h1>
          {totalCount > 0 && (
            <p className="text-sm text-gray-500 dark:text-slate-500 mt-1">
              {t('dashboard.showingRecords', {
                start: startIdx,
                end: endIdx,
                total: totalCount,
                count: totalCount,
                defaultValue: `Showing ${startIdx}–${endIdx} of ${totalCount} record${totalCount !== 1 ? 's' : ''}`,
              })}
            </p>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="hidden sm:grid grid-cols-5 px-6 py-3 bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-800 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
          <span>{t('dashboard.table.employee', 'Employee')}</span>
          <span className="text-center">
            {t('dashboard.table.period', 'Period')}
          </span>
          <span className="text-right">
            {t('dashboard.table.baseSalary', 'Base Salary')}
          </span>
          <span className="text-right">
            {t('dashboard.table.netSalary', 'Net Salary')}
          </span>
          <span className="text-center">
            {t('dashboard.table.status', 'Status')}
          </span>
        </div>

        {payrolls.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-gray-500 dark:text-slate-500 text-sm">
              {t(
                'dashboard.noPayrollRecords',
                'No payroll records found for this month.',
              )}
            </p>
            <p className="text-gray-400 dark:text-slate-600 text-xs mt-1">
              {t(
                'dashboard.runPayrollHint',
                'Run payroll from Monthly Updates to see records here.',
              )}
            </p>
          </div>
        ) : (
          payrolls.map((p) => (
            <div
              key={p._id}
              className="grid grid-cols-1 sm:grid-cols-5 px-6 py-4 border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors items-center gap-2"
            >
              <div>
                <p className="font-semibold text-gray-900 dark:text-white text-sm">
                  {p.employeeName}
                </p>
              </div>
              <div className="text-center text-sm text-gray-600 dark:text-slate-400">
                {MONTH_NAMES[(p.month || 1) - 1]} {p.year}
              </div>
              <div className="text-right text-sm text-gray-700 dark:text-slate-300">
                {formatCurrency(p.baseSalary || 0, currency)}
              </div>
              <div className="text-right font-bold text-sm text-slate-900 dark:text-white">
                {formatCurrency(p.netSalary || 0, currency)}
              </div>
              <div className="flex sm:justify-center">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[p.status] || STATUS_STYLE['finalized']}`}
                >
                  {formatStatus(p.status)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-6">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
            className="px-4 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm font-semibold disabled:opacity-50 text-slate-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
          >
            ← {t('common.previous', 'Previous')}
          </button>
          <span className="text-sm text-gray-600 dark:text-slate-500">
            {t('common.page', {
              current: currentPage,
              total: totalPages,
              defaultValue: `Page ${currentPage} of ${totalPages}`,
            })}
          </span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
            className="px-4 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm font-semibold disabled:opacity-50 text-slate-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
          >
            {t('common.next', 'Next')} →
          </button>
        </div>
      )}
    </main>
  );
};

export default function PaySphereDashboard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const logout = useAppStore((state) => state.logout);

  // Replaced useState/useEffect with TanStack Query hooks (Issue #684)
  const {
    data: summary,
    isLoading: loading,
    error: queryError,
    refetch: refetchSummary,
  } = useDashboardSummary();

  const { data: recentActivity, isLoading: activityLoading } =
    useRecentActivity(5);
  const { data: trendData, isLoading: trendLoading } = usePayrollTrend(6);

  // Derived error state for backward compatibility with existing JSX
  const error = queryError ? queryError.message : null;

  const [activePage, setActivePage] = useState('Dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [employees, setEmployees] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [payrolls, setPayrolls] = useState([]);

  // Payroll-summary pagination state
  const [payrollPage, setPayrollPage] = useState(1);
  const [payrollTotalPages, setPayrollTotalPages] = useState(1);
  const [payrollTotalCount, setPayrollTotalCount] = useState(0);
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [paginatedPayrolls, setPaginatedPayrolls] = useState([]);

  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [employeeToEdit, setEmployeeToEdit] = useState(null);
  const [prevDebouncedSearch, setPrevDebouncedSearch] =
    useState(debouncedSearch);
  const [prevRoleFilter, setPrevRoleFilter] = useState(roleFilter);
  const companyName = localStorage.getItem('companyName') || 'Acme Corp';
  const token = useAppStore((state) => state.token);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const qParam = searchParams.get('q');

  // Deep-link support: /dashboard?tab=employees&q=Rahul lets the command
  // palette (Cmd+K) jump straight to a tab and pre-fill the search box.
  useEffect(() => {
    const TAB_IDS = ['Dashboard', 'Employees', 'Payroll', 'Approvals', 'Loans'];
    const targetTab = TAB_IDS.find(
      (id) => id.toLowerCase() === (tabParam || '').toLowerCase(),
    );

    if (targetTab) setActivePage(targetTab);

    if (qParam) {
      setSearch(qParam);
      // Consume the q param so it does not re-apply on the next mount.
      if (targetTab) setSearchParams({ tab: targetTab }, { replace: true });
    }
  }, [tabParam, qParam, setActivePage, setSearch, setSearchParams]);

  useEffect(() => {
    if (!token) {
      navigate('/auth');
    }
  }, [token, navigate]);

  // Auto-start onboarding tour for new users on initial load
  useEffect(() => {
    const { hasCompleted, hasDismissed, isActive, startTour } =
      useOnboardingStore.getState();
    if (token && !hasCompleted && !hasDismissed && !isActive) {
      const timer = setTimeout(() => {
        startTour();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [token]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset to page 1 when search term or role filter changes
  if (
    debouncedSearch !== prevDebouncedSearch ||
    roleFilter !== prevRoleFilter
  ) {
    setPrevDebouncedSearch(debouncedSearch);
    setPrevRoleFilter(roleFilter);
    setCurrentPage(1);
  }
  useEffect(() => {
    const fetchData = async () => {
      try {
        const params = new URLSearchParams({
          page: currentPage,
          limit: 10,
        });
        if (debouncedSearch) {
          params.append('search', debouncedSearch);
        }
        if (roleFilter) {
          params.append('role', roleFilter);
        }
        const [empRes, payRes] = await Promise.all([
          api.get(`/api/employees?${params.toString()}`),
          api.get(`/api/payroll/summary?limit=0`),
        ]);

        setEmployees(empRes.data.employees || []);
        setTotalPages(empRes.data.totalPages || 1);
        setTotalEmployees(empRes.data.totalEmployees || 0);
        setPayrolls(payRes.data.payrolls || []);
      } catch (err) {
        console.error('Failed to fetch data:', err);
      }
    };
    if (token) fetchData();
  }, [token, currentPage, debouncedSearch, roleFilter]);

  // Fetch paginated payroll records when viewing the Payroll tab
  useEffect(() => {
    if (!token) return;
    const fetchPayrollPage = async () => {
      setPayrollLoading(true);
      try {
        const res = await api.get(
          `/api/payroll/summary?page=${payrollPage}&limit=10`,
        );
        setPaginatedPayrolls(res.data.payrolls || []);
        setPayrollTotalPages(res.data.totalPages || 1);
        setPayrollTotalCount(res.data.totalCount || 0);
      } catch (err) {
        console.error('Failed to fetch payroll page:', err);
      } finally {
        setPayrollLoading(false);
      }
    };
    fetchPayrollPage();
  }, [token, payrollPage]);

  const payrollMap = {};
  payrolls.forEach((p) => {
    payrollMap[p.employeeId] = p;
  });

  const availableRoles = Array.from(
    new Set(employees.map((e) => e.role).filter(Boolean)),
  ).sort();

  const totalPayout = employees.reduce((sum, e) => {
    const p = payrollMap[e._id];
    return sum + (p ? p.netSalary : e.monthlySalary || 0);
  }, 0);

  const filtered = employees.filter((e) => {
    const matchesSearch =
      !search ||
      e.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (e.role || '').toLowerCase().includes(search.toLowerCase());
    const matchesRole =
      !roleFilter || (e.role || '').toLowerCase() === roleFilter.toLowerCase();
    return matchesSearch && matchesRole;
  });

  const handleDeleteEmployee = async () => {
    if (!employeeToDelete) return;

    try {
      setDeleting(true);

      await api.delete(`/api/employees/${employeeToDelete._id}`);

      setEmployees((prev) =>
        prev.filter((emp) => emp._id !== employeeToDelete._id),
      );

      setPayrolls((prev) =>
        prev.filter((p) => p.employeeId !== employeeToDelete._id),
      );

      setEmployeeToDelete(null);
      toast.success(
        t('dashboard.toasts.employeeDeleted', 'Employee deleted successfully.'),
      );
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error(
        error.response?.data?.message ||
          t(
            'dashboard.toasts.employeeDeleteFailed',
            'Failed to delete employee',
          ),
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleEditSubmit = async (id, updatedData) => {
    try {
      await api.put(`/api/employees/${id}`, updatedData);

      setEmployees((prev) =>
        prev.map((emp) => (emp._id === id ? { ...emp, ...updatedData } : emp)),
      );
      toast.success(
        t('dashboard.toasts.employeeUpdated', 'Employee updated successfully.'),
      );
      setEmployeeToEdit(null);
    } catch (error) {
      console.error('Failed to update employee:', error);

      if (error.response?.status === 409) {
        toast.error(
          error.response?.data?.message ||
            'This employee was changed by another user. Reload the employee and review the latest changes before saving again.',
        );
      } else {
        toast.error(
          t(
            'dashboard.toasts.employeeUpdateFailed',
            'Failed to update employee.',
          ),
        );
      }

      throw error;    }
  };

  const getInitials = (name) => {
    if (!name) return '';
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-950 flex font-sans text-slate-800 dark:text-slate-200 transition-colors duration-200">
      <Helmet>
        <title>
          {activePage === 'Dashboard'
            ? `${t('nav.dashboard', 'Payroll Dashboard')} | PaySphere`
            : `${t('nav.employees', 'Employee Management')} | PaySphere`}
        </title>
        <meta
          name="description"
          content={`Manage ${companyName}'s payroll and employees with ease.`}
        />
      </Helmet>

      {/* Sidebar */}
      <Sidebar
        companyName={companyName}
        activePage={activePage}
        setActivePage={(page) => {
          if (page === 'Reports') {
            navigate('/reports');
          } else if (page === 'Flashcards') {
            navigate('/flashcards');
          } else if (page === 'PYQs') {
            navigate('/pyqs');
          } else if (page === 'QuizBattle') {
            navigate('/quiz-battle');
          } else {
            setActivePage(page);
          }
        }}
        isSidebarOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main */}
      <div className="flex-1 flex flex-col md:ml-56 transition-all duration-300">
        {/* Topbar */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 transition-colors">
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              className="md:hidden p-2 -ml-2 text-gray-500 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open navigation sidebar"
            >
              ☰
            </button>
            <span className="font-bold text-blue-900 dark:text-blue-400 truncate">
              {t('dashboard.ledgerPayroll', 'Ledger Payroll')}
            </span>
            <button className="hidden sm:block text-blue-600 dark:text-blue-400 font-semibold border-b-2 border-blue-600 dark:border-blue-400 pb-0.5 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 capitalize">
              {new Date().toLocaleString(i18n?.language || 'en', {
                month: 'long',
                year: 'numeric',
              })}
            </button>
          </div>

          <div className="flex items-center gap-3 text-gray-500 dark:text-slate-500">
            <LanguageSwitcher />
            <ThemeToggle />
            <button
              onClick={() => navigate('/profile')}
              aria-label={t('settings.profile', 'Profile settings')}
              className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold shadow-sm hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              {getInitials(companyName)}
            </button>
            <button
              onClick={() => {
                logout();
                localStorage.removeItem('companyName');
                navigate('/');
              }}
              aria-label={t('nav.signOut', 'Sign Out')}
              className="px-3 py-1.5 cursor-pointer text-sm font-semibold text-red-500 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition"
            >
              {t('nav.signOut', 'Sign Out')}
            </button>
          </div>
        </header>

        {/* Dynamic Content and Mobile Nav wrapper */}
        <div className="pb-20 md:pb-0 transition-all duration-300">
          <ErrorBoundary fallback={<ComponentFeedbackFallback />}>
            {activePage === 'Approvals' ? (
              <Approvals />
            ) : activePage === 'Settlements' ? (
              <Settlements />
            ) : activePage === 'Loans' ? (
              <Loans />
            ) : activePage === 'Payroll' ? (
              <PayrollTable
                payrolls={paginatedPayrolls}
                loading={payrollLoading}
                currentPage={payrollPage}
                totalPages={payrollTotalPages}
                totalCount={payrollTotalCount}
                setCurrentPage={setPayrollPage}
              />
            ) : activePage === 'Dashboard' ? (
              <DashboardOverview
                search={search}
                setSearch={setSearch}
                roleFilter={roleFilter}
                setRoleFilter={setRoleFilter}
                availableRoles={availableRoles}
                filtered={filtered}
                navigate={navigate}
                onAddUpdate={() => navigate('/monthly-updates')}
                onAddEmployee={() => navigate('/add-employee')}
                totalPayout={totalPayout}
                employeeCount={totalEmployees}
                loading={loading}
                payrolls={payrolls}
                onEditEmployee={(emp) => setEmployeeToEdit(emp)}
              />
            ) : activePage === 'Archive' ? (
              <Archive />
            ) : (
              <EmployeeManagement
                search={search}
                setSearch={setSearch}
                roleFilter={roleFilter}
                setRoleFilter={setRoleFilter}
                availableRoles={availableRoles}
                employees={filtered}
                loading={loading}
                onAddEmployee={() => navigate('/add-employee')}
                onAddUpdate={() => navigate('/monthly-updates')}
                payrolls={payrolls}
                currentPage={currentPage}
                totalPages={totalPages}
                setCurrentPage={setCurrentPage}
                onDeleteEmployee={(emp) => setEmployeeToDelete(emp)}
                onEditEmployee={(emp) => setEmployeeToEdit(emp)}
              />
            )}
          </ErrorBoundary>

          {/* Edit Form Modal */}
          {employeeToEdit && (
            <EditEmployeeModal
              employee={employeeToEdit}
              onClose={() => setEmployeeToEdit(null)}
              onSave={handleEditSubmit}
            />
          )}

          {/* Delete Confirmation Modal */}
          {employeeToDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity">
              <div className="bg-white dark:bg-slate-900 rounded-xl p-6 w-96 shadow-xl border border-gray-200 dark:border-slate-800">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {t('dashboard.deleteModal.title', 'Delete Employee?')}
                </h2>

                <p className="mt-3 text-gray-600 dark:text-slate-500">
                  {t('dashboard.deleteModal.confirmPlain', {
                    name: employeeToDelete.fullName,
                    defaultValue: `Are you sure you want to delete ${employeeToDelete.fullName}?`,
                  })}
                  <br />
                  {t(
                    'dashboard.deleteModal.warning',
                    'Payroll records will also be deleted.',
                  )}
                </p>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setEmployeeToDelete(null)}
                    className="px-4 py-2 border border-gray-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>

                  <button
                    disabled={deleting}
                    onClick={handleDeleteEmployee}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                  >
                    {deleting
                      ? t('dashboard.deleteModal.deleting', 'Deleting...')
                      : t('common.delete', 'Delete')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Added BottomNavBar for mobile (Issue #1025) */}
        <BottomNavBar />
      </div>

      {/* Settings modal (extracted component) */}
      <SettingsModal
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      >
        <p className="text-sm text-gray-500 dark:text-slate-500">
          {t('settings.preferences', 'Settings will be available here soon.')}
        </p>
      </SettingsModal>
    </div>
  );
}
