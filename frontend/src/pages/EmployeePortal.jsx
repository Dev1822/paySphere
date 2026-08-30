import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ThemeToggle from '../components/ThemeToggle';
import LanguageSwitcher from '../components/LanguageSwitcher';
import Sidebar from '../components/Sidebar';
import EmployeePortalSkeleton from '../components/common/skeleton/EmployeePortalSkeleton';
import api from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { formatCurrency, formatDate } from '../utils/formatLocale';
import ClinicalOutcomesTracker from '../components/ClinicalOutcomesTracker';
import EmployeeTimeline from '../components/EmployeeTimeline';

export default function EmployeePortal() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Overview');
  const logout = useAppStore((state) => state.logout);
  const companyName = localStorage.getItem('companyName') || 'PaySphere';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profRes, payRes] = await Promise.all([
          api.get('/api/employee-portal/profile'),
          api.get('/api/employee-portal/payslips'),
        ]);

        setProfile(profRes.data.user);
        setEmployee(profRes.data.employee);
        setPayslips(payRes.data.payrolls || []);
      } catch (err) {
        console.error('Failed to fetch employee portal data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSignOut = () => {
    logout();
    navigate('/auth');
  };

  const getMonthName = (monthNum) => {
    const date = new Date();
    date.setMonth(monthNum - 1);
    return formatDate(date, { month: 'long' });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      <Helmet>
        <title>
          {t('portal.title', 'Employee Self-Service Portal')} | PaySphere
        </title>
        <meta
          name="description"
          content="View your profile, payslips, and attendance history."
        />
      </Helmet>

      <Sidebar
        companyName={companyName}
        activePage="My portal"
        setActivePage={() => {}}
        isSidebarOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onLogout={handleSignOut}
      />

      {/* Top Bar */}
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 sm:px-6 md:ml-56 flex items-center justify-between sticky top-0 z-30 transition-colors">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open sidebar"
            className="md:hidden p-2 -ml-2 text-gray-600 dark:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
          >
            ☰
          </button>
          <span className="font-bold text-xl text-blue-600 dark:text-blue-400">
            PaySphere
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold uppercase tracking-wider">
            {t('portal.badge', 'Employee Portal')}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          <ThemeToggle />
          <button
            onClick={() => navigate('/profile')}
            aria-label={t('portal.profileSettings', 'Profile Settings')}
            className="px-3.5 py-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition"
          >
            {t('portal.profileSettings', 'Profile Settings')}
          </button>
          <button
            onClick={handleSignOut}
            aria-label={t('nav.signOut', 'Sign Out')}
            className="px-3.5 py-1.5 text-sm font-semibold text-red-500 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition"
          >
            {t('nav.signOut', 'Sign Out')}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full md:w-[calc(100%-14rem)] md:ml-56 p-4 sm:p-8 space-y-8">
        {loading ? (
          <EmployeePortalSkeleton />
        ) : (
          <>
            {/* Header Card */}
            <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                  {t('portal.welcomeBack', 'Welcome back')}
                </p>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-1">
                  {profile?.fullName || t('portal.employee', 'Employee')}
                </h1>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                  {employee?.role ? `${employee.role} • ` : ''}
                  {profile?.companyName || 'PaySphere'}
                </p>
              </div>

              {employee && (
                <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-gray-100 dark:border-slate-800 flex gap-6">
                  <div>
                    <p className="text-xs uppercase text-gray-400 font-bold">
                      {t('portal.baseMonthlySalary', 'Base Monthly Salary')}
                    </p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                      {formatCurrency(employee.monthlySalary || 0, 'INR')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-400 font-bold">
                      {t('portal.overtimeRate', 'Overtime Rate')}
                    </p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                      {formatCurrency(employee.overtimeRate || 0, 'INR')}/
                      {t('portal.perHour', 'hr')}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex space-x-1 border-b border-gray-200 dark:border-slate-800 mb-6 overflow-x-auto">
              {['Overview', 'My Journey'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2.5 text-sm font-bold whitespace-nowrap transition-colors border-b-2 ${
                    activeTab === tab
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  {tab === 'Overview'
                    ? t('portal.overview', 'Overview')
                    : t('timeline.title', 'My Journey')}
                </button>
              ))}
            </div>

            {activeTab === 'Overview' ? (
              <>
                <div className="mb-6">
                  <ClinicalOutcomesTracker />
                </div>

                {/* Payslips History */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm p-6">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">
                    {t('portal.payslipHistory', 'Payslip History')}
                  </h2>

                  {payslips.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 dark:text-slate-400">
                      {t(
                        'portal.noPayslips',
                        'No payslips finalized for you yet.',
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table
                        aria-label="Payslip History Table"
                        className="w-full text-left text-sm"
                      >
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-slate-800 text-gray-400 dark:text-slate-400 uppercase text-xs">
                            <th className="py-3 px-4">
                              {t('portal.period', 'Period')}
                            </th>
                            <th className="py-3 px-4">
                              {t('portal.baseSalary', 'Base Salary')}
                            </th>
                            <th className="py-3 px-4">
                              {t('portal.overtimePay', 'Overtime Pay')}
                            </th>
                            <th className="py-3 px-4">
                              {t('portal.leaveDeductions', 'Leave Deductions')}
                            </th>
                            <th className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                              {t('portal.netPayout', 'Net Payout')}
                            </th>
                            <th className="py-3 px-4">
                              {t('portal.status', 'Status')}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                          {payslips.map((pay) => (
                            <tr
                              key={pay._id}
                              className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                            >
                              <td className="py-4 px-4 font-semibold text-slate-900 dark:text-white">
                                {getMonthName(pay.month)} {pay.year}
                              </td>
                              <td className="py-4 px-4 text-slate-600 dark:text-slate-300">
                                {formatCurrency(pay.baseSalary, 'INR')}
                              </td>
                              <td className="py-4 px-4 text-emerald-600 dark:text-emerald-400">
                                +{formatCurrency(pay.overtimePay, 'INR')}
                              </td>
                              <td className="py-4 px-4 text-red-500 dark:text-red-400">
                                -{formatCurrency(pay.leaveDeduction, 'INR')}
                              </td>
                              <td className="py-4 px-4 font-bold text-blue-600 dark:text-blue-400">
                                {formatCurrency(pay.netSalary, 'INR')}
                              </td>
                              <td className="py-4 px-4">
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                                  {pay.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <EmployeeTimeline employeeId={employee?._id} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
