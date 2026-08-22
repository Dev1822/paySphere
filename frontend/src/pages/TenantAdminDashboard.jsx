/**
 * TenantAdminDashboard.jsx - Tenant Admin Dashboard
 *
 * Comprehensive admin panel for tenant administrators showing:
 *   - Overview stats (users, employees, payroll runs)
 *   - Subscription status and usage (via SubscriptionPortal)
 *   - User management with role editing
 *   - System health and service status
 *   - Recent audit trail
 *
 * Registered in navigation.js under the 'compliance' group.
 */
import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import AdminUserTable from '../components/AdminUserTable';
import AdminSystemHealth from '../components/AdminSystemHealth';
import AdminAuditFeed from '../components/AdminAuditFeed';
import api from '../services/api';

const TABS = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'users', label: 'Users', icon: '👥' },
  { id: 'health', label: 'System Health', icon: '💚' },
  { id: 'audit', label: 'Audit Trail', icon: '📋' },
];

export default function TenantAdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalEmployees: 0,
    activePayrolls: 0,
    pendingApprovals: 0,
  });
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [usersRes, statsRes, subRes] = await Promise.allSettled([
        api.get('/api/roles'),
        api.get('/api/stats/departments'),
        api.get('/api/tenant/subscription'),
      ]);

      if (usersRes.status === 'fulfilled') {
        const userList = usersRes.value.data.roles || usersRes.value.data || [];
        setUsers(Array.isArray(userList) ? userList : []);
      }

      if (statsRes.status === 'fulfilled') {
        const depts = statsRes.value.data.departments || [];
        const totalEmployees = depts.reduce((sum, d) => sum + (d.employeeCount || 0), 0);
        setStats((prev) => ({ ...prev, totalEmployees, totalUsers: users.length || totalEmployees }));
      }

      if (subRes.status === 'fulfilled') {
        setSubscription(subRes.value.data);
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await api.put(`/api/roles/${userId}`, { role: newRole });
      setUsers((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, role: newRole } : u))
      );
    } catch (err) {
      console.error('Role change failed:', err);
      alert('Failed to update role: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
      <Helmet>
        <title>Admin Dashboard — PaySphere</title>
      </Helmet>
      <Sidebar activePage="Admin" setActivePage={() => {}} isSidebarOpen={false} onClose={() => {}} />

      <div className="lg:ml-64">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              🏢 Tenant Admin Dashboard
            </h1>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Manage your organization's PaySphere workspace
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchDashboardData}
              disabled={loading}
              className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition flex items-center gap-1"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
            <ThemeToggle />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 lg:px-8">
          <div className="flex gap-1 -mb-px overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                    : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:border-gray-300'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 lg:p-8">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  icon="👥"
                  label="Team Members"
                  value={stats.totalUsers || users.length || '—'}
                  color="blue"
                />
                <StatCard
                  icon="💼"
                  label="Employees"
                  value={stats.totalEmployees || '—'}
                  color="purple"
                />
                <StatCard
                  icon="📋"
                  label="Active Plan"
                  value={subscription?.plan || 'basic'}
                  color="amber"
                  subtext={subscription?.status || 'trialing'}
                />
                <StatCard
                  icon="⚡"
                  label="System Status"
                  value="Operational"
                  color="green"
                />
              </div>

              {/* Subscription Usage */}
              {subscription && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-4">
                    Usage & Limits
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <UsageBar
                      label="Employees"
                      current={subscription.usage?.employees || 0}
                      limit={subscription.limits?.employeeCount || 9999}
                    />
                    <UsageBar
                      label="Report Schedules"
                      current={subscription.usage?.reportSchedules || 0}
                      limit={subscription.limits?.reportSchedules || 5}
                    />
                  </div>
                </div>
              )}

              {/* Quick Links */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm">
                <h3 className="text-sm font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-4">
                  Quick Actions
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <QuickLink href="/add-employee" icon="➕" label="Add Employee" />
                  <QuickLink href="/reports" icon="📊" label="View Reports" />
                  <QuickLink href="/audit-logs" icon="📋" label="Audit Logs" />
                  <QuickLink href="/settings" icon="⚙️" label="Settings" />
                </div>
              </div>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <AdminUserTable
              users={users}
              loading={loading}
              onRoleChange={handleRoleChange}
            />
          )}

          {/* System Health Tab */}
          {activeTab === 'health' && <AdminSystemHealth />}

          {/* Audit Trail Tab */}
          {activeTab === 'audit' && <AdminAuditFeed limit={50} />}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({ icon, label, value, color, subtext }) {
  const gradients = {
    blue: 'from-blue-500 to-indigo-600',
    purple: 'from-purple-500 to-pink-600',
    amber: 'from-amber-500 to-orange-600',
    green: 'from-emerald-500 to-teal-600',
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradients[color]} flex items-center justify-center text-white text-lg shadow-md`}>
          {icon}
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white capitalize">{value}</div>
          <div className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide font-medium">{label}</div>
          {subtext && (
            <div className="text-[10px] text-gray-400 dark:text-slate-500 capitalize">{subtext}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function UsageBar({ label, current, limit }) {
  const pct = limit > 0 ? Math.min((current / limit) * 100, 100) : 0;
  const isWarning = pct > 80;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-slate-300">{label}</span>
        <span className="text-xs text-gray-500 dark:text-slate-400">
          {current} / {limit === 9999 ? '∞' : limit}
        </span>
      </div>
      <div className="w-full h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isWarning ? 'bg-amber-500' : 'bg-blue-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function QuickLink({ href, icon, label }) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all group"
    >
      <span className="text-xl">{icon}</span>
      <span className="text-sm font-semibold text-gray-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
        {label}
      </span>
    </a>
  );
}
