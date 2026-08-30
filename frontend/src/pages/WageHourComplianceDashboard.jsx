import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import ScheduleIcon from '@mui/icons-material/Schedule';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

export default function WageHourComplianceDashboard() {
    const [data, setData] = useState({ matrices: [], awsSchedules: [] });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('matrix');

    useEffect(() => { fetchData(); }, []);
    const fetchData = async () => {
        try { const res = await api.get('/api/flsa-overtime/dashboard'); setData(res.data); }
        catch (err) { console.error(err); } finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
            <Sidebar activePage="WageHour" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><ScheduleIcon className="text-orange-500" /> FLSA Daily OT & AWS Compliance</h1>
                    <ThemeToggle />
                </div>
                <div className="p-4 lg:p-8 space-y-6">
                    <div className="flex border-b border-gray-200 dark:border-slate-700">
                        <button onClick={() => setActiveTab('matrix')} className={`px-4 py-2 text-sm font-semibold border-b-2 ${activeTab === 'matrix' ? 'border-brand-600 text-brand-600' : 'text-gray-500'}`}>State Matrices</button>
                        <button onClick={() => setActiveTab('aws')} className={`px-4 py-2 text-sm font-semibold border-b-2 ${activeTab === 'aws' ? 'border-brand-600 text-brand-600' : 'text-gray-500'}`}>AWS Schedules</button>
                    </div>
                    {activeTab === 'matrix' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">State</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Daily 1.5x</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Daily 2.0x</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">7th Day Rule</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {loading ? <tr><td colSpan="4" className="p-8 text-center text-gray-500">Loading...</td></tr> : data.matrices.map(m => (
                                        <tr key={m._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white">{m.stateCode}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono">{m.dailyOTThreshold} hrs</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono">{m.dailyDoubleTimeThreshold} hrs</td>
                                            <td className="px-6 py-4 text-center">
                                                {m.seventhDayPremium ? <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 flex items-center gap-1 justify-center"><WarningAmberIcon fontSize="small" /> Active</span> : <span className="text-gray-400">None</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {activeTab === 'aws' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Employee</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Schedule</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Effective From</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {data.awsSchedules.map(a => (
                                        <tr key={a._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{a.employeeId?.fullName}</td>
                                            <td className="px-6 py-4 text-center"><span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">{a.scheduleType}</span></td>
                                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{new Date(a.effectiveFrom).toLocaleDateString()}</td>
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
