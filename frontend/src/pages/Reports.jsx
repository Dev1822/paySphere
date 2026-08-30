import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { useAppStore } from '../store/useAppStore';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import ReportsSkeleton from '../components/common/skeleton/ReportsSkeleton';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatDate } from '../utils/formatLocale';

// --- Recharts Components ---
import CustomReportBuilder from '../components/reports/CustomReportBuilder';
import DepartmentChart from '../components/reports/DepartmentChart';
import OvertimeChart from '../components/reports/OvertimeChart';
import PayrollTable from '../components/reports/PayrollTable';
import PayrollTrendChart from '../components/reports/PayrollTrendChart';
import SalaryDistributionChart from '../components/reports/SalaryDistributionChart';
import ScheduleReportModal from '../components/reports/ScheduleReportModal';
import SummaryCards from '../components/reports/SummaryCards';
import TurnoverMetrics from '../components/reports/TurnoverMetrics';
import { formatCurrency } from "../utils/currency";

// --- Month-Year Selector ---
const REPORT_TABS = [
  { id: 'analytics', labelKey: 'reports.payrollAnalytics' },
  { id: 'hr', labelKey: 'reports.hrMetrics' },
  { id: 'custom', labelKey: 'reports.customReport' },
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MonthYearSelector = ({ month, year, onChange }) => (
  <div className="flex gap-2">
    <select
      value={month}
      onChange={(e) => onChange(Number(e.target.value), year)}
      className="px-4 py-2 border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
    >
      {MONTH_NAMES.map((name, i) => (
        <option key={i} value={i + 1}>{name}</option>
      ))}
    </select>
    <select
      value={year}
      onChange={(e) => onChange(month, Number(e.target.value))}
      className="px-4 py-2 border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
    >
      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
        <option key={y} value={y}>{y}</option>
      ))}
    </select>
  </div>
);

// --- Download Helper ---
const downloadFileWithProgress = async (url, filename, type, setExportingType, toast) => {
  setExportingType(type);
  try {
    const res = await api.get(url, { responseType: 'blob' });
    const blob = res.data;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    toast.success('Download completed successfully!');
  } catch (err) {
    console.error('Export failed:', err);
    let errorMessage = 'Failed to download report. No data for the selected period.';
    if (err.response && err.response.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        const json = JSON.parse(text);
        errorMessage = json.message || errorMessage;
      } catch (e) {}
    } else if (err.response?.data?.message) {
      errorMessage = err.response.data.message;
    } else if (err.message) {
      errorMessage = err.message;
    }
    toast.error(errorMessage);
  } finally {
    setExportingType(null);
  }
};

