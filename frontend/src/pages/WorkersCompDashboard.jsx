import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import ConstructionIcon from '@mui/icons-material/Construction';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WCAuditReportTable from '../components/WCAuditReportTable';

/**
 * @fileoverview Workers' Compensation Dashboard
 * @description Main UI for managing NCCI codes, monitoring premium accruals, and exporting audit reports.
 * Issue: #2061
 */
export default function WorkersCompDashboard() {
    const [data, setData] = useState({ codes: [], reports: [], ytdSummary: {}, emrStatus: {} });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('audit');

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/api/workers-comp/dashboard');
            setData(res.data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleGenerateAudit = async () => {
        const year = new Date().getFullYear();
        if (!window.confirm(`Generate final WC audit report for ${year}?`)) return;
        try {
            await api.post('/api/workers-comp/audit', { policyYear: year, companyEMR: 1.0 });
            alert('Audit report finalized.');
            fetchData();
        } catch (err) { alert('Audit generation failed.'); }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="WorkersComp" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <ConstructionIcon className="text-orange-500" /> Workers' Comp & Premium Audit
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
                            <p className="text-xs text-gray-500 dark:text-slate-400 uppercase">YTD Eligible Wages</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">${(data.ytdSummary.totalEligible || 0).toLocaleString()}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
                            <p className="text-xs text-gray-500 dark:text-slate-400 uppercase">YTD Estimated Premium</p>
                            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-2">${(data.ytdSummary.totalPremium || 0).toLocaleString()}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
                            <p className="text-xs text-gray-500 dark:text-slate-400 uppercase">Excluded OT Premium</p>
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-2">${(data.ytdSummary.totalExcludedOT || 0).toLocaleString()}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
                            <p className="text-xs text-gray-500 dark:text-slate-400 uppercase">EMR Status</p>
                            <p className="text-lg font-bold text-brand-600 dark:text-brand-400 mt-2">{data.emrStatus.status || 'N/A'}</p>
                            <p className="text-xs text-gray-500 mt-1">{data.emrStatus.multiplierImpact || ''}</p>
                        </div>
                    </div>

                    <div className="flex justify-between items-center border-b border-gray-200 dark:border-slate-700">
                        <div className="flex">
                            <button onClick={() => setActiveTab('audit')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'audit' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
                                Audit Reports
                            </button>
                            <button onClick={() => setActiveTab('codes')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'codes' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
                                NCCI Class Codes
                            </button>
                        </div>
                        {activeTab === 'audit' && (
                            <button onClick={handleGenerateAudit} className="px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 flex items-center gap-2">
                                <TrendingUpIcon fontSize="small" /> Generate Annual Audit
                            </button>
                        )}
                    </div>

                    {activeTab === 'audit' && (
                        <WCAuditReportTable reports={data.reports} loading={loading} />
                    )}

                    {activeTab === 'codes' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">NCCI Code</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Description</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">State</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Base Rate / $100</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">OT Exclusion</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {data.codes.map(c => (
                                        <tr key={c._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4 text-sm font-mono font-bold text-gray-900 dark:text-white">{c.ncciCode}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{c.description}</td>
                                            <td className="px-6 py-4 text-sm text-center text-gray-700 dark:text-slate-300">{c.stateCode}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono text-gray-900 dark:text-white">${c.baseManualRate.toFixed(2)}</td>
                                            <td className="px-6 py-4 text-center">
                                                {c.allowsOTExclusion ? (
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Allowed</span>
                                                ) : (
                                                    <span className="text-gray-400 text-xs">No</span>
                                                )}
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
