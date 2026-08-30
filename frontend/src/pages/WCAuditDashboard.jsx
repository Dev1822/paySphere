import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import ShieldIcon from '@mui/icons-material/Shield';
import AssignmentIcon from '@mui/icons-material/Assignment';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

export default function WCAuditDashboard() {
    const [data, setData] = useState({ classifications: [], mappings: [], ytdPremiums: [] });
    const [loading, setLoading] = useState(true);
    const [auditForm, setAuditForm] = useState({ auditYear: new Date().getFullYear(), experienceModifier: 1.0 });

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/api/workers-comp/dashboard');
            setData(res.data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleRunAudit = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/api/workers-comp/audit', auditForm);
            alert(`Audit Generated! Variance: ${res.data.report.varianceType} ($${res.data.report.varianceAmount.toLocaleString()})`);
        } catch (err) { alert('Audit generation failed.'); }
    };

    const totalYtdPremium = data.ytdPremiums.reduce((sum, p) => sum + p.totalPremium, 0);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="WorkersComp" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <ShieldIcon className="text-blue-500" /> Worker's Comp & Premium Audit
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl border border-blue-200 dark:border-blue-800">
                            <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 uppercase">YTD Estimated Premium</p>
                            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">${totalYtdPremium.toLocaleString()}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
                            <p className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase">Active NCCI Codes</p>
                            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{data.classifications.length}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
                            <p className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase">Mapped Employees</p>
                            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{data.mappings.length}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Audit Generator */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <AssignmentIcon /> Generate Annual Audit Report
                            </h2>
                            <form onSubmit={handleRunAudit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Audit Year</label>
                                    <input type="number" value={auditForm.auditYear} onChange={e => setAuditForm({ ...auditForm, auditYear: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Experience Modifier (E-Mod)</label>
                                    <input type="number" step="0.01" value={auditForm.experienceModifier} onChange={e => setAuditForm({ ...auditForm, experienceModifier: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                                    <p className="text-xs text-gray-500 mt-1">e.g., 0.85 for good safety record, 1.15 for poor.</p>
                                </div>
                                <button type="submit" className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg">
                                    Generate Variance Report
                                </button>
                            </form>
                        </div>

                        {/* YTD Breakdown by NCCI Code */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">YTD Premium by NCCI Code</h2>
                            </div>
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">NCCI Code</th>
                                        <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Capped Payroll</th>
                                        <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Premium</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {data.ytdPremiums.map((p, i) => (
                                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-4 py-3 text-sm font-mono font-bold text-gray-900 dark:text-white">{p._id}</td>
                                            <td className="px-4 py-3 text-sm text-right font-mono text-gray-700 dark:text-slate-300">${p.totalPayroll.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-sm text-right font-mono font-bold text-blue-600 dark:text-blue-400">${p.totalPremium.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
