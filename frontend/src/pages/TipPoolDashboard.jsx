import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import LocalBarIcon from '@mui/icons-material/LocalBar';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

export default function TipPoolDashboard() {
    const [data, setData] = useState({ pools: [], recentLedgers: [] });
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], grossCashTips: 0, grossCreditTips: 0, bohtipOutPercentage: 5 });

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/api/tip-pool/dashboard');
            setData(res.data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleRecord = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/tip-pool/daily', formData);
            alert('Daily tips recorded!');
            setShowForm(false);
            fetchData();
        } catch (err) { alert('Failed to record tips.'); }
    };

    const totalTipsThisWeek = data.recentLedgers.slice(0, 7).reduce((sum, l) => sum + l.totalGrossTips, 0);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Tips" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <LocalBarIcon className="text-amber-500" /> Tip Pooling & Gratuity Allocation
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-xl border border-green-200 dark:border-green-800">
                            <p className="text-sm font-semibold text-green-800 dark:text-green-200 uppercase">Gross Tips (Last 7 Days)</p>
                            <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">${totalTipsThisWeek.toLocaleString()}</p>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl border border-blue-200 dark:border-blue-800">
                            <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 uppercase">Active Pools</p>
                            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">{data.pools.length}</p>
                        </div>
                        <button onClick={() => setShowForm(true)} className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md transition flex flex-col items-center justify-center text-brand-600 dark:text-brand-400">
                            <AttachMoneyIcon fontSize="large" />
                            <span className="font-bold mt-2">Record Daily Tips</span>
                        </button>
                    </div>

                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-3">
                        <WarningAmberIcon className="text-amber-600 dark:text-amber-400 mt-0.5" />
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                            <strong>FLSA Guardrail Active:</strong> Managers and supervisors are automatically excluded from tip pool distributions. Minimum wage make-whole top-ups will be calculated during batch processing.
                        </p>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Daily Gratuity Ledger</h2>
                        </div>
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                            <thead className="bg-gray-50 dark:bg-slate-900/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Date</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Cash Tips</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Credit Tips</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">BOH Tip-Out</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Net FOH Pool</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                {loading ? (
                                    <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-500">Loading...</td></tr>
                                ) : data.recentLedgers.map(l => (
                                    <tr key={l._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{new Date(l.date).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 text-sm text-right font-mono text-gray-700 dark:text-slate-300">${l.grossCashTips.toFixed(2)}</td>
                                        <td className="px-6 py-4 text-sm text-right font-mono text-gray-700 dark:text-slate-300">${l.grossCreditTips.toFixed(2)}</td>
                                        <td className="px-6 py-4 text-sm text-right font-mono text-red-600 dark:text-red-400">-${l.bohTipOutAmount.toFixed(2)}</td>
                                        <td className="px-6 py-4 text-sm text-right font-mono font-bold text-green-600 dark:text-green-400">${l.netFOHTips.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {showForm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-md p-6">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Record Daily Gratuity</h2>
                        <form onSubmit={handleRecord} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Date</label>
                                <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Gross Cash Tips</label>
                                    <input type="number" step="0.01" value={formData.grossCashTips} onChange={e => setFormData({ ...formData, grossCashTips: Number(e.target.value) })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Gross Credit Tips</label>
                                    <input type="number" step="0.01" value={formData.grossCreditTips} onChange={e => setFormData({ ...formData, grossCreditTips: Number(e.target.value) })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">BOH Tip-Out %</label>
                                <input type="number" step="0.1" value={formData.bohtipOutPercentage} onChange={e => setFormData({ ...formData, bohtipOutPercentage: Number(e.target.value) })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 dark:text-slate-400">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700">Submit Ledger</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
