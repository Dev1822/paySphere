import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import UploadFileIcon from '@mui/icons-material/UploadFile';

export default function SickPayReconciliationDashboard() {
    const [data, setData] = useState({ policies: [], pendingFeeds: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/api/sick-pay/dashboard');
            setData(res.data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleInject = async (feedIds) => {
        try {
            await api.post('/api/sick-pay/inject', { feedIds, payrollRunId: 'mock_run' });
            alert('Sick pay injected into payroll register.');
            fetchData();
        } catch (err) { alert('Injection failed.'); }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="SickPay" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <MedicalServicesIcon className="text-red-500" /> Third-Party Sick Pay Reconciliation
                    </h1>
                    <ThemeToggle />
                </div>
                <div className="p-4 lg:p-8 space-y-6">
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                            <h2 className="font-bold text-gray-900 dark:text-white">Pending Carrier Feeds</h2>
                        </div>
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                            <thead className="bg-gray-50 dark:bg-slate-900/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Employee</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Date</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Gross Benefit</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Taxable %</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                {loading ? (
                                    <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-500">Loading...</td></tr>
                                ) : data.pendingFeeds.map(f => (
                                    <tr key={f._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{f.employeeId?.fullName}</td>
                                        <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{new Date(f.paymentDate).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 text-sm text-right font-mono">${f.grossBenefitAmount.toFixed(2)}</td>
                                        <td className="px-6 py-4 text-sm text-right font-mono">{(f.taxablePercentage * 100).toFixed(0)}%</td>
                                        <td className="px-6 py-4 text-center">
                                            <button onClick={() => handleInject([f._id])} className="text-xs font-bold text-brand-600 hover:underline flex items-center gap-1 mx-auto">
                                                <UploadFileIcon fontSize="small" /> Inject
                                            </button>
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