export default function Reports() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const token = useAppStore((state) => state.token);
  const { toast } = useToast();
  const [activePage, setActivePage] = useState('Reports');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('analytics');

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [loading, setLoading] = useState(true);
  const [exportingType, setExportingType] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  // Multi-select department filter state
  const [selectedDepartments, setSelectedDepartments] = useState([]);
  const [availableDepartments, setAvailableDepartments] = useState([]);
  
  const companyName = localStorage.getItem('companyName') || 'PaySphere';
  const currency = localStorage.getItem('currency') || 'INR';

  useEffect(() => {
    if (!token) navigate('/auth');
  }, [token, navigate]);

  // Fetch available departments from employees
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await api.get('/api/employees?limit=1000');
        const employees = res.data.employees || [];

        // Extract unique departments (excluding empty strings)
        const departments = [...new Set(
          employees
            .map(emp => emp.department || emp.role)
            .filter(dept => dept && dept.trim() !== '')
        )].sort();

        const departmentOptions = departments.map(dept => ({
          value: dept,
          label: dept,
        }));

        setAvailableDepartments(departmentOptions);
      } catch (err) {
        console.error('Failed to fetch departments:', err);
      }
    };

    if (token) fetchDepartments();
  }, [token]);

  useEffect(() => {
    const fetchReportsData = async () => {
      setLoading(true);
      try {
        // Build query parameters for department filtering
        const departmentParams = selectedDepartments.length > 0
          ? `&departments=${selectedDepartments.map(d => d.value).join(',')}`
          : '';

        const [analyticsRes, summaryRes] = await Promise.all([
          api.get(`/api/reports/analytics?months=6${departmentParams}`),
          api.get(`/api/payroll/summary?month=${month}&year=${year}${departmentParams}`)
        ]);

        const analytics = analyticsRes.data;
        const payrolls = summaryRes.data.payrolls || [];

        // Filter payrolls by selected departments if any are selected
        const filteredPayrolls = selectedDepartments.length > 0
          ? payrolls.filter(p => {
            const dept = p.role || p.department;
            return selectedDepartments.some(selected => selected.value === dept);
          })
          : payrolls;

        // Format for Recharts components
        const formattedData = {
          summary: {
            totalPayroll: formatCurrency(analytics.summary.totalPayout, currency),
            employeesCount: analytics.summary.totalRecords,
            averageSalary: formatCurrency(analytics.summary.totalRecords > 0 ? Math.round(analytics.summary.totalPayout / analytics.summary.totalRecords) : 0, currency),
            overtime: formatCurrency(analytics.summary.totalOvertime, currency),
            deductions: formatCurrency(analytics.summary.totalDeductions, currency),
          },
          trend: analytics.monthlyTrends.map(t => ({
            month: t.label,
            payroll: t.totalPayout
          })),
          department: analytics.roleBreakdown
            .filter(r => selectedDepartments.length === 0 || selectedDepartments.some(d => d.value === r.role))
            .map(r => ({
              department: r.role,
              payroll: r.totalPayout
            })),
          salary: [
            { name: "Salary", value: analytics.summary.totalBase },
            { name: "Bonus", value: analytics.summary.totalBonus },
            { name: "Overtime", value: analytics.summary.totalOvertime }
          ],
          overtime: filteredPayrolls.map(p => ({
            employee: p.employeeName,
            overtime: p.overtimePay,
            deductions: p.deductions + p.leaveDeduction
          })),
          table: filteredPayrolls.map(p => ({
            id: p._id,
            name: p.employeeName,
            department: p.role || p.department,
            salary: formatCurrency(p.baseSalary, currency),
            bonus: formatCurrency(p.bonus, currency),
            overtime: formatCurrency(p.overtimePay, currency),
            deduction: formatCurrency(p.deductions + p.leaveDeduction, currency),
            net: formatCurrency(p.netSalary, currency),
            netSalary: p.netSalary,
            status: p.status || "Paid",
            date: formatDate(p.updatedAt),
          }))
        };

        setReportData(formattedData);
      } catch (err) {
        console.error('Failed to fetch reports data:', err);
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchReportsData();
  }, [token, month, year, selectedDepartments]);

  const handleMonthChange = (m, y) => {
    setMonth(m);
    setYear(y);
  };

  const handleDepartmentChange = (selectedOptions) => {
    setSelectedDepartments(selectedOptions || []);
  };

  const handleDownloadPDF = () => {
    const departmentParams = selectedDepartments.length > 0
      ? `&departments=${selectedDepartments.map(d => d.value).join(',')}`
      : '';
    downloadFileWithProgress(
      `/api/reports/download-pdf?month=${month}&year=${year}${departmentParams}`,
      `payroll-report-${MONTH_NAMES[month - 1]}-${year}.pdf`,
      'pdf',
      setExportingType,
      toast
    );
  };

  const handleExportCSV = () => {
    const departmentParams = selectedDepartments.length > 0
      ? `&departments=${selectedDepartments.map(d => d.value).join(',')}`
      : '';
    downloadFileWithProgress(
      `/api/payroll/export-csv?month=${month}&year=${year}${departmentParams}`,
      `payroll-export-${MONTH_NAMES[month - 1]}-${year}.csv`,
      'csv',
      setExportingType,
      toast
    );
  };

  const handleExportXLSX = () => {
    const departmentParams = selectedDepartments.length > 0
      ? `&departments=${selectedDepartments.map(d => d.value).join(',')}`
      : '';
    downloadFileWithProgress(
      `/api/reports/export-xlsx?month=${month}&year=${year}${departmentParams}`,
      `payroll-summary-${MONTH_NAMES[month - 1]}-${year}.xlsx`,
      'xlsx',
      setExportingType,
      toast
    );
  };

  const handleDownloadZIP = () => {
    const departmentParams = selectedDepartments.length > 0
      ? `&departments=${selectedDepartments.map(d => d.value).join(',')}`
      : '';
    downloadFileWithProgress(
      `/api/reports/download-zip?month=${month}&year=${year}${departmentParams}`,
      `payslips-${MONTH_NAMES[month - 1]}-${year}.zip`,
      'zip',
      setExportingType,
      toast
    );
  };

  const getInitials = (name) => {
    if (!name) return '';
    return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  };

  // Custom styles for react-select to match the app's theme
  const selectStyles = {
    control: (base, state) => ({
      ...base,
      backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#ffffff',
      borderColor: state.isFocused ? '#3b82f6' : (document.documentElement.classList.contains('dark') ? '#475569' : '#e5e7eb'),
      borderWidth: '1px',
      borderRadius: '0.5rem',
      boxShadow: state.isFocused ? '0 0 0 2px rgba(59, 130, 246, 0.2)' : 'none',
      '&:hover': {
        borderColor: '#3b82f6',
      },
      minHeight: '42px',
    }),
    menu: (base) => ({
      ...base,
      backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#ffffff',
      border: `1px solid ${document.documentElement.classList.contains('dark') ? '#475569' : '#e5e7eb'}`,
      borderRadius: '0.5rem',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected
        ? '#3b82f6'
        : state.isFocused
          ? (document.documentElement.classList.contains('dark') ? '#334155' : '#f3f4f6')
          : 'transparent',
      color: state.isSelected ? '#ffffff' : (document.documentElement.classList.contains('dark') ? '#e2e8f0' : '#1e293b'),
      '&:hover': {
        backgroundColor: state.isSelected ? '#3b82f6' : (document.documentElement.classList.contains('dark') ? '#334155' : '#f3f4f6'),
      },
      cursor: 'pointer',
    }),
    multiValue: (base) => ({
      ...base,
      backgroundColor: document.documentElement.classList.contains('dark') ? '#334155' : '#dbeafe',
      borderRadius: '0.375rem',
    }),
    multiValueLabel: (base) => ({
      ...base,
      color: document.documentElement.classList.contains('dark') ? '#e2e8f0' : '#1e40af',
      fontSize: '0.875rem',
      fontWeight: 500,
    }),
    multiValueRemove: (base) => ({
      ...base,
      color: document.documentElement.classList.contains('dark') ? '#94a3b8' : '#3b82f6',
      '&:hover': {
        backgroundColor: document.documentElement.classList.contains('dark') ? '#475569' : '#bfdbfe',
        color: document.documentElement.classList.contains('dark') ? '#e2e8f0' : '#1e40af',
      },
    }),
    placeholder: (base) => ({
      ...base,
      color: document.documentElement.classList.contains('dark') ? '#94a3b8' : '#6b7280',
    }),
    input: (base) => ({
      ...base,
      color: document.documentElement.classList.contains('dark') ? '#e2e8f0' : '#1e293b',
    }),
    singleValue: (base) => ({
      ...base,
      color: document.documentElement.classList.contains('dark') ? '#e2e8f0' : '#1e293b',
    }),
    noOptionsMessage: (base) => ({
      ...base,
      color: document.documentElement.classList.contains('dark') ? '#94a3b8' : '#6b7280',
    }),
  };

  return (
    <>
      <Helmet>
        <title>{t('reports.pageTitle', 'Reports & Analytics | PaySphere')}</title>
      </Helmet>

      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
        {/* Sidebar */}
        <Sidebar
          activePage={activePage}
          setActivePage={(page) => {
            setActivePage(page);
            if (page !== 'Reports') navigate(`/${page.toLowerCase()}`);
          }}
          isSidebarOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        {/* Topbar */}
        <div className="lg:ml-64">
          <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
            <button
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open navigation sidebar"
              className="lg:hidden p-2 rounded-md text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-800 transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/dashboard")}
                aria-label="Back to dashboard"
                className="p-1 rounded-md text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-800 transition"
              >
                <ArrowBackIcon />
              </button>
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400">{t('reports.payrollAnalytics', 'Payroll Analytics')}</p>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('nav.reports', 'Reports')}</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
            </div>
          </div>

          {/* Content */}
          <div className="p-4 lg:p-8">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <MonthYearSelector month={month} year={year} onChange={handleMonthChange} />
              </div>
              <button
                onClick={() => setIsScheduleModalOpen(true)}
                aria-label="Schedule Report"
                className="px-4 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-semibold hover:bg-gray-50 dark:hover:bg-slate-700 transition"
              >
                Schedule Report
              </button>
            </div>

          {/* View switcher. TurnoverMetrics and CustomReportBuilder are imported
              and rendered by the branches further down, but with no control to
              set `activeTab` there was no way to reach either of them. */}
          <div className="flex flex-wrap gap-1 mb-6 border-b border-gray-200 dark:border-slate-800">
            {REPORT_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                className={`px-4 py-2 -mb-px text-sm font-semibold border-b-2 transition ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                    : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                }`}
              >
                {t(`reports.${tab.labelKey?.split('.').pop()}`, tab.labelKey?.split('.').pop())}
              </button>
            ))}
          </div>

          {/* Department Filter */}
          {activeTab === 'analytics' && (
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {t('reports.filterByDepartment', 'Filter by Department(s)')}
              </label>
              <Select
                isMulti
                options={availableDepartments}
                value={selectedDepartments}
                onChange={handleDepartmentChange}
                styles={selectStyles}
                placeholder={t('reports.allDepartments', 'All Departments')}
                noOptionsMessage={() => t('reports.noDepartmentsFound', 'No departments found')}
                isClearable
                className="max-w-md"
              />
              {selectedDepartments.length > 0 && (
                <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
                  Showing data for {selectedDepartments.length} department{selectedDepartments.length > 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}

            {/* Export Action Bar */}
            {activeTab === 'analytics' && (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 mb-6 flex flex-wrap gap-3">
                <button
                  onClick={handleDownloadPDF}
                  disabled={exportingType !== null}
                  aria-label="Download PDF Report"
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg text-sm font-semibold transition"
                >
                  {exportingType === 'pdf' ? (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                  {exportingType === 'pdf' ? t('reports.compilingPdf', 'Compiling PDF...') : t('reports.downloadPdf', 'Download PDF Report')}
                </button>

                <button
                  onClick={handleDownloadZIP}
                  disabled={exportingType !== null}
                  aria-label="Download All Payslips ZIP"
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-lg text-sm font-semibold transition"
                >
                  {exportingType === 'zip' ? (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                  )}
                  {exportingType === 'zip' ? t('reports.compilingZip', 'Compiling Payslips ZIP...') : t('reports.downloadZip', 'Download All Payslips (ZIP)')}
                </button>

                <button
                  onClick={handleExportXLSX}
                  disabled={exportingType !== null}
                  aria-label="Export Payroll Summary Excel"
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-semibold transition"
                >
                  {exportingType === 'xlsx' ? (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                  {exportingType === 'xlsx' ? t('reports.compilingExcel', 'Compiling Excel...') : t('reports.exportXlsx', 'Export Payroll Summary (.xlsx)')}
                </button>

                <button
                  onClick={handleExportCSV}
                  disabled={exportingType !== null}
                  aria-label="Export Payroll Summary CSV"
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-semibold transition"
                >
                  {exportingType === 'csv' ? (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  )}
                  {exportingType === 'csv' ? t('reports.exportingCsv', 'Exporting CSV...') : t('reports.exportCsv', 'Export Accounting CSV')}
                </button>
              </div>
            )}

            {exportingType && (
              <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-center gap-3">
                <svg className="animate-spin h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Compiling and generating exported file for {MONTH_NAMES[month - 1]} {year}... Please wait.
                </p>
              </div>
            )}

            {activeTab === 'hr' ? (
              <TurnoverMetrics />
            ) : activeTab === 'custom' ? (
              <CustomReportBuilder />
            ) : loading ? (
              <ReportsSkeleton />
            ) : !reportData || reportData.table.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-12 text-center">
                <svg className="mx-auto h-16 w-16 text-gray-400 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">{t('reports.noPayrollData', 'No payroll data yet')}</h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
                  {t('reports.runPayrollHint', 'Run payroll for at least one month to see analytics and generate reports.')}
                </p>
                <button
                  onClick={() => navigate('/monthly-updates')}
                  className="mt-4 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition shadow-md shadow-blue-200 dark:shadow-none"
                >
                  {t('dashboard.runPayroll', 'Run Payroll')}
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Recharts Components from PR #245 */}
                <SummaryCards data={reportData.summary} />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <PayrollTrendChart data={reportData.trend} />
                  <DepartmentChart data={reportData.department} />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <SalaryDistributionChart data={reportData.salary} />
                  <OvertimeChart data={reportData.overtime} />
                </div>
                <PayrollTable data={reportData.table} currency={currency} />
              </div>
            )}
          </div>
        </div>

        <ScheduleReportModal
          isOpen={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          onScheduled={() => toast.success('Report scheduled successfully!')}
        />
      </div>
    </>
  );
}
