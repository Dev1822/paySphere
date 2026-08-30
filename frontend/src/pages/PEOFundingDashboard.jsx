import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import ReceiptIcon from '@mui/icons-material/Receipt';

export default function PEOFundingDashboard() {
    const [data, setData] = useState({ mappings: [], requests: [] });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('requests');

    useEffect(() => { fetchData(); }, []);
    const fetchData = async () => {
        try { const res = await api.get('/api/peo/dashboard'); setData(res.data); }
        catch (err) { console.error(err); } finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
            <Sidebar activePage="PEO" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><AccountBalanceIcon className="text-purple-500" /> PEO Co-Employment & Intercompany Funding</h1>
                    <ThemeToggle />
                </div>
                <div className="p-4 lg:p-8 space-y-6">
                    <div className="flex border-b border-gray-200 dark:border-slate-700">
                        <button onClick={() => setActiveTab('requests')} className={`px-4 py-2 text-sm font-semibold border-b-2 ${activeTab === 'requests' ? 'border-brand-600 text-brand-600' : 'text-gray-500'}`}>Funding Requests</button>
                        <button onClick={() => setActiveTab('mappings')} className={`px-4 py-2 text-sm font-semibold border-b-2 ${activeTab === 'mappings' ? 'border-brand-600 text-brand-600' : 'text-gray-500'}`}>Client Mappings</button>
                    </div>

                    {activeTab === 'requests' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Run ID</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Net Pay</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">ER Taxes</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Admin Fee</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Total Wire</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {loading ? <tr><td colSpan="6" className="p-8 text-center text-gray-500">Loading...</td></tr> : data.requests.map(r => (
                                        <tr key={r._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4 text-sm font-mono text-gray-900 dark:text-white">{r.payrollRunId}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono">${r.netPayTotal.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono">${r.employerTaxesTotal.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono text-amber-600">${r.adminFeeTotal.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono font-bold text-brand-600 dark:text-brand-400">${r.totalFundingRequested.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-center"><span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">{r.status}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'mappings' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Client Company ID</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">PEO EIN</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Admin Fee %</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Default GL</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {data.mappings.map(m => (
                                        <tr key={m._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4 text-sm font-mono text-gray-900 dark:text-white">{m.clientCompanyId}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{m.peoEIN}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono">{(m.adminFeePercentage * 100).toFixed(2)}%</td>
                                            <td className="px-6 py-4 text-sm font-mono text-gray-700 dark:text-slate-300">{m.defaultGLAccount}</td>
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
