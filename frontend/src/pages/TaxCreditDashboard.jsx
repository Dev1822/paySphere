import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

export default function TaxCreditDashboard() {
    const [data, setData] = useState({ groups: [], certs: [], slaAlerts: [] });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('alerts');

    useEffect(() => { fetchData(); }, []);
    const fetchData = async () => {
        try { const res = await api.get('/api/wotc/dashboard'); setData(res.data); }
        catch (err) { console.error(err); } finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
            <Sidebar activePage="WOTC" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><CardGiftcardIcon className="text-green-500" /> WOTC Tax Credit & Wage Allocation</h1>
                    <ThemeToggle />
                </div>
                <div className="p-4 lg:p-8 space-y-6">
                    {data.slaAlerts.length > 0 && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
                            <WarningAmberIcon className="text-red-600 dark:text-red-400 mt-0.5" />
                            <div>
                                <h3 className="text-sm font-bold text-red-800 dark:text-red-200">28-Day SLA Guardrail Alert</h3>
                                <p className="text-xs text-red-700 dark:text-red-300 mt-1">{data.slaAlerts.length} employee(s) have Form 8850 submissions due within 7 days. Missing this window forfeits the tax credit.</p>
                            </div>
                        </div>
                    )}
                    <div className="flex border-b border-gray-200 dark:border-slate-700">
                        <button onClick={() => setActiveTab('alerts')} className={`px-4 py-2 text-sm font-semibold border-b-2 ${activeTab === 'alerts' ? 'border-brand-600 text-brand-600' : 'text-gray-500'}`}>Certifications & SLA</button>
                        <button onClick={() => setActiveTab('groups')} className={`px-4 py-2 text-sm font-semibold border-b-2 ${activeTab === 'groups' ? 'border-brand-600 text-brand-600' : 'text-gray-500'}`}>Target Groups</button>
                    </div>
                    {activeTab === 'alerts' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Employee</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Group</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Hire Date</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Status</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Days Left</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {loading ? <tr><td colSpan="5" className="p-8 text-center text-gray-500">Loading...</td></tr> : data.certs.map(c => {
                                        const sla = c.form8850Submitted ? { daysRemaining: 'Submitted' } : { daysRemaining: Math.ceil((new Date(new Date(c.hireDate).getTime() + 28 * 86400000) - new Date()) / 86400000) };
                                        return (
                                            <tr key={c._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                                <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{c.employeeId?.fullName}</td>
                                                <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{c.targetGroupId?.groupCode}</td>
                                                <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{new Date(c.hireDate).toLocaleDateString()}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${c.form8850Submitted ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{c.form8850Submitted ? 'Submitted' : 'Pending'}</span>
                                                </td>
                                                <td className="px-6 py-4 text-center text-sm font-bold">{sla.daysRemaining}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {activeTab === 'groups' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Code</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Description</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Max Wages</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Credit %</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {data.groups.map(g => (
                                        <tr key={g._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white">{g.groupCode}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{g.description}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono">${g.maxQualifiedWages.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono">{(g.creditPercentage * 100).toFixed(0)}%</td>
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
