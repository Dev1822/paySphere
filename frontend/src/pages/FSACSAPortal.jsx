import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import SavingsIcon from '@mui/icons-material/Savings';
import InfoIcon from '@mui/icons-material/Info';

export default function FSACSAPortal() {
    const [data, setData] = useState({ elections: [], ledgers: [], config: null });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('fsa');

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/api/fsa-hsa/portal');
            setData(res.data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const fsaElection = data.elections.find(e => e.accountType === 'FSA');
    const hsaElection = data.elections.find(e => e.accountType === 'HSA');

    const fsaYTD = data.ledgers.filter(l => l.electionId === fsaElection?._id).reduce((sum, l) => sum + l.employeeDeduction, 0);
    const hsaYTD = data.ledgers.filter(l => l.electionId === hsaElection?._id).reduce((sum, l) => sum + l.employeeDeduction, 0);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Benefits" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <LocalHospitalIcon className="text-teal-500" /> FSA & HSA Benefits Portal
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl flex items-start gap-3">
                        <InfoIcon className="text-blue-600 dark:text-blue-400 mt-0.5" />
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                            <strong>Tax Advantage:</strong> Contributions are deducted from your gross pay before taxes, lowering your taxable income. FSA funds are typically "use-it-or-lose-it" (subject to plan rules), while HSA funds roll over indefinitely.
                        </p>
                    </div>

                    <div className="flex border-b border-gray-200 dark:border-slate-700">
                        <button onClick={() => setActiveTab('fsa')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'fsa' ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-500'}`}>
                            Flexible Spending Account (FSA)
                        </button>
                        <button onClick={() => setActiveTab('hsa')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'hsa' ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-500'}`}>
                            Health Savings Account (HSA)
                        </button>
                    </div>

                    {activeTab === 'fsa' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
                                <div className="flex items-center gap-2 mb-4">
                                    <SavingsIcon className="text-teal-600" />
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">FSA Overview</h2>
                                </div>
                                {fsaElection ? (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-xs text-gray-500 dark:text-slate-400">Annual Election</p>
                                                <p className="text-2xl font-bold text-gray-900 dark:text-white">${fsaElection.electedAnnualAmount.toLocaleString()}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 dark:text-slate-400">YTD Contributions</p>
                                                <p className="text-2xl font-bold text-teal-600 dark:text-teal-400">${fsaYTD.toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-3">
                                            <div className="bg-teal-500 h-3 rounded-full" style={{ width: `${Math.min(100, (fsaYTD / fsaElection.electedAnnualAmount) * 100)}%` }}></div>
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-slate-400">
                                            Plan Rule: <strong>{data.config?.fsaTransitionRule === 'Carryover' ? `Up to $${data.config.fsaCarryoverLimit} Carryover` : data.config?.fsaTransitionRule === 'GracePeriod' ? `${data.config.fsaGracePeriodDays}-Day Grace Period` : 'Use-It-Or-Lose-It'}</strong>
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-gray-500 dark:text-slate-400">No active FSA election for this plan year.</p>
                                )}
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">IRS Limits ({new Date().getFullYear()})</h3>
                                <ul className="space-y-2 text-sm text-gray-600 dark:text-slate-300">
                                    <li className="flex justify-between"><span>Max Contribution:</span> <strong>${data.config?.fsaAnnualLimit || 3200}</strong></li>
                                    <li className="flex justify-between"><span>Max Carryover:</span> <strong>${data.config?.fsaCarryoverLimit || 640}</strong></li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {activeTab === 'hsa' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
                                <div className="flex items-center gap-2 mb-4">
                                    <SavingsIcon className="text-teal-600" />
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">HSA Overview</h2>
                                </div>
                                {hsaElection ? (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-xs text-gray-500 dark:text-slate-400">Annual Election ({hsaElection.coverageType})</p>
                                                <p className="text-2xl font-bold text-gray-900 dark:text-white">${hsaElection.electedAnnualAmount.toLocaleString()}</p>
                                                {hsaElection.isCatchUp && <p className="text-xs text-amber-600">+ ${hsaElection.catchUpAmount} Catch-Up (55+)</p>}
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 dark:text-slate-400">YTD Contributions</p>
                                                <p className="text-2xl font-bold text-teal-600 dark:text-teal-400">${hsaYTD.toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-3">
                                            <div className="bg-teal-500 h-3 rounded-full" style={{ width: `${Math.min(100, (hsaYTD / (hsaElection.electedAnnualAmount + hsaElection.catchUpAmount)) * 100)}%` }}></div>
                                        </div>
                                        <p className="text-xs text-green-600 dark:text-green-400 font-bold">HSA funds roll over indefinitely year-over-year.</p>
                                    </div>
                                ) : (
                                    <p className="text-gray-500 dark:text-slate-400">No active HSA election for this plan year.</p>
                                )}
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">IRS Limits ({new Date().getFullYear()})</h3>
                                <ul className="space-y-2 text-sm text-gray-600 dark:text-slate-300">
                                    <li className="flex justify-between"><span>Self Limit:</span> <strong>${data.config?.hsaAnnualLimitSelf || 4150}</strong></li>
                                    <li className="flex justify-between"><span>Family Limit:</span> <strong>${data.config?.hsaAnnualLimitFamily || 8300}</strong></li>
                                    <li className="flex justify-between"><span>Catch-Up (55+):</span> <strong>${data.config?.hsaCatchUpLimit || 1000}</strong></li>
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
