import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import SecurityIcon from '@mui/icons-material/Security';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HistoryIcon from '@mui/icons-material/History';

export default function ChangeApprovalDashboard() {
    const [data, setData] = useState({ myApprovals: [], recentHistory: [] });
    const [loading, setLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [auditTrail, setAuditTrail] = useState([]);
    const [activeTab, setActiveTab] = useState('pending');
    const [comments, setComments] = useState('');

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/api/change-control/dashboard');
            setData(res.data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const fetchAudit = async (requestId) => {
        try {
            const res = await api.get(`/api/change-control/audit/${requestId}`);
            setAuditTrail(res.data.logs);
        } catch (err) { console.error(err); }
    };

    const handleSelect = (workflow) => {
        setSelectedRequest(workflow.requestId);
        fetchAudit(workflow.requestId._id);
    };

    const handleAction = async (action) => {
        if (!selectedRequest) return;
        const endpoint = action === 'approve' ? '/api/change-control/approve' : '/api/change-control/reject';
        try {
            await api.post(endpoint, { requestId: selectedRequest._id, comments });
            alert(`Change ${action}d successfully.`);
            setSelectedRequest(null);
            setComments('');
            fetchData();
        } catch (err) { alert(err.response?.data?.message || 'Action failed. SOX violation detected.'); }
    };

    const getRiskColor = (risk) => {
        if (risk === 'High') return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
        if (risk === 'Medium') return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20';
        return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="SOXControl" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <SecurityIcon className="text-indigo-500" /> SOX Change Control & Audit
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    <div className="flex border-b border-gray-200 dark:border-slate-700">
                        <button onClick={() => setActiveTab('pending')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'pending' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
                            Pending My Approval ({data.myApprovals.length})
                        </button>
                        <button onClick={() => setActiveTab('history')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'history' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
                            Recent History
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            {activeTab === 'pending' ? (
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                    <thead className="bg-gray-50 dark:bg-slate-900/50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Employee</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Change Type</th>
                                            <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-500">Risk</th>
                                            <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-500">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                        {loading ? (
                                            <tr><td colSpan="4" className="px-4 py-12 text-center text-gray-500">Loading...</td></tr>
                                        ) : data.myApprovals.map(w => (
                                            <tr key={w._id} onClick={() => handleSelect(w)} className={`hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer ${selectedRequest?._id === w.requestId._id ? 'bg-brand-50 dark:bg-brand-900/20' : ''}`}>
                                                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{w.requestId.employeeId?.fullName}</td>
                                                <td className="px-4 py-3 text-sm text-gray-700 dark:text-slate-300">{w.requestId.changeType} ({w.requestId.fieldName})</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${getRiskColor(w.requestId.riskScore)}`}>{w.requestId.riskScore}</span>
                                                </td>
                                                <td className="px-4 py-3 text-center text-xs text-gray-500">Review</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                    <thead className="bg-gray-50 dark:bg-slate-900/50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Date</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Employee</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Change</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Maker</th>
                                            <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-500">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                        {data.recentHistory.map(r => (
                                            <tr key={r._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                                <td className="px-4 py-3 text-xs text-gray-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                                                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{r.employeeId?.fullName}</td>
                                                <td className="px-4 py-3 text-sm text-gray-700 dark:text-slate-300">{r.changeType}</td>
                                                <td className="px-4 py-3 text-sm text-gray-700 dark:text-slate-300">{r.requestedBy?.fullName}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${r.status === 'Approved' ? 'bg-green-100 text-green-800' : r.status === 'Rejected' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>{r.status}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 min-h-[400px]">
                            {!selectedRequest ? (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-slate-500">
                                    <SecurityIcon fontSize="large" />
                                    <p className="mt-2 text-sm text-center">Select a pending request to inspect the before/after diff and audit trail.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Change Diff</h3>
                                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                        <p className="text-xs font-bold text-red-800 dark:text-red-200 uppercase">Before</p>
                                        <p className="text-sm font-mono text-red-700 dark:text-red-300 break-all">{JSON.stringify(selectedRequest.beforeValue)}</p>
                                    </div>
                                    <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                        <p className="text-xs font-bold text-green-800 dark:text-green-200 uppercase">After</p>
                                        <p className="text-sm font-mono text-green-700 dark:text-green-300 break-all">{JSON.stringify(selectedRequest.afterValue)}</p>
                                    </div>
                                    <div className="p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg">
                                        <p className="text-xs font-bold text-gray-500 uppercase">Reason</p>
                                        <p className="text-sm text-gray-700 dark:text-slate-300">{selectedRequest.reason}</p>
                                    </div>

                                    <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
                                        <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-1"><HistoryIcon fontSize="small" /> Audit Trail</h4>
                                        <div className="space-y-2 max-h-40 overflow-y-auto">
                                            {auditTrail.map(log => (
                                                <div key={log._id} className="text-xs">
                                                    <span className="font-bold text-gray-700 dark:text-slate-300">{log.action}</span> by {log.userId?.fullName} <span className="text-gray-400">({new Date(log.createdAt).toLocaleString()})</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="border-t border-gray-200 dark:border-slate-700 pt-4 space-y-2">
                                        <textarea placeholder="Approver comments (required for SOX audit)..." value={comments} onChange={e => setComments(e.target.value)} rows="2" className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white text-sm" />
                                        <div className="grid grid-cols-2 gap-2">
                                            <button onClick={() => handleAction('reject')} className="py-2 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded-lg font-bold hover:bg-red-200 flex items-center justify-center gap-1">
                                                <CancelIcon fontSize="small" /> Reject
                                            </button>
                                            <button onClick={() => handleAction('approve')} className="py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 flex items-center justify-center gap-1">
                                                <CheckCircleIcon fontSize="small" /> Approve
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
