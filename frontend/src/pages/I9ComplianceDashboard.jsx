import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

export default function I9ComplianceDashboard() {
    const [data, setData] = useState({ pendingSection2: [], expiringDocs: [] });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('pending');

    useEffect(() => { fetchDashboard(); }, []);

    const fetchDashboard = async () => {
        try {
            const res = await api.get('/api/eligibility/dashboard');
            setData(res.data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleVerifySection2 = async (employeeId) => {
        if (!window.confirm('Confirm physical documents have been inspected?')) return;
        try {
            await api.post('/api/eligibility/section2', { employeeId });
            alert('Section 2 verified. Employee cleared for payroll.');
            fetchDashboard();
        } catch (err) { alert('Verification failed.'); }
    };

    const handleRunScan = async () => {
        try {
            const res = await api.post('/api/eligibility/scan');
            alert(`Scan complete. ${res.data.alertsTriggered} new alerts triggered.`);
            fetchDashboard();
        } catch (err) { alert('Scan failed.'); }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="I9Compliance" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <VerifiedUserIcon className="text-blue-500" /> I-9 & Eligibility Compliance
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    <div className="flex justify-end">
                        <button onClick={handleRunScan} className="px-4 py-2 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 flex items-center gap-2">
                            <WarningAmberIcon fontSize="small" /> Run Daily Expiration Scan
                        </button>
                    </div>

                    <div className="flex border-b border-gray-200 dark:border-slate-700">
                        <button onClick={() => setActiveTab('pending')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'pending' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
                            Pending Section 2 ({data.pendingSection2.length})
                        </button>
                        <button onClick={() => setActiveTab('expiring')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'expiring' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
                            Expiring Authorizations ({data.expiringDocs.length})
                        </button>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                        {activeTab === 'pending' && (
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Employee</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Department</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Status</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {loading ? (
                                        <tr><td colSpan="4" className="px-6 py-12 text-center text-gray-500">Loading...</td></tr>
                                    ) : data.pendingSection2.map(r => (
                                        <tr key={r._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{r.employeeId?.fullName}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{r.employeeId?.department}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">Payroll Blocked</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button onClick={() => handleVerifySection2(r.employeeId._id)} className="text-xs font-bold text-green-600 hover:underline flex items-center gap-1 mx-auto">
                                                    <CheckCircleIcon fontSize="small" /> Verify Docs
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {activeTab === 'expiring' && (
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Employee</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Document</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Expiration</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {data.expiringDocs.map(d => (
                                        <tr key={d._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{d.employeeId?.fullName}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{d.documentType}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{new Date(d.expirationDate).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${d.reverificationStatus === 'Expired' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                                                    {d.reverificationStatus}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
