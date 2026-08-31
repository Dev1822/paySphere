import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import JurisdictionConflictAlert from '../components/JurisdictionConflictAlert';

/**
 * @fileoverview Local Tax Dashboard
 * @description Main UI for managing municipal jurisdictions, commuter rules, and monitoring liabilities.
 * Issue: #2062
 */
export default function LocalTaxDashboard() {
    const [data, setData] = useState({ jurisdictions: [], rules: [], ytdSummary: [] });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('jurisdictions');
    const [conflicts, setConflicts] = useState([]);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/api/local-tax/dashboard');
            setData(res.data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleTestPayroll = async () => {
        try {
            // Mocking a payroll run to trigger conflict guardrails
            const res = await api.post('/api/local-tax/process', {
                payrollRunId: 'mock_run', taxYear: new Date().getFullYear(),
                employeePayouts: [{ employeeId: 'mock_emp_1', grossPay: 2500 }]
            });
            setConflicts(res.data.conflicts);
            alert('Local tax payroll processed.');
            fetchData();
        } catch (err) { alert('Processing failed.'); }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="LocalTax" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <LocationCityIcon className="text-teal-500" /> Local City, County & School District Tax
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    <JurisdictionConflictAlert conflicts={conflicts} />

                    <div className="flex justify-between items-center border-b border-gray-200 dark:border-slate-700">
                        <div className="flex">
                            <button onClick={() => setActiveTab('jurisdictions')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'jurisdictions' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
                                Jurisdictions
                            </button>
                            <button onClick={() => setActiveTab('rules')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'rules' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
                                Commuter Rules
                            </button>
                            <button onClick={() => setActiveTab('summary')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'summary' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
                                YTD Liabilities
                            </button>
                        </div>
                        <button onClick={handleTestPayroll} className="px-4 py-2 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 flex items-center gap-2">
                            <SwapHorizIcon fontSize="small" /> Run Tax Evaluation
                        </button>
                    </div>

                    {activeTab === 'jurisdictions' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Code</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Jurisdiction</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">State</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Resident Rate</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Non-Res Rate</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Framework</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {loading ? (
                                        <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-500">Loading...</td></tr>
                                    ) : data.jurisdictions.map(j => (
                                        <tr key={j._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4 text-sm font-mono font-bold text-gray-900 dark:text-white">{j.jurisdictionCode}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{j.jurisdictionName}</td>
                                            <td className="px-6 py-4 text-sm text-center text-gray-700 dark:text-slate-300">{j.stateCode}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono text-gray-900 dark:text-white">{(j.residentRate * 100).toFixed(2)}%</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono text-gray-700 dark:text-slate-300">{(j.nonResidentRate * 100).toFixed(2)}%</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${j.reciprocityFramework !== 'NONE' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'}`}>
                                                    {j.reciprocityFramework}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'rules' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Home Jurisdiction</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Work Jurisdiction</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Credit Type</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Max Credit %</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {data.rules.length === 0 ? (
                                        <tr><td colSpan="4" className="px-6 py-12 text-center text-gray-500">No custom commuter rules configured.</td></tr>
                                    ) : data.rules.map(r => (
                                        <tr key={r._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4 text-sm font-mono text-gray-900 dark:text-white">{r.homeJurisdictionCode}</td>
                                            <td className="px-6 py-4 text-sm font-mono text-gray-900 dark:text-white">{r.workJurisdictionCode}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">{r.creditType}</span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-right font-mono text-gray-700 dark:text-slate-300">{(r.maxCreditPercentage * 100).toFixed(0)}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'summary' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Jurisdiction Code</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">YTD Taxable Wages</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">YTD Tax Withheld</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Commuter Credits Applied</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {data.ytdSummary.map(s => (
                                        <tr key={s._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4 text-sm font-mono font-bold text-gray-900 dark:text-white">{s._id}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono text-gray-700 dark:text-slate-300">${s.totalTaxable.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono font-bold text-teal-600 dark:text-teal-400">${s.totalWithheld.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono text-green-600 dark:text-green-400">${s.totalCredits.toLocaleString()}</td>
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
