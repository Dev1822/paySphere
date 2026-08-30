import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import AddIcon from '@mui/icons-material/Add';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';

export default function IPBonusPortal() {
    const [data, setData] = useState({ disclosures: [], payouts: [] });
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ title: '', description: '', inventors: [{ employeeId: '', splitPercentage: 100 }] });

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/api/ip/my-ip');
            setData(res.data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/ip/disclosures', formData);
            alert('Disclosure submitted!');
            setShowForm(false);
            fetchData();
        } catch (err) { alert(err.response?.data?.message || 'Submission failed.'); }
    };

    const addInventor = () => setFormData({ ...formData, inventors: [...formData.inventors, { employeeId: '', splitPercentage: 0 }] });

    const totalEarned = data.payouts.filter(p => p.status === 'Paid' || p.status === 'Injected').reduce((sum, p) => sum + p.amount, 0);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="IPBonus" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <LightbulbIcon className="text-yellow-500" /> IP & Patent Bonus Portal
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-xl border border-yellow-200 dark:border-yellow-800">
                            <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 uppercase">Total IP Bonuses Earned</p>
                            <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mt-2">${totalEarned.toLocaleString()}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
                            <p className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase">Disclosures Submitted</p>
                            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{data.disclosures.length}</p>
                        </div>
                        <button onClick={() => setShowForm(true)} className="bg-brand-600 p-6 rounded-xl shadow-sm hover:shadow-md transition flex flex-col items-center justify-center text-white">
                            <AddIcon fontSize="large" />
                            <span className="font-bold mt-2">Submit New Invention</span>
                        </button>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">My Invention Disclosures</h2>
                        </div>
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                            <thead className="bg-gray-50 dark:bg-slate-900/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Title</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Status</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">My Split</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                {loading ? (
                                    <tr><td colSpan="3" className="px-6 py-12 text-center text-gray-500">Loading...</td></tr>
                                ) : data.disclosures.map(d => (
                                    <tr key={d._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{d.title}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${d.status === 'Approved for Filing' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                                                {d.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-right font-mono text-gray-700 dark:text-slate-300">
                                            {d.inventors[0]?.splitPercentage}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {showForm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Submit Invention Disclosure</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Invention Title</label>
                                <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Technical Description</label>
                                <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} required rows="4" className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-semibold text-gray-700 dark:text-slate-300">Co-Inventors & Splits</label>
                                    <button type="button" onClick={addInventor} className="text-xs text-brand-600 font-bold">+ Add Inventor</button>
                                </div>
                                {formData.inventors.map((inv, i) => (
                                    <div key={i} className="grid grid-cols-12 gap-2">
                                        <input type="text" placeholder="Employee ID" value={inv.employeeId} onChange={e => { const n = [...formData.inventors]; n[i].employeeId = e.target.value; setFormData({ ...formData, inventors: n }); }} required className="col-span-8 px-2 py-1 rounded border dark:bg-slate-900 dark:border-slate-600 dark:text-white text-sm" />
                                        <input type="number" placeholder="%" value={inv.splitPercentage} onChange={e => { const n = [...formData.inventors]; n[i].splitPercentage = Number(e.target.value); setFormData({ ...formData, inventors: n }); }} required className="col-span-4 px-2 py-1 rounded border dark:bg-slate-900 dark:border-slate-600 dark:text-white text-sm" />
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 dark:text-slate-400">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700">Submit Disclosure</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
