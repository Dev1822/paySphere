import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import ConstructionIcon from '@mui/icons-material/Construction';
import AssignmentIcon from '@mui/icons-material/Assignment';
import DownloadIcon from '@mui/icons-material/Download';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

export default function CertifiedPayrollDashboard() {
    const [data, setData] = useState({ determinations: [], reports: [] });
    const [loading, setLoading] = useState(true);
    const [selectedReport, setSelectedReport] = useState(null);
    const [activeTab, setActiveTab] = useState('reports');

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/api/prevailing-wage/dashboard');
            setData(res.data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleDownloadWH347 = (report) => {
        const blob = new Blob([report.wh347FileContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `WH347_${report.projectCode}_${new Date(report.weekEndingDate).toISOString().split('T')[0]}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const getStatusBadge = (status) => {
        if (status === 'Compliant') return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
        if (status === 'Non-Compliant') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="CertifiedPayroll" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <ConstructionIcon className="text-orange-500" /> Davis-Bacon Certified Payroll
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    <div className="flex border-b border-gray-200 dark:border-slate-700">
                        <button onClick={() => setActiveTab('reports')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'reports' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
                            WH-347 Reports
                        </button>
                        <button onClick={() => setActiveTab('determinations')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'determinations' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
                            Wage Determinations
                        </button>
                    </div>

                    {activeTab === 'reports' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Project</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Week Ending</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Hours</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Status</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {loading ? (
                                        <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-500">Loading...</td></tr>
                                    ) : data.reports.map(r => (
                                        <tr key={r._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{r.projectCode}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{new Date(r.weekEndingDate).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono text-gray-700 dark:text-slate-300">{r.totalHoursWorked}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${getStatusBadge(r.status)}`}>{r.status}</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button onClick={() => handleDownloadWH347(r)} className="text-xs font-bold text-brand-600 hover:underline flex items-center gap-1 mx-auto">
                                                    <DownloadIcon fontSize="small" /> WH-347
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'determinations' && (
                        <div className="space-y-4">
                            {data.determinations.map(d => (
                                <div key={d._id} className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{d.projectName}</h3>
                                            <p className="text-sm text-gray-500 dark:text-slate-400">Project: {d.projectCode} | Contract: {d.contractNumber}</p>
                                        </div>
                                        <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-xs font-bold rounded">WD: {d.wageDecisionNumber}</span>
                                    </div>
                                    <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700 text-sm">
                                        <thead>
                                            <tr>
                                                <th className="py-2 text-left text-gray-500 dark:text-slate-400">Craft</th>
                                                <th className="py-2 text-right text-gray-500 dark:text-slate-400">Base Rate</th>
                                                <th className="py-2 text-right text-gray-500 dark:text-slate-400">Fringe Rate</th>
                                                <th className="py-2 text-right text-gray-500 dark:text-slate-400">Total Package</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                                            {d.classifications.map((c, i) => (
                                                <tr key={i}>
                                                    <td className="py-2 font-medium text-gray-900 dark:text-white">{c.craftName}</td>
                                                    <td className="py-2 text-right font-mono text-gray-700 dark:text-slate-300">${c.baseHourlyRate.toFixed(2)}</td>
                                                    <td className="py-2 text-right font-mono text-gray-700 dark:text-slate-300">${c.fringeHourlyRate.toFixed(2)}</td>
                                                    <td className="py-2 text-right font-mono font-bold text-brand-600 dark:text-brand-400">${c.totalPackageRate.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
