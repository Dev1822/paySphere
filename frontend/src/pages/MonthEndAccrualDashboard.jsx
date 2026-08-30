import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

export default function MonthEndAccrualDashboard() {
    const [data, setData] = useState({ policy: null, batches: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchData(); }, []);
    const fetchData = async () => {
        try { const res = await api.get('/api/accrual/dashboard'); setData(res.data); }
        catch (err) { console.error(err); } finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
            <Sidebar activePage="Accruals" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><CalendarMonthIcon className="text-teal-500" /> Month-End Accruals & GAAP Cutoff</h1>
                    <ThemeToggle />
                </div>
                <div className="p-4 lg:p-8 space-y-6">
                    {data.policy && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
                                <p className="text-xs text-gray-500 dark:text-slate-400 uppercase">Valuation Method</p>
                                <p className="text-lg font-bold text-gray-900 dark:text-white mt-2">{data.policy.valuationMethod}</p>
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
                                <p className="text-xs text-gray-500 dark:text-slate-400 uppercase">Burden Included</p>
                                <p className="text-lg font-bold text-gray-900 dark:text-white mt-2">{data.policy.includeBurden ? `Yes (${(data.policy.burdenPercentage * 100)}%)` : 'No'}</p>
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
                                <p className="text-xs text-gray-500 dark:text-slate-400 uppercase">Cutoff Days</p>
                                <p className="text-lg font-bold text-gray-900 dark:text-white mt-2">{data.policy.cutoffDays} Days</p>
                            </div>
                        </div>
                    )}

                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center gap-2">
                            <TrendingUpIcon className="text-teal-500" />
                            <h2 className="font-bold text-gray-900 dark:text-white">ASC 710 Accrual Batches</h2>
                        </div>
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                            <thead className="bg-gray-50 dark:bg-slate-900/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Period</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Cutoff Wages</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">PTO Liability</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Variance Adj.</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                {loading ? <tr><td colSpan="5" className="p-8 text-center text-gray-500">Loading...</td></tr> : data.batches.map(b => (
                                    <tr key={b._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                        <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white">{b.periodMonth}/{b.periodYear}</td>
                                        <td className="px-6 py-4 text-sm text-right font-mono">${b.totalCutoffWages.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-sm text-right font-mono text-teal-600 dark:text-teal-400">${b.totalPTOLiability.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-sm text-right font-mono">${b.varianceAdjustment.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-center"><span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">{b.status}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
