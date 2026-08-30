import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchange';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import LockIcon from '@mui/icons-material/Lock';

export default function FXPayrollDashboard() {
    const [data, setData] = useState({ batches: [], variances: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/api/fx-payroll/dashboard');
            setData(res.data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const getStatusColor = (status) => {
        if (status === 'Settled') return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
        if (status === 'Wires Sent') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
        if (status === 'Rate Locked') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="FXPayroll" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <CurrencyExchangeIcon className="text-indigo-500" /> Multi-Currency FX Payroll
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center gap-2">
                                <LockIcon className="text-amber-500" />
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Payroll Batches</h2>
                            </div>
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Batch</th>
                                        <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Base Liability</th>
                                        <th className="px-4 py-2 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {loading ? (
                                        <tr><td colSpan="3" className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
                                    ) : data.batches.map(b => (
                                        <tr key={b._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{b.batchName}</td>
                                            <td className="px-4 py-3 text-sm text-right font-mono text-gray-700 dark:text-slate-300">${b.totalBaseLiability.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${getStatusColor(b.status)}`}>{b.status}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Recent FX Variances (Gain/Loss)</h2>
                            </div>
                            <div className="divide-y divide-gray-200 dark:divide-slate-700 max-h-[400px] overflow-y-auto">
                                {data.variances.length === 0 ? (
                                    <p className="p-6 text-center text-gray-500 text-sm">No settlement variances recorded yet.</p>
                                ) : data.variances.map(v => (
                                    <div key={v._id} className="p-4 flex justify-between items-center">
                                        <div>
                                            <p className="text-sm font-bold text-gray-900 dark:text-white">{v.foreignCurrency} Settlement</p>
                                            <p className="text-xs text-gray-500 dark:text-slate-400">
                                                Locked: {v.lockedRate} | Actual: {v.actualSettlementRate}
                                            </p>
                                        </div>
                                        <div className={`flex items-center gap-1 font-bold ${v.varianceType === 'Gain' ? 'text-green-600' : 'text-red-600'}`}>
                                            {v.varianceType === 'Gain' ? <TrendingUpIcon fontSize="small" /> : <TrendingDownIcon fontSize="small" />}
                                            <span className="text-sm">${v.varianceAmount.toLocaleString()} {v.varianceType}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
