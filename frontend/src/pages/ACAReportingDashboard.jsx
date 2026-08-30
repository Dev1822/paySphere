import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import DownloadIcon from '@mui/icons-material/Download';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

export default function ACAReportingDashboard() {
    const [data, setData] = useState({ periods: [], monthlyStats: [], drafts: [] });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('tracking');

    useEffect(() => { fetchDashboard(); }, []);

    const fetchDashboard = async () => {
        try {
            const res = await api.get('/api/aca/dashboard');
            setData(res.data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleGenerateXML = async () => {
        const year = new Date().getFullYear() - 1; // Generate for previous tax year
        if (!window.confirm(`Generate 1095-C XML draft for tax year ${year}?`)) return;
        try {
            await api.post('/api/aca/generate-1095c', { taxYear: year });
            alert('1095-C XML draft generated successfully!');
            fetchDashboard();
        } catch (err) { alert(err.response?.data?.message || 'Generation failed.'); }
    };

    const maxFTCount = Math.max(...data.monthlyStats.map(s => s.ftCount), 1);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="ACA" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <HealthAndSafetyIcon className="text-blue-500" /> ACA 1094-C / 1095-C Reporting
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    <div className="flex justify-end">
                        <button onClick={handleGenerateXML} className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 flex items-center gap-2">
                            <DownloadIcon fontSize="small" /> Generate 1095-C XML
                        </button>
                    </div>

                    <div className="flex border-b border-gray-200 dark:border-slate-700">
                        <button onClick={() => setActiveTab('tracking')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'tracking' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
                            Variable Hour Tracking
                        </button>
                        <button onClick={() => setActiveTab('drafts')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'drafts' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
                            Export History
                        </button>
                    </div>

                    {activeTab === 'tracking' && (
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <TrendingUpIcon /> Monthly Full-Time Employee Count (Current Year)
                            </h2>
                            <div className="flex items-end gap-2 h-64">
                                {loading ? (
                                    <p className="text-gray-500">Loading chart...</p>
                                ) : Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
                                    const stat = data.monthlyStats.find(s => s._id === month);
                                    const count = stat ? stat.ftCount : 0;
                                    const heightPercent = (count / maxFTCount) * 100;

                                    return (
                                        <div key={month} className="flex-1 flex flex-col items-center justify-end h-full">
                                            <span className="text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">{count}</span>
                                            <div className="w-full bg-brand-500 rounded-t-md transition-all duration-500" style={{ height: `${heightPercent}%`, minHeight: count > 0 ? '8px' : '0' }}></div>
                                            <span className="text-xs text-gray-500 dark:text-slate-400 mt-2">{new Date(0, month - 1).toLocaleString('default', { month: 'short' })}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {activeTab === 'drafts' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Tax Year</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Total Forms</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">FT Employees</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Status</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {data.drafts.map(d => (
                                        <tr key={d._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white">{d.taxYear}</td>
                                            <td className="px-6 py-4 text-sm text-right text-gray-700 dark:text-slate-300">{d.totalFormsGenerated}</td>
                                            <td className="px-6 py-4 text-sm text-right text-gray-700 dark:text-slate-300">{d.totalFullTimeEmployees}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${d.status === 'Draft' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                                                    {d.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button className="text-xs font-bold text-brand-600 hover:underline">Download XML</button>
                                            </td>
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
