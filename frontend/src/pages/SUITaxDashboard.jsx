import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import VoluntaryContributionAnalyzer from '../components/VoluntaryContributionAnalyzer';

/**
 * @fileoverview SUI Tax Dashboard
 * @description Main UI for managing state SUI rates, wage base caps, and voluntary contributions.
 * Issue: #2012
 */
export default function SUITaxDashboard() {
    const [data, setData] = useState({ schedules: [], analyses: [], capStatus: [] });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('rates');

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/api/sui-tax/dashboard');
            setData(res.data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleApplyRate = async (scheduleId) => {
        if (!window.confirm('Apply this SUI rate to all future payroll runs for this state?')) return;
        try {
            await api.post('/api/sui-tax/apply', { scheduleId });
            alert('Rate applied successfully.');
            fetchData();
        } catch (err) { alert('Failed to apply rate.'); }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="SUITax" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <AccountBalanceIcon className="text-blue-500" /> SUI Experience Rating & Voluntary Contributions
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    {data.schedules.length > 0 && (
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-3">
                            <WarningAmberIcon className="text-amber-600 dark:text-amber-400 mt-0.5" />
                            <div>
                                <h3 className="text-sm font-bold text-amber-800 dark:text-amber-200">Rate Expiration Guardrail Alert</h3>
                                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                                    {data.schedules.length} state rate notice(s) have been uploaded but not applied to payroll. Under-withholding may occur.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="flex border-b border-gray-200 dark:border-slate-700">
                        <button onClick={() => setActiveTab('rates')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'rates' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
                            State Rate Notices
                        </button>
                        <button onClick={() => setActiveTab('caps')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'caps' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
                            Wage Base Caps
                        </button>
                        <button onClick={() => setActiveTab('voluntary')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'voluntary' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
                            Voluntary Contributions
                        </button>
                    </div>

                    {activeTab === 'rates' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">State</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Assigned Rate</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Wage Base</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Tier</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Status</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {loading ? (
                                        <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-500">Loading...</td></tr>
                                    ) : data.schedules.map(s => (
                                        <tr key={s._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white">{s.stateCode}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono text-gray-900 dark:text-white">{(s.assignedRate * 100).toFixed(2)}%</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono text-gray-700 dark:text-slate-300">${s.taxableWageBase.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{s.rateTier}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">Pending Application</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button onClick={() => handleApplyRate(s._id)} className="text-xs font-bold text-green-600 hover:underline flex items-center gap-1 mx-auto">
                                                    <CheckCircleIcon fontSize="small" /> Apply Rate
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'caps' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">State</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Total Employees</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Employees at Cap</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Cap Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {data.capStatus.map(c => (
                                        <tr key={c._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white">{c._id}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono text-gray-700 dark:text-slate-300">{c.totalEmployees}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono text-green-600 dark:text-green-400">{c.employeesAtCap}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                                    {((c.employeesAtCap / c.totalEmployees) * 100).toFixed(0)}% Capped
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'voluntary' && (
                        <div className="space-y-6">
                            <VoluntaryContributionAnalyzer onAnalysisComplete={fetchData} />

                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                                    <h2 className="font-bold text-gray-900 dark:text-white">Recent ROI Analyses</h2>
                                </div>
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                    <thead className="bg-gray-50 dark:bg-slate-900/50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">State</th>
                                            <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Current Rate</th>
                                            <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Target Rate</th>
                                            <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Contribution</th>
                                            <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Net Savings</th>
                                            <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">ROI</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                        {data.analyses.map(a => (
                                            <tr key={a._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                                <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white">{a.stateCode}</td>
                                                <td className="px-6 py-4 text-sm text-right font-mono">{(a.currentRate * 100).toFixed(2)}%</td>
                                                <td className="px-6 py-4 text-sm text-right font-mono text-green-600">{(a.targetRate * 100).toFixed(2)}%</td>
                                                <td className="px-6 py-4 text-sm text-right font-mono">${a.requiredContribution.toLocaleString()}</td>
                                                <td className="px-6 py-4 text-sm text-right font-mono font-bold text-green-600">${a.netSavings.toLocaleString()}</td>
                                                <td className="px-6 py-4 text-sm text-right font-mono font-bold text-brand-600">{a.roiPercentage}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
