/**
 * AdminUserTable.jsx - Tenant Admin Dashboard
 *
 * User management table with search, role filtering, and inline actions.
 * Displays all users in the tenant with their roles, status, and last login.
 */
import { useState, useMemo } from 'react';

const ROLE_BADGES = {
  owner:    { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-800 dark:text-amber-300' },
  admin:    { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-800 dark:text-purple-300' },
  manager:  { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-300' },
  employee: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300' },
};

function formatRelativeTime(date) {
  if (!date) return 'Never';
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

export default function AdminUserTable({ users = [], loading, onRoleChange }) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState('fullName');
  const [sortDir, setSortDir] = useState('asc');

  const filtered = useMemo(() => {
    let result = [...users];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (u) =>
          (u.fullName || '').toLowerCase().includes(q) ||
          (u.email || '').toLowerCase().includes(q)
      );
    }

    // Role filter
    if (roleFilter !== 'all') {
      result = result.filter((u) => u.role === roleFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((u) =>
        statusFilter === 'active' ? u.isActive : !u.isActive
      );
    }

    // Sort
    result.sort((a, b) => {
      const aVal = a[sortField] || '';
      const bVal = b[sortField] || '';
      const cmp = typeof aVal === 'string' ? aVal.localeCompare(bVal) : aVal - bVal;
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [users, search, roleFilter, statusFilter, sortField, sortDir]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }) => (
    <span className="ml-1 text-gray-400">
      {sortField === field ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  );

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            👥 User Management
            <span className="text-xs font-normal text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
              {filtered.length} users
            </span>
          </h2>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-400 focus:outline-none"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-400 focus:outline-none"
          >
            <option value="all">All Roles</option>
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="employee">Employee</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-400 focus:outline-none"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100 dark:divide-slate-800">
          <thead className="bg-gray-50 dark:bg-slate-800/50">
            <tr>
              <th
                onClick={() => handleSort('fullName')}
                className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-slate-200"
              >
                User <SortIcon field="fullName" />
              </th>
              <th
                onClick={() => handleSort('role')}
                className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-slate-200"
              >
                Role <SortIcon field="role" />
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Status
              </th>
              <th
                onClick={() => handleSort('lastLoginAt')}
                className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-slate-200"
              >
                Last Active <SortIcon field="lastLoginAt" />
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-slate-800/50">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-slate-400">
                  <div className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Loading users...
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-slate-400">
                  No users found matching your filters.
                </td>
              </tr>
            ) : (
              filtered.map((user) => {
                const badge = ROLE_BADGES[user.role] || ROLE_BADGES.employee;
                return (
                  <tr key={user._id} className="hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                          {(user.fullName || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">
                            {user.fullName || 'Unknown'}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-slate-400">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${badge.bg} ${badge.text}`}>
                        {user.role || 'employee'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${user.isActive !== false ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                        <span className="text-sm text-gray-700 dark:text-slate-300">
                          {user.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-slate-400">
                      {formatRelativeTime(user.lastLoginAt)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <select
                        value={user.role || 'employee'}
                        onChange={(e) => onRoleChange?.(user._id, e.target.value)}
                        className="text-xs px-2 py-1 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-400 focus:outline-none"
                      >
                        <option value="employee">Employee</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                        {user.role === 'owner' && <option value="owner">Owner</option>}
                      </select>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
