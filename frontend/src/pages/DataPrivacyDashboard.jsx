import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import SecurityIcon from '@mui/icons-material/Security';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import HistoryIcon from '@mui/icons-material/History';

export default function DataPrivacyDashboard() {
    const [data, setData] = useState({ rules: [], pendingErasure: [], recentLogs: [] });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('rules');

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/api/data-privacy/dashboard');
            setData(res.data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleProcessErasure = async (requestId, approve) => {
        const action = approve ? 'anonymize PII (preserving financial data)' : 'reject';
        if (!window.confirm(`Are you sure you want to ${action} this request?`)) return;

        try {
            await api.post('/api/data-privacy/erasure/process', { requestId, approve });
            alert('Erasure request processed.');
            fetchData();
        } catch (err) { alert('Failed to process request.'); }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Privacy" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <SecurityIcon className="text-indigo-500" /> Data Privacy & GDPR/CCPA Compliance
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    <div className="flex border-b border-gray-200 dark:border-slate-700">
                        <button onClick={() => setActiveTab('rules')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'rules' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
                            <VisibilityOffIcon fontSize="small" className="inline mr-1" /> Masking Rules
                        </button>
                        <button onClick={() => setActiveTab('erasure')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'erasure' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
                            <DeleteSweepIcon fontSize="small" className="inline mr-1" /> Erasure Requests ({data.pendingErasure.length})
                        </button>
                        <button onClick={() => setActiveTab('audit')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'audit' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
                            <HistoryIcon fontSize="small" className="inline mr-1" /> Access Audit Log
                        </button>
                    </div>

                    {activeTab === 'rules' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Field Name</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Mask Pattern</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Bypass Roles</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {loading ? (
                                        <tr><td colSpan="4" className="px-6 py-12 text-center text-gray-500">Loading...</td></tr>
                                    ) : data.rules.map(r => (
                                        <tr key={r._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4 text-sm font-mono font-bold text-gray-900 dark:text-white">{r.fieldName}</td>
                                            <td className="px-6 py-4 text-center text-sm text-gray-700 dark:text-slate-300">{r.maskPattern}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{r.bypassRoles.join(', ') || 'None'}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${r.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-800'}`}>
                                                    {r.isActive ? 'Active' : 'Disabled'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'erasure' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
                                <strong>Legal Hold Guardrail:</strong> Approving an erasure request will scrub all PII (Name, SSN, Address) but will <u>preserve</u> financial and tax aggregation data to comply with IRS 7-year retention mandates.
                            </div>
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Employee</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Request Type</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Requested</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {data.pendingErasure.length === 0 ? (
                                        <tr><td colSpan="4" className="px-6 py-12 text-center text-gray-500">No pending erasure requests.</td></tr>
                                    ) : data.pendingErasure.map(req => (
                                        <tr key={req._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{req.employeeId?.fullName}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{req.requestType}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{new Date(req.createdAt).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-center flex gap-2 justify-center">
                                                <button onClick={() => handleProcessErasure(req._id, true)} className="px-3 py-1 bg-green-600 text-white text-xs font-bold rounded hover:bg-green-700">Approve & Anonymize</button>
                                                <button onClick={() => handleProcessErasure(req._id, false)} className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded hover:bg-red-200">Reject (Legal Hold)</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'audit' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Timestamp</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">User</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Action</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Fields</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Data Masked?</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {data.recentLogs.map(log => (
                                        <tr key={log._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4 text-xs text-gray-500">{new Date(log.createdAt).toLocaleString()}</td>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{log.userId?.fullName} ({log.userRole})</td>
                                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{log.action}</td>
                                            <td className="px-6 py-4 text-xs font-mono text-gray-500">{log.fieldsAccessed.join(', ')}</td>
                                            <td className="px-6 py-4 text-center">
                                                {log.wasMasked ? (
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Yes</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">No (Unmasked)</span>
                                                )}
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
