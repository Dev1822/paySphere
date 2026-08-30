import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import UndoIcon from '@mui/icons-material/Undo';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

export default function ReversalRecoveryDashboard() {
    const [data, setData] = useState({ reversals: [], receivables: [] });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('reversals');

    useEffect(() => { fetchData(); }, []);
    const fetchData = async () => {
        try { const res = await api.get('/api/reversal/dashboard'); setData(res.data); }
        catch (err) { console.error(err); } finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
            <Sidebar activePage="Reversals" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><UndoIcon className="text-red-500" /> Overpayment Recovery & Reversals</h1>
                    <ThemeToggle />
                </div>
                <div className="p-4 lg:p-8 space-y-6">
                    <div className="flex border-b border-gray-200 dark:border-slate-700">
                        <button onClick={() => setActiveTab('reversals')} className={`px-4 py-2 text-sm font-semibold border-b-2 ${activeTab === 'reversals' ? 'border-brand-600 text-brand-600' : 'text-gray-500'}`}>Reversal Orders</button>
                        <button onClick={() => setActiveTab('receivables')} className={`px-4 py-2 text-sm font-semibold border-b-2 ${activeTab === 'receivables' ? 'border-brand-600 text-brand-600' : 'text-gray-500'}`}>Active Receivables</button>
                    </div>

                    {activeTab === 'reversals' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Employee</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Reason</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Original Net</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Cross-Period?</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {loading ? <tr><td colSpan="5" className="p-8 text-center text-gray-500">Loading...</td></tr> : data.reversals.map(r => (
                                        <tr key={r._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{r.employeeId?.fullName}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{r.reason}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono text-red-600 dark:text-red-400">${r.originalNet.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-center">
                                                {r.isCrossPeriod ? <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 flex items-center gap-1 justify-center"><WarningAmberIcon fontSize="small" /> 941-X Req</span> : <span className="text-gray-400">No</span>}
                                            </td>
                                            <td className="px-6 py-4 text-center"><span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">{r.status}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'receivables' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Employee</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Total Owed</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Recovered</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Remaining</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {data.receivables.map(rec => (
                                        <tr key={rec._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{rec.employeeId?.fullName}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono">${rec.totalOwed.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono text-green-600">${rec.amountRecovered.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono font-bold text-red-600 dark:text-red-400">${rec.remainingBalance.toLocaleString()}</td>
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
