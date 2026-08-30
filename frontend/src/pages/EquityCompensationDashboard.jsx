import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import VestingScheduleTable from '../components/VestingScheduleTable';

/**
 * @fileoverview Equity Compensation Dashboard
 * @description Main UI for monitoring RSU/PSU grants, vesting cliffs, and blackout periods.
 * Issue: #2010
 */
export default function EquityCompensationDashboard() {
    const [data, setData] = useState({ grants: [], upcomingVestings: [], blackouts: [] });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('grants');

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/api/equity-compensation/dashboard');
            setData(res.data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const totalUnvestedValue = data.grants.reduce((sum, g) => {
        const remaining = g.totalSharesGranted - g.sharesVested;
        return sum + (remaining * g.grantDateFairValue);
    }, 0);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Equity" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <TrendingUpIcon className="text-green-500" /> Equity Compensation & ASC 718
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    {data.blackouts.length > 0 && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-xl flex items-start gap-3">
                            <WarningAmberIcon className="text-red-600 dark:text-red-400 mt-0.5" />
                            <div>
                                <h3 className="text-sm font-bold text-red-800 dark:text-red-200">SEC Blackout Period Active</h3>
                                <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                                    {data.blackouts[0].blackoutType}: {new Date(data.blackouts[0].startDate).toLocaleDateString()} to {new Date(data.blackouts[0].endDate).toLocaleDateString()}. Sell-to-cover executions are blocked.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
                            <p className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase">Active Grants</p>
                            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{data.grants.length}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
                            <p className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase">Unvested Value (Grant Date)</p>
                            <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">${totalUnvestedValue.toLocaleString()}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
                            <p className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase">Upcoming Vestings</p>
                            <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-2">{data.upcomingVestings.length}</p>
                        </div>
                    </div>

                    <div className="flex border-b border-gray-200 dark:border-slate-700">
                        <button onClick={() => setActiveTab('grants')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'grants' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
                            Active Grants
                        </button>
                        <button onClick={() => setActiveTab('vestings')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'vestings' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
                            Vesting Schedule
                        </button>
                    </div>

                    {activeTab === 'grants' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Employee</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Type</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Total Granted</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Vested</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Remaining</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {loading ? (
                                        <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-500">Loading...</td></tr>
                                    ) : data.grants.map(g => (
                                        <tr key={g._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{g.employeeId?.fullName}</td>
                                            <td className="px-6 py-4 text-center"><span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">{g.grantType}</span></td>
                                            <td className="px-6 py-4 text-sm text-right font-mono text-gray-700 dark:text-slate-300">{g.totalSharesGranted.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono text-green-600 dark:text-green-400">{g.sharesVested.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono font-bold text-gray-900 dark:text-white">{(g.totalSharesGranted - g.sharesVested).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'vestings' && (
                        <VestingScheduleTable vestings={data.upcomingVestings} loading={loading} />
                    )}
                </div>
            </div>
        </div>
    );
}
