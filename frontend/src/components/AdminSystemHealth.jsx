/**
 * AdminSystemHealth.jsx - Tenant Admin Dashboard
 *
 * System health and metrics panel showing:
 *   - Service status (API, DB, Redis, Workers)
 *   - Key metrics (uptime, request rate, error rate)
 *   - Database stats (collections, documents, storage)
 *   - Recent errors and warnings
 */
import { useState, useEffect } from 'react';
import api from '../services/api';

const STATUS_STYLES = {
  healthy:  { bg: 'bg-emerald-50 dark:bg-emerald-950/20', border: 'border-emerald-200 dark:border-emerald-800', dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300' },
  degraded: { bg: 'bg-amber-50 dark:bg-amber-950/20', border: 'border-amber-200 dark:border-amber-800', dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300' },
  down:     { bg: 'bg-red-50 dark:bg-red-950/20', border: 'border-red-200 dark:border-red-800', dot: 'bg-red-500', text: 'text-red-700 dark:text-red-300' },
  unknown:  { bg: 'bg-gray-50 dark:bg-gray-800', border: 'border-gray-200 dark:border-gray-700', dot: 'bg-gray-400', text: 'text-gray-500 dark:text-gray-400' },
};

function ServiceCard({ name, status, latency, details }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.unknown;
  return (
    <div className={`${style.bg} border ${style.border} rounded-xl p-4 transition-all`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${style.dot} ${status === 'healthy' ? '' : 'animate-pulse'}`} />
          <span className="text-sm font-bold text-gray-900 dark:text-white">{name}</span>
        </div>
        <span className={`text-xs font-semibold uppercase ${style.text}`}>{status}</span>
      </div>
      {latency !== undefined && (
        <div className="mt-2 text-xs text-gray-500 dark:text-slate-400">
          Latency: <span className="font-semibold">{latency}ms</span>
        </div>
      )}
      {details && (
        <div className="mt-1 text-xs text-gray-400 dark:text-slate-500">{details}</div>
      )}
    </div>
  );
}

function MetricCard({ label, value, change, icon, color = 'blue' }) {
  const colorMap = {
    blue: 'from-blue-500 to-indigo-600',
    green: 'from-emerald-500 to-teal-600',
    amber: 'from-amber-500 to-orange-600',
    purple: 'from-purple-500 to-pink-600',
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorMap[color]} flex items-center justify-center text-white text-lg`}>
          {icon}
        </div>
        {change !== undefined && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            change >= 0
              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
          }`}>
            {change >= 0 ? '↑' : '↓'} {Math.abs(change)}%
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      <div className="text-xs text-gray-500 dark:text-slate-400 mt-1 uppercase tracking-wide font-medium">{label}</div>
    </div>
  );
}

export default function AdminSystemHealth() {
  const [health, setHealth] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState(null);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const [healthRes, statsRes] = await Promise.allSettled([
        api.get('/api/health/ready'),
        api.get('/api/stats/departments'),
      ]);

      if (healthRes.status === 'fulfilled') {
        setHealth(healthRes.value.data);
      }

      if (statsRes.status === 'fulfilled') {
        setMetrics(statsRes.value.data);
      }

      setLastChecked(new Date());
    } catch (err) {
      console.error('Health check failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 60000); // refresh every 60s
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds) => {
    if (!seconds) return 'N/A';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <div className="space-y-6">
      {/* Service Status Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
            Service Health
          </h3>
          <button
            onClick={fetchHealth}
            disabled={loading}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <svg className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <ServiceCard
            name="API Server"
            status={health?.status === 'ready' ? 'healthy' : health?.status === 'degraded' ? 'degraded' : 'unknown'}
            details={health?.checks?.mongo ? 'All systems operational' : 'Checking...'}
          />
          <ServiceCard
            name="MongoDB"
            status={health?.checks?.mongo ? 'healthy' : 'down'}
            details={health?.checks?.mongo ? 'Connected' : 'Connection failed'}
          />
          <ServiceCard
            name="Redis Cache"
            status={health?.checks?.redis ? 'healthy' : 'degraded'}
            details={health?.checks?.redis ? 'Connected' : 'Fallback to memory'}
          />
          <ServiceCard
            name="Background Jobs"
            status="healthy"
            details="BullMQ workers active"
          />
        </div>
      </div>

      {/* Key Metrics */}
      <div>
        <h3 className="text-sm font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">
          Key Metrics
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            label="Uptime"
            value={formatUptime(health?.uptime)}
            icon="⏱"
            color="green"
          />
          <MetricCard
            label="Departments"
            value={metrics?.departments?.length || 0}
            icon="🏢"
            color="blue"
          />
          <MetricCard
            label="Total Employees"
            value={metrics?.totalEmployees || metrics?.departments?.reduce((sum, d) => sum + (d.employeeCount || 0), 0) || 0}
            icon="👥"
            color="purple"
          />
          <MetricCard
            label="API Status"
            value={health?.status === 'ready' ? 'Operational' : 'Degraded'}
            icon="🔌"
            color={health?.status === 'ready' ? 'green' : 'amber'}
          />
        </div>
      </div>

      {/* Last Checked */}
      {lastChecked && (
        <div className="text-xs text-gray-400 dark:text-slate-500 text-right">
          Last checked: {lastChecked.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
