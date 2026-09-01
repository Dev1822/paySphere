import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import NAUPAFileExporter from '../components/NAUPAFileExporter';

/**
 * @fileoverview Escheatment Dashboard
 * @description Main UI for monitoring uncashed checks, dormancy periods, and NAUPA exports.
 * Issue: #2013
 */
export default function EscheatmentDashboard() {
    const [data, setData] = useState({ checks: [], batches: [] });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('checks');

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/api/escheatment/dashboard');
            setData(res.data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleRunAudit = async () => {
        try {
            const res = await api.post('/api/escheatment/audit');
            alert(`Audit complete. Stop Payments: ${res.data.stopPayments}, Due Diligence: ${res.data.dueDiligenceLetters}`);
            fetchData();
        } catch (err) { alert('Audit failed.'); }
    };

    const dormantCount = data.checks.filter(c => c.dormancy?.isDormant && c.status !== 'Escheated to State').length;

    const getStatusBadge = (check) => {
        if (check.status === 'Escheated to State') return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
        if (check.status === 'Stop Payment Issued') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
        if (check.status === 'Due Diligence Sent') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Escheatment" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <SearchOffIcon className="text-indigo-500" /> Uncashed Check Escheatment & NAUPA
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    {dormantCount > 0 && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-xl flex items-start gap-3">
                            <WarningAmberIcon className="text-red-600 dark:text-red-400 mt-0.5" />
                            <div>
                                <h3 className="text-sm font-bold text-red-800 dark:text-red-200">Dormant Property Alert</h3>
                                <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                                    {dormantCount} uncashed check(s) have passed their statutory dormancy period and must be escheated to the state immediately.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-between items-center">
                        <div className="flex border-b border-gray-200 dark:border-slate-700">
                            <button onClick={() => setActiveTab('checks')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'checks' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
                                Uncashed Checks
                            </button>
                            <button onClick={() => setActiveTab('export')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'export' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
                                NAUPA Export
                            </button>
                        </div>
                        {activeTab === 'checks' && (
                            <button onClick={handleRunAudit} className="px-4 py-2 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 flex items-center gap-2">
                                <WarningAmberIcon fontSize="small" /> Run Dormancy Audit
                            </button>
                        )}
                    </div>

                    {activeTab === 'checks' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Check #</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Employee</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Amount</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">State</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Days to Dormancy</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {loading ? (
                                        <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-500">Loading...</td></tr>
                                    ) : data.checks.map(c => (
                                        <tr key={c._id} className={`hover:bg-gray-50 dark:hover:bg-slate-700/50 ${c.dormancy?.isDormant ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                                            <td className="px-6 py-4 text-sm font-mono font-bold text-gray-900 dark:text-white">{c.checkNumber}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{c.employeeId?.fullName || 'Unknown'}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono text-gray-900 dark:text-white">${c.amount.toFixed(2)}</td>
                                            <td className="px-6 py-4 text-center text-sm font-bold text-gray-700 dark:text-slate-300">{c.lastKnownState}</td>
                                            <td className="px-6 py-4 text-center text-sm font-mono">
                                                {c.dormancy?.isDormant ? (
                                                    <span className="text-red-600 font-bold">DORMANT</span>
                                                ) : (
                                                    <span className={c.dormancy?.daysRemaining <= 60 ? 'text-amber-600 font-bold' : 'text-gray-500'}>
                                                        {c.dormancy?.daysRemaining} days
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${getStatusBadge(c)}`}>
                                                    {c.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'export' && (
                        <div className="space-y-6">
                            <NAUPAFileExporter dormantCounts={dormantCount} onExportComplete={fetchData} />

                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                                    <h2 className="font-bold text-gray-900 dark:text-white">Recent NAUPA Batches</h2>
                                </div>
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                    <thead className="bg-gray-50 dark:bg-slate-900/50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">State</th>
                                            <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Year</th>
                                            <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Total Checks</th>
                                            <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Total Amount</th>
                                            <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                        {data.batches.map(b => (
                                            <tr key={b._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                                <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white">{b.stateCode}</td>
                                                <td className="px-6 py-4 text-sm text-center text-gray-700 dark:text-slate-300">{b.reportingYear}</td>
                                                <td className="px-6 py-4 text-sm text-right font-mono">{b.totalChecks}</td>
                                                <td className="px-6 py-4 text-sm text-right font-mono">${b.totalAmount.toLocaleString()}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">{b.status}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
