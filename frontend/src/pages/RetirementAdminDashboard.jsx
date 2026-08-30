import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import SavingsIcon from '@mui/icons-material/Savings';
import AssessmentIcon from '@mui/icons-material/Assessment';

export default function RetirementAdminDashboard() {
    const [data, setData] = useState({ config: null, tests: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/api/retirement/dashboard');
            setData(res.data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleRunTest = async (type) => {
        try {
            const res = await api.post('/api/retirement/ndt-test', { planYear: new Date().getFullYear(), testType: type });
            alert(res.data.evaluation.reason);
            fetchData();
        } catch (err) { alert('Test failed.'); }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Retirement" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <SavingsIcon className="text-indigo-500" /> 401(k) & NDT Testing
                    </h1>
                    <ThemeToggle />
                </div>
                <div className="p-4 lg:p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <button onClick={() => handleRunTest('ADP')} className="p-6 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 hover:shadow-lg transition text-left">
                            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><AssessmentIcon /> Run ADP Test</h3>
                            <p className="text-sm text-gray-500 mt-2">Evaluates Actual Deferral Percentage for HCEs vs NHCEs.</p>
                        </button>
                        <button onClick={() => handleRunTest('ACP')} className="p-6 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 hover:shadow-lg transition text-left">
                            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><AssessmentIcon /> Run ACP Test</h3>
                            <p className="text-sm text-gray-500 mt-2">Evaluates Actual Contribution Percentage (employer match).</p>
                        </button>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700"><h2 className="font-bold text-gray-900 dark:text-white">Test History</h2></div>
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                            <thead className="bg-gray-50 dark:bg-slate-900/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Type</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">HCE %</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">NHCE %</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                {data.tests.map(t => (
                                    <tr key={t._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{t.testType}</td>
                                        <td className="px-6 py-4 text-sm text-right font-mono">{t.hcePercentage}%</td>
                                        <td className="px-6 py-4 text-sm text-right font-mono">{t.nhcePercentage}%</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${t.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {t.passed ? 'Passed' : 'Failed'}
                                            </span>
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
