import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ReceiptIcon from '@mui/icons-material/Receipt';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import GhostIcon from '@mui/icons-material/VisibilityOff'; // Using VisibilityOff as ghost proxy

export default function ReconciliationDashboard() {
  // Corporate Card State
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadTarget, setUploadTarget] = useState(null);
  const [receiptForm, setReceiptForm] = useState({
    receiptUrl: '',
    notes: '',
    isPersonalSpend: false,
  });

  // Payroll Reconciliation State
  const [reconData, setReconData] = useState({
    batches: [],
    pendingExceptions: [],
  });
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [diffForm, setDiffForm] = useState(() => ({
    currentRunId: 'pending_run_' + Date.now(),
    periodMonth: new Date().getMonth() + 1,
    periodYear: new Date().getFullYear(),
    varianceThreshold: 0.1,
  }));
  const [resolvingId, setResolvingId] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [activeTab, setActiveTab] = useState('payroll'); // 'corporate-card' or 'payroll'

  useEffect(() => {
    fetchTransactions();
    fetchReconciliationData();
  }, []);

  // Corporate Card Functions
  const fetchTransactions = async () => {
    try {
      const res = await api.get('/api/corporate-cards/my-transactions');
      setTransactions(res.data.transactions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/corporate-cards/receipt', {
        transactionId: uploadTarget._id,
        ...receiptForm,
        receiptUrl:
          receiptForm.receiptUrl || `mock://receipts/${Date.now()}.pdf`,
      });
      alert('Receipt uploaded!');
      setUploadTarget(null);
      fetchTransactions();
    } catch (err) {
      alert('Upload failed.');
    }
  };

  const getStatusBadge = (tx) => {
    if (tx.isPersonalSpend)
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
          Personal (Clawback)
        </span>
      );
    if (tx.status === 'Approved')
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
          Approved
        </span>
      );
    if (tx.policyFlags.length > 0)
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          Policy Violation
        </span>
      );
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
        Pending Receipt
      </span>
    );
  };

  // Payroll Reconciliation Functions
  const fetchReconciliationData = async () => {
    try {
      const res = await api.get('/api/reconciliation/dashboard');
      setReconData(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRunDiff = async (e) => {
    e.preventDefault();
    try {
      // Mocking a current register for demonstration
      const mockRegister = [
        { employeeId: 'mock_emp_1', netPay: 2500.0 },
        { employeeId: 'mock_emp_2', netPay: 3200.0 }, // Variance
        { employeeId: 'mock_emp_ghost', netPay: 1500.0 }, // Ghost
      ];

      const res = await api.post('/api/reconciliation/diff', {
        ...diffForm,
        currentRegister: mockRegister,
      });
      alert(`Diff complete. ${res.data.exceptionCount} exceptions flagged.`);
      setShowDiffModal(false);
      fetchReconciliationData();
    } catch (err) {
      alert('Reconciliation diff failed.');
    }
  };

  const handleResolve = async (exceptionId) => {
    try {
      await api.patch('/api/reconciliation/resolve', {
        exceptionId,
        resolutionNotes,
      });
      alert('Exception resolved.');
      setResolvingId(null);
      setResolutionNotes('');
      fetchReconciliationData();
    } catch (err) {
      alert('Failed to resolve exception.');
    }
  };

  const handleSignOff = async (batchId) => {
    if (
      !window.confirm(
        'Formally sign off on this payroll batch for SOX audit trail?',
      )
    )
      return;
    try {
      await api.patch(`/api/reconciliation/signoff/${batchId}`);
      alert('Batch approved and signed off.');
      fetchReconciliationData();
    } catch (err) {
      alert(err.response?.data?.message || 'Sign-off failed.');
    }
  };

  const getExceptionIcon = (type) => {
    if (type === 'Ghost Employee')
      return <GhostIcon className="text-red-500" />;
    if (type === 'Net Pay Variance')
      return <WarningAmberIcon className="text-amber-500" />;
    return <CompareArrowsIcon className="text-blue-500" />;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
      <Sidebar
        activePage="Reconciliation"
        setActivePage={() => {}}
        isSidebarOpen={false}
        onClose={() => {}}
      />
      <div className="lg:ml-64">
        <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            {activeTab === 'payroll' ? (
              <>
                <CompareArrowsIcon className="text-indigo-500" /> Payroll
                Reconciliation & Variance Audit
              </>
            ) : (
              <>
                <CreditCardIcon className="text-brand-500" /> Corporate Card
                Reconciliation
              </>
            )}
          </h1>
          <ThemeToggle />
        </div>

        {/* Tab Navigation */}
        <div className="px-4 lg:px-8 py-4">
          <div className="flex gap-2 border-b border-gray-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab('payroll')}
              className={`px-4 py-2 font-semibold text-sm ${
                activeTab === 'payroll'
                  ? 'text-brand-600 border-b-2 border-brand-600'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Payroll Reconciliation
            </button>
            <button
              onClick={() => setActiveTab('corporate-card')}
              className={`px-4 py-2 font-semibold text-sm ${
                activeTab === 'corporate-card'
                  ? 'text-brand-600 border-b-2 border-brand-600'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Corporate Card Reconciliation
            </button>
          </div>
        </div>

        <div className="p-4 lg:p-8 space-y-6">
          {activeTab === 'payroll' ? (
            <>
              {/* Payroll Reconciliation Content */}
              <div className="flex justify-end">
                <button
                  onClick={() => setShowDiffModal(true)}
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 flex items-center gap-2"
                >
                  <CompareArrowsIcon fontSize="small" /> Run Pre-Audit Diff
                </button>
              </div>

              {reconData.pendingExceptions.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 bg-red-50 dark:bg-red-900/10">
                    <h2 className="text-lg font-bold text-red-800 dark:text-red-300 flex items-center gap-2">
                      <WarningAmberIcon /> Unresolved Variance Exceptions (
                      {reconData.pendingExceptions.length})
                    </h2>
                  </div>
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                    <thead className="bg-gray-50 dark:bg-slate-900/50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                          Employee
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">
                          Prev Net
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">
                          Curr Net
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">
                          Variance
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                      {reconData.pendingExceptions.map((ex) => (
                        <tr
                          key={ex._id}
                          className={`hover:bg-gray-50 dark:hover:bg-slate-700/50 ${ex.exceptionType === 'Ghost Employee' ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}
                        >
                          <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                            {getExceptionIcon(ex.exceptionType)}{' '}
                            {ex.exceptionType}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">
                            {ex.employeeId?.fullName || 'Unknown'}
                          </td>
                          <td className="px-6 py-4 text-sm text-right font-mono text-gray-700 dark:text-slate-300">
                            ${ex.previousNetPay.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-sm text-right font-mono text-gray-900 dark:text-white">
                            ${ex.currentNetPay.toFixed(2)}
                          </td>
                          <td
                            className={`px-6 py-4 text-sm text-right font-mono font-bold ${ex.varianceAmount > 0 ? 'text-green-600' : 'text-red-600'}`}
                          >
                            {ex.varianceAmount > 0 ? '+' : ''}$
                            {ex.varianceAmount.toFixed(2)} ({ex.variancePercent}
                            %)
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => setResolvingId(ex._id)}
                              className="text-xs font-bold text-brand-600 hover:underline"
                            >
                              Resolve
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    Reconciliation Batches
                  </h2>
                </div>
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                  <thead className="bg-gray-50 dark:bg-slate-900/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                        Run ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                        Period
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">
                        Exceptions
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">
                        Status
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                    {reconData.batches.map((b) => (
                      <tr
                        key={b._id}
                        className="hover:bg-gray-50 dark:hover:bg-slate-700/50"
                      >
                        <td className="px-6 py-4 text-sm font-mono text-gray-900 dark:text-white">
                          {b.currentRunId}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">
                          {b.periodMonth}/{b.periodYear}
                        </td>
                        <td className="px-6 py-4 text-center text-sm text-gray-700 dark:text-slate-300">
                          {b.resolvedExceptions} / {b.totalExceptions}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-bold ${b.status === 'Approved' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}
                          >
                            {b.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {b.status === 'Pending Review' &&
                            b.resolvedExceptions === b.totalExceptions && (
                              <button
                                onClick={() => handleSignOff(b._id)}
                                className="text-xs font-bold text-green-600 hover:underline flex items-center gap-1 mx-auto"
                              >
                                <CheckCircleIcon fontSize="small" /> Sign Off
                              </button>
                            )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              {/* Corporate Card Reconciliation Content */}
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-3">
                <WarningAmberIcon className="text-amber-600 dark:text-amber-400 mt-0.5" />
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Action Required:</strong> Upload receipts for pending
                  transactions within 7 days. Unreceipted or personal spend will
                  be automatically deducted from your next payroll.
                </p>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                  <thead className="bg-gray-50 dark:bg-slate-900/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">
                        Merchant
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">
                        Status
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                    {loading ? (
                      <tr>
                        <td
                          colSpan="5"
                          className="px-6 py-12 text-center text-gray-500"
                        >
                          Loading transactions...
                        </td>
                      </tr>
                    ) : transactions.length === 0 ? (
                      <tr>
                        <td
                          colSpan="5"
                          className="px-6 py-12 text-center text-gray-500"
                        >
                          No corporate card transactions found.
                        </td>
                      </tr>
                    ) : (
                      transactions.map((tx) => (
                        <tr
                          key={tx._id}
                          className="hover:bg-gray-50 dark:hover:bg-slate-700/50"
                        >
                          <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">
                            {new Date(tx.transactionDate).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                            {tx.merchantName}
                          </td>
                          <td className="px-6 py-4 text-sm text-right font-mono font-bold text-gray-900 dark:text-white">
                            ${tx.amount.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {getStatusBadge(tx)}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {(tx.status === 'Pending Receipt' ||
                              tx.policyFlags.length > 0) &&
                              !tx.isPersonalSpend && (
                                <button
                                  onClick={() => setUploadTarget(tx)}
                                  className="text-xs font-bold text-brand-600 hover:text-brand-800 dark:text-brand-400 flex items-center gap-1 mx-auto"
                                >
                                  <CloudUploadIcon fontSize="small" /> Upload
                                </button>
                              )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Corporate Card Upload Modal */}
      {uploadTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Upload Receipt
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
              {uploadTarget.merchantName} - ${uploadTarget.amount.toFixed(2)}
            </p>
            {uploadTarget.policyFlags.length > 0 && (
              <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-4">
                <p className="text-xs text-red-700 dark:text-red-300 font-bold">
                  Policy Flags: {uploadTarget.policyFlags.join(', ')}
                </p>
              </div>
            )}
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={receiptForm.isPersonalSpend}
                  onChange={(e) =>
                    setReceiptForm({
                      ...receiptForm,
                      isPersonalSpend: e.target.checked,
                    })
                  }
                  className="rounded text-red-600"
                  id="personal"
                />
                <label
                  htmlFor="personal"
                  className="text-sm text-gray-700 dark:text-slate-300"
                >
                  Mark as Personal Spend (Will be deducted from payroll)
                </label>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Notes / Business Purpose
                </label>
                <textarea
                  value={receiptForm.notes}
                  onChange={(e) =>
                    setReceiptForm({ ...receiptForm, notes: e.target.value })
                  }
                  rows="2"
                  className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white"
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setUploadTarget(null)}
                  className="px-4 py-2 text-gray-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 flex items-center gap-2"
                >
                  <ReceiptIcon fontSize="small" /> Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payroll Diff Modal */}
      {showDiffModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Run Pre-Audit Diff
            </h2>
            <form onSubmit={handleRunDiff} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Month
                  </label>
                  <input
                    type="number"
                    value={diffForm.periodMonth}
                    onChange={(e) =>
                      setDiffForm({
                        ...diffForm,
                        periodMonth: Number(e.target.value),
                      })
                    }
                    required
                    className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Year
                  </label>
                  <input
                    type="number"
                    value={diffForm.periodYear}
                    onChange={(e) =>
                      setDiffForm({
                        ...diffForm,
                        periodYear: Number(e.target.value),
                      })
                    }
                    required
                    className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Variance Threshold (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={diffForm.varianceThreshold}
                  onChange={(e) =>
                    setDiffForm({
                      ...diffForm,
                      varianceThreshold: Number(e.target.value),
                    })
                  }
                  required
                  className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Flag net pay changes exceeding this % (e.g., 0.10 = 10%)
                </p>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowDiffModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700"
                >
                  Run Diff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolution Modal */}
      {resolvingId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Resolve Exception
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
              Provide audit notes explaining this variance for SOX compliance.
            </p>
            <textarea
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              rows="4"
              required
              className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white mb-4"
              placeholder="e.g., Approved salary increase effective this period."
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setResolvingId(null)}
                className="px-4 py-2 text-gray-600 dark:text-slate-400"
              >
                Cancel
              </button>
              <button
                onClick={() => handleResolve(resolvingId)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
              >
                Confirm Resolution
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
