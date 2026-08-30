import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

export default function Form941Dashboard() {
    const [data, setData] = useState({ schedule: null, filings: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/api/federal-tax/dashboard');
            setData(res.data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="FederalTax" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <AccountBalanceIcon className="text-blue-500" /> Form 941 & Tax Deposits
                    </h1>
                    <ThemeToggle />
                </div>
                <div className="p-4 lg:p-8 space-y-6">
                    {data.schedule && (
                        <div className={`p-4 rounded-xl border flex items-start gap-3 ${data.schedule.depositorType === 'Semi-Weekly' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'}`}>
                            <WarningAmberIcon className={data.schedule.depositorType === 'Semi-Weekly' ? 'text-amber-600' : 'text-green-600'} />
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Current Schedule: {data.schedule.depositorType} Depositor</h3>
                                <p className="text-xs text-gray-600 dark:text-slate-300 mt-1">
                                    Based on lookback period ({new Date(data.schedule.lookbackStartDate).toLocaleDateString()} to {new Date(data.schedule.lookbackEndDate).toLocaleDateString()}). Total Liability: ${data.schedule.lookbackTotalLiability.toLocaleString()}.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                            <h2 className="font-bold text-gray-900 dark:text-white">Quarterly Form 941 Filings</h2>
                        </div>
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                            <thead className="bg-gray-50 dark:bg-slate-900/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Quarter</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Total Liability</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Deposits Made</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Balance Due</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                {data.filings.map(f => (
                                    <tr key={f._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">Q{f.quarter} {f.taxYear}</td>
                                        <td className="px-6 py-4 text-sm text-right font-mono">${f.totalLiabilityForQuarter.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-sm text-right font-mono text-green-600">${f.totalDepositsMade.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-sm text-right font-mono font-bold text-red-600">${f.balanceDue.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${f.status === 'Filed' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{f.status}</span>
                                        </td>
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
