import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

export default function EWAPortal() {
    const [activeTab, setActiveTab] = useState('employee');
    const [balanceData, setBalanceData] = useState(null);
    const [adminData, setAdminData] = useState(null);
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (activeTab === 'employee') fetchBalance();
        else fetchAdmin();
    }, [activeTab]);

    const fetchBalance = async () => {
        try {
            const res = await api.get('/api/ewa/my-balance');
            setBalanceData(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchAdmin = async () => {
        try {
            const res = await api.get('/api/ewa/admin');
            setAdminData(res.data);
        } catch (err) { console.error(err); }
    };

    const handleWithdraw = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/api/ewa/withdraw', { requestedAmount: Number(withdrawAmount) });
            alert('Funds transferred successfully!');
            setWithdrawAmount('');
            fetchBalance();
        } catch (err) { alert(err.response?.data?.message || 'Withdrawal failed.'); } finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="EWA" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <AccountBalanceWalletIcon className="text-green-500" /> Earned Wage Access (EWA)
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    <div className="flex border-b border-gray-200 dark:border-slate-700">
                        <button onClick={() => setActiveTab('employee')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'employee' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
                            Employee Portal
                        </button>
                        <button onClick={() => setActiveTab('admin')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'admin' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
                            Finance Admin
                        </button>
                    </div>

                    {activeTab === 'employee' && balanceData && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-6 rounded-2xl text-white shadow-lg">
                                <p className="text-sm font-semibold opacity-90 uppercase">Available to Withdraw</p>
                                <p className="text-4xl font-bold mt-2">${balanceData.availableBalance.toLocaleString()}</p>
                                <p className="text-xs mt-4 opacity-75">Transaction Fee: ${balanceData.transactionFee} per transfer</p>
                            </div>

                            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Request Transfer</h3>
                                <form onSubmit={handleWithdraw} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Amount</label>
                                        <input
                                            type="number"
                                            max={balanceData.availableBalance}
                                            value={withdrawAmount}
                                            onChange={e => setWithdrawAmount(e.target.value)}
                                            required
                                            className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white"
                                        />
                                    </div>
                                    <button type="submit" disabled={loading} className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg disabled:opacity-50">
                                        {loading ? 'Processing...' : 'Transfer Funds'}
                                    </button>
                                </form>
                            </div>

                            <div className="lg:col-span-2 grid grid-cols-3 gap-4">
                                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                                    <p className="text-xs text-gray-500 dark:text-slate-400">Gross Accrued (YTD)</p>
                                    <p className="text-xl font-bold text-gray-900 dark:text-white">${balanceData.cumulativeGross.toLocaleString()}</p>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                                    <p className="text-xs text-gray-500 dark:text-slate-400">Net Accrued</p>
                                    <p className="text-xl font-bold text-gray-900 dark:text-white">${balanceData.cumulativeNetAccrued.toLocaleString()}</p>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                                    <p className="text-xs text-gray-500 dark:text-slate-400">Withdrawals Used</p>
                                    <p className="text-xl font-bold text-gray-900 dark:text-white">{balanceData.withdrawalCount} / {balanceData.maxWithdrawals}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'admin' && adminData && (
                        <div className="space-y-6">
                            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-3">
                                <WarningAmberIcon className="text-amber-600 dark:text-amber-400 mt-0.5" />
                                <p className="text-sm text-amber-800 dark:text-amber-200">
                                    <strong>Payday Reconciliation Interceptor:</strong> Run the offset batch before finalizing payroll to automatically inject negative deduction line items and recover EWA advances.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
                                    <p className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase">Current Liability</p>
                                    <p className="text-3xl font-bold text-brand-600 dark:text-brand-400 mt-2">${adminData.currentLiability.total.toLocaleString()}</p>
                                    <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">{adminData.currentLiability.count} active advances</p>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
                                    <p className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase">Max Accrual Cap</p>
                                    <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{(adminData.config?.maxAccrualPercentage || 0) * 100}%</p>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
                                    <p className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase">Tax Holdback Rate</p>
                                    <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{(adminData.config?.estimatedTaxHoldbackRate || 0) * 100}%</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
