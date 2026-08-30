import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ShieldIcon from '@mui/icons-material/Shield';

export default function PFMLComplianceDashboard() {
    const [data, setData] = useState({ policies: [], protections: [], capStatus: [] });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('policies');

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/api/pfml-sdi/dashboard');
            setData(res.data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleRunAudit = async () => {
        try {
            const res = await api.post('/api/pfml-sdi/audit');
            alert(`Audit complete. ${res.data.alertsTriggered} new expiration alerts triggered.`);
            fetchData();
        } catch (err) { alert('Audit failed.'); }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="PFML" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <FamilyRestroomIcon className="text-purple-500" /> PFML & SDI Compliance
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    <div className="flex justify-between items-center">
                        <div className="flex border-b border-gray-200 dark:border-slate-700">
                            <button onClick={() => setActiveTab('policies')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'policies' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>State Policies</button>
                            <button onClick={() => setActiveTab('protection')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'protection' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>Job Protection Tracker</button>
                        </div>
                        {activeTab === 'protection' && (
                            <button onClick={handleRunAudit} className="px-4 py-2 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 flex items-center gap-2">
                                <WarningAmberIcon fontSize="small" /> Run Protection Audit
                            </button>
                        )}
                    </div>

                    {activeTab === 'policies' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">State</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Program</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">EE Rate</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">ER Rate</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Wage Cap</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Protected Weeks</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {loading ? (
                                        <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-500">Loading...</td></tr>
                                    ) : data.policies.map(p => (
                                        <tr key={p._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white">{p.stateCode}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{p.programType}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono text-gray-700 dark:text-slate-300">{(p.employeeRate * 100).toFixed(2)}%</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono text-gray-700 dark:text-slate-300">{(p.employerRate * 100).toFixed(2)}%</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono text-gray-900 dark:text-white">${p.annualTaxableWageCap.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-center text-sm font-bold text-purple-600 dark:text-purple-400">{p.maxProtectedWeeks} wks</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'protection' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Employee</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Leave Start</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Protection Ends</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {data.protections.map(p => (
                                        <tr key={p._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{p.employeeId?.fullName}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{new Date(p.leaveStartDate).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{new Date(p.protectionEndDate).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 justify-center ${p.status === 'Expiring Soon' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                                                        p.status === 'Active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                                                            'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
                                                    }`}>
                                                    {p.status === 'Expiring Soon' && <WarningAmberIcon fontSize="small" />}
                                                    {p.status}
                                                </span>
                                            </td>
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
