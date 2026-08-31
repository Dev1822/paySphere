import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import RemittanceBatchTable from '../components/RemittanceBatchTable';

/**
 * @fileoverview Union Remittance Dashboard
 * @description Main UI for managing CBA mappings and auditing MEPP remittances.
 * Issue: #2009
 */
export default function UnionRemittanceDashboard() {
    const [data, setData] = useState({ contracts: [], batches: [] });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('batches');

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/api/union-remittance/dashboard');
            setData(res.data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleRunAudit = async () => {
        try {
            const res = await api.post('/api/union-remittance/audit');
            alert(`Delinquency audit complete. ${res.data.alertsTriggered} new alerts triggered.`);
            fetchData();
        } catch (err) { alert('Audit failed.'); }
    };

    const delinquentCount = data.batches.filter(b => b.delinquency?.isDelinquent).length;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="UnionRemittance" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <AccountBalanceIcon className="text-indigo-500" /> MEPP & Union Fringe Remittance
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    {delinquentCount > 0 && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-xl flex items-start gap-3 animate-pulse">
                            <WarningAmberIcon className="text-red-600 dark:text-red-400 mt-0.5" />
                            <div>
                                <h3 className="text-sm font-bold text-red-800 dark:text-red-200">ERISA DELINQUENCY ALERT</h3>
                                <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                                    {delinquentCount} remittance batch(es) are past due. Immediate submission required to avoid trust fund penalties and union grievances.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-between items-center">
                        <div className="flex border-b border-gray-200 dark:border-slate-700">
                            <button onClick={() => setActiveTab('batches')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'batches' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
                                Remittance Batches
                            </button>
                            <button onClick={() => setActiveTab('cbas')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'cbas' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
                                CBA Contracts
                            </button>
                        </div>
                        <button onClick={handleRunAudit} className="px-4 py-2 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 flex items-center gap-2">
                            <WarningAmberIcon fontSize="small" /> Run Delinquency Audit
                        </button>
                    </div>

                    {activeTab === 'batches' && (
                        <RemittanceBatchTable batches={data.batches} loading={loading} />
                    )}

                    {activeTab === 'cbas' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">CBA Code</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Union / Local</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Classifications</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Due Day</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {loading ? (
                                        <tr><td colSpan="4" className="px-6 py-12 text-center text-gray-500">Loading...</td></tr>
                                    ) : data.contracts.map(c => (
                                        <tr key={c._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white">{c.cbaCode}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{c.unionName} Local {c.localNumber}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono text-gray-700 dark:text-slate-300">{c.fringeRates.length}</td>
                                            <td className="px-6 py-4 text-center text-sm text-gray-700 dark:text-slate-300">{c.remittanceDueDay}th</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
