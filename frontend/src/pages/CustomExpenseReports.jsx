import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { formatDate, formatCurrency } from '../utils/formatLocale';

const CATEGORIES = ['Travel', 'Meals', 'Lodging', 'Office Supplies', 'Software', 'Client Entertainment', 'Other'];

export default function CustomExpenseReports() {
  const [activeTab, setActiveTab] = useState('reports');
  const [reports, setReports] = useState([]);
  const [myClaims, setMyClaims] = useState([]);
  const [loading, setLoading] = useState(false);
  const { showNotification } = useAppStore();

  // New report form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedClaimIds, setSelectedClaimIds] = useState([]);

  // New single expense submission state
  const [category, setCategory] = useState('Meals');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [expenseDesc, setExpenseDesc] = useState('');

  // Export filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [exportSummary, setExportSummary] = useState(null);

  useEffect(() => {
    fetchMyReports();
    fetchMyClaims();
  }, []);

  const fetchMyReports = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/expenses/reports/my');
      setReports(res.data.reports || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyClaims = async () => {
    try {
      const res = await api.get('/api/expenses/claims/my');
      setMyClaims(res.data.claims || res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateExpenseClaim = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/expenses/claims', {
        category,
        amount: parseFloat(amount),
        expenseDate,
        description: expenseDesc,
      });
      showNotification({ message: 'Expense claim added!', severity: 'success' });
      setAmount('');
      setExpenseDesc('');
      fetchMyClaims();
    } catch (err) {
      showNotification({ message: err.response?.data?.message || 'Failed to add claim', severity: 'error' });
    }
  };

  const handleCreateCustomReport = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      showNotification({ message: 'Title is required', severity: 'error' });
      return;
    }
    try {
      await api.post('/api/expenses/reports/custom', {
        title,
        description,
        claimIds: selectedClaimIds,
      });
      showNotification({ message: 'Custom expense report created!', severity: 'success' });
      setTitle('');
      setDescription('');
      setSelectedClaimIds([]);
      fetchMyReports();
      setActiveTab('reports');
    } catch (err) {
      showNotification({ message: err.response?.data?.message || 'Failed to create report', severity: 'error' });
    }
  };

  const handleFetchExport = async () => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (filterCategory) params.append('category', filterCategory);
      if (filterStatus) params.append('status', filterStatus);

      const res = await api.get(`/api/expenses/reports/export?${params.toString()}`);
      setExportSummary(res.data);
    } catch (err) {
      showNotification({ message: 'Failed to generate export preview', severity: 'error' });
    }
  };

  const handleDownloadCSV = () => {
    if (!exportSummary?.claims) return;
    const headers = ['ID', 'Category', 'Amount', 'Date', 'Description', 'Status'];
    const rows = exportSummary.claims.map((c) => [
      c._id,
      c.category,
      c.amount,
      c.expenseDate ? formatDate(c.expenseDate) : '',
      `"${(c.description || '').replace(/"/g, '""')}"`,
      c.status,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Expense_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'reimbursed':
        return 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300';
      case 'approved':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300';
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300';
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors">
      <Helmet>
        <title>Custom Expense Reports - PaySphere</title>
      </Helmet>

      <Sidebar activePage="Expense Reports" isSidebarOpen={false} onClose={() => {}} />

      <div className="lg:ml-64">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Custom Expense Reports</h1>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Submit, bundle expenses, track reimbursement status & export report summaries.
            </p>
          </div>
          <ThemeToggle />
        </header>

        {/* Content Container */}
        <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6">
          {/* Navigation Tabs */}
          <div className="flex border-b border-gray-200 dark:border-slate-800 gap-4">
            <button
              onClick={() => setActiveTab('reports')}
              className={`pb-3 font-semibold text-sm transition border-b-2 ${
                activeTab === 'reports'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400'
              }`}
            >
              My Expense Reports ({reports.length})
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={`pb-3 font-semibold text-sm transition border-b-2 ${
                activeTab === 'create'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400'
              }`}
            >
              Create New Custom Report
            </button>
            <button
              onClick={() => setActiveTab('export')}
              className={`pb-3 font-semibold text-sm transition border-b-2 ${
                activeTab === 'export'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400'
              }`}
            >
              Export & Analytics
            </button>
          </div>

          {/* TAB 1: MY REPORTS */}
          {activeTab === 'reports' && (
            <div className="space-y-4">
              {loading ? (
                <p className="text-gray-500 dark:text-slate-400">Loading reports...</p>
              ) : reports.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-8 rounded-xl text-center">
                  <p className="text-gray-500 dark:text-slate-400">No expense reports submitted yet.</p>
                  <button
                    onClick={() => setActiveTab('create')}
                    className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
                  >
                    Create Custom Report
                  </button>
                </div>
              ) : (
                reports.map((report) => (
                  <div
                    key={report._id}
                    className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">{report.title}</h3>
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                          Submitted on {formatDate(report.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-base text-gray-900 dark:text-white">
                          {formatCurrency(report.totalAmount || 0)}
                        </span>
                        <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase ${getStatusBadge(report.status)}`}>
                          {report.status}
                        </span>
                      </div>
                    </div>

                    {report.description && (
                      <p className="text-sm text-gray-600 dark:text-slate-300">{report.description}</p>
                    )}

                    {/* Reimbursement Timeline */}
                    <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
                      <span>Timeline: Submitted ➔ Approval ➔ Reimbursement</span>
                      {report.reimbursedAt && (
                        <span className="text-green-600 font-semibold">
                          Reimbursed on {formatDate(report.reimbursedAt)}
                        </span>
                      )}
                      {report.rejectionReason && (
                        <span className="text-red-500 font-semibold">Reason: {report.rejectionReason}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: CREATE REPORT */}
          {activeTab === 'create' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Add Expense Line Item */}
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-xl space-y-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">1. Add Expense Line Item</h3>
                <form onSubmit={handleCreateExpenseClaim} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                      Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-700 dark:text-white text-sm"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                      Amount (₹)
                    </label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                      placeholder="0.00"
                      className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-700 dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-700 dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                      Description / Merchant
                    </label>
                    <input
                      type="text"
                      value={expenseDesc}
                      onChange={(e) => setExpenseDesc(e.target.value)}
                      required
                      placeholder="e.g. Taxi fare to client location"
                      className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-700 dark:text-white text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-lg transition"
                  >
                    Add Expense Item
                  </button>
                </form>
              </div>

              {/* Bundle into Custom Report */}
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-xl space-y-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">2. Bundle Into Custom Report</h3>
                <form onSubmit={handleCreateCustomReport} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                      Report Title *
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      placeholder="e.g. Q3 Sales Summit Expense Report"
                      className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-700 dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                      Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Notes for approvers..."
                      className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-700 dark:text-white text-sm"
                      rows={2}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-2">
                      Select Unassigned Claims to Include ({selectedClaimIds.length} selected)
                    </label>
                    <div className="max-h-48 overflow-y-auto space-y-2 border border-gray-200 dark:border-slate-800 p-3 rounded-lg">
                      {myClaims.length === 0 ? (
                        <p className="text-xs text-gray-400">No unassigned claims. Add claims on the left first.</p>
                      ) : (
                        myClaims.map((claim) => (
                          <label key={claim._id} className="flex items-center gap-2 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedClaimIds.includes(claim._id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedClaimIds([...selectedClaimIds, claim._id]);
                                } else {
                                  setSelectedClaimIds(selectedClaimIds.filter((id) => id !== claim._id));
                                }
                              }}
                            />
                            <span className="font-semibold">{claim.category}</span> - ₹{claim.amount} ({claim.description})
                          </label>
                        ))
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold text-sm rounded-lg transition"
                  >
                    Submit Custom Expense Report
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 3: EXPORT & ANALYTICS */}
          {activeTab === 'export' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-xl space-y-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Filter & Generate Custom Report Export</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">From Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-700 dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">To Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-700 dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">Category</label>
                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-700 dark:text-white text-sm"
                    >
                      <option value="">All Categories</option>
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">Status</label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-700 dark:text-white text-sm"
                    >
                      <option value="">All Statuses</option>
                      <option value="pending_approval">Pending Approval</option>
                      <option value="approved">Approved</option>
                      <option value="reimbursed">Reimbursed</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleFetchExport}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-lg transition"
                  >
                    Generate Report Summary
                  </button>
                  {exportSummary && (
                    <button
                      onClick={handleDownloadCSV}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold text-sm rounded-lg transition"
                    >
                      Download CSV Export
                    </button>
                  )}
                </div>
              </div>

              {/* Export Summary Cards */}
              {exportSummary && (
                <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-xl space-y-4">
                  <h4 className="font-bold text-base text-gray-900 dark:text-white">Report Summary Breakdown</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-slate-400">Total Filtered Claims</p>
                      <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                        {exportSummary.summary.totalClaims}
                      </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-slate-400">Total Amount</p>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        ₹{exportSummary.summary.totalAmount?.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
