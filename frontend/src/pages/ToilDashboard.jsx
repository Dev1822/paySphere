import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import { formatDate } from '../utils/formatLocale';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';

export default function ToilDashboard() {
    const [data, setData] = useState({ balance: 0, ledger: [], expiringSoon: [] });
    const [loading, setLoading] = useState(true);
    const [showRequestModal, setShowRequestModal] = useState(false);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/api/toil/my-data');
            setData(res.data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleRequest = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        try {
            await api.post('/api/toil/request', {
                requestType: formData.get('requestType'),
                daysRequested: Number(formData.get('daysRequested')),
                startDate: formData.get('startDate'),
                endDate: formData.get('endDate'),
                remarks: formData.get('remarks')
            });
            alert('Request submitted!');
            setShowRequestModal(false);
            fetchData();
        } catch (err) { alert(err.response?.data?.message || 'Failed to submit request.'); }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="TOIL" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <AccessTimeIcon /> Compensatory Off (TOIL) Dashboard
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-brand-50 dark:bg-brand-900/20 p-6 rounded-xl border border-brand-200 dark:border-brand-800">
                            <p className="text-sm font-semibold text-brand-800 dark:text-brand-200 uppercase">Available Balance</p>
                            <p className="text-4xl font-bold text-brand-600 dark:text-brand-400 mt-2">{data.balance} <span className="text-lg">Days</span></p>
                            <button onClick={() => setShowRequestModal(true)} className="mt-4 px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 text-sm flex items-center gap-2">
                                <EventAvailableIcon fontSize="small" /> Request Time Off
                            </button>
                        </div>

                        <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-xl border border-amber-200 dark:border-amber-800 md:col-span-2">
                            <div className="flex items-center gap-2 mb-2">
                                <WarningAmberIcon className="text-amber-600 dark:text-amber-400" />
                                <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 uppercase">Expiring in 30 Days</p>
                            </div>
                            {data.expiringSoon.length === 0 ? (
                                <p className="text-sm text-amber-700 dark:text-amber-300">No TOIL days expiring soon.</p>
                            ) : (
                                <div className="space-y-2 mt-3">
                                    {data.expiringSoon.map(exp => (
                                        <div key={exp._id} className="flex justify-between text-sm text-amber-800 dark:text-amber-200">
                                            <span>{exp.days} days from {formatDate(exp.createdAt)}</span>
                                            <span className="font-bold">Expires: {formatDate(exp.expiresAt)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Transaction Ledger</h2>
                        </div>
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                            <thead className="bg-gray-50 dark:bg-slate-900/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Description</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Days</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Balance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                {loading ? (
                                    <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-500">Loading ledger...</td></tr>
                                ) : data.ledger.map(rec => (
                                    <tr key={rec._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                        <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{formatDate(rec.createdAt)}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${rec.transactionType === 'Accrual' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                                                    rec.transactionType === 'Usage' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                                                        'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                                }`}>{rec.transactionType}</span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{rec.description}</td>
                                        <td className={`px-6 py-4 text-sm text-right font-mono font-bold ${rec.days > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {rec.days > 0 ? '+' : ''}{rec.days}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-right font-mono text-gray-900 dark:text-white">{rec.balanceAfter}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {showRequestModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-md p-6">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Request TOIL Time Off</h2>
                        <form onSubmit={handleRequest} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Days Requested</label>
                                <input type="number" name="daysRequested" step="0.5" min="0.5" max={data.balance} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Start Date</label>
                                    <input type="date" name="startDate" required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">End Date</label>
                                    <input type="date" name="endDate" required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                                </div>
                            </div>
                            <input type="hidden" name="requestType" value="TimeOff" />
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setShowRequestModal(false)} className="px-4 py-2 text-gray-600 dark:text-slate-400">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700">Submit Request</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
