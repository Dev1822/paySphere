import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import ShieldIcon from '@mui/icons-material/Shield';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AddIcon from '@mui/icons-material/Add';

export default function OSHAComplianceDashboard() {
    const [data, setData] = useState({ recentIncidents: [], ledger: null, overdueAlerts: [] });
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        employeeId: '', incidentDate: new Date().toISOString().split('T')[0], description: '',
        location: '', isWorkRelated: true, severity: 'First Aid Only', daysAway: 0, daysRestricted: 0
    });

    useEffect(() => { fetchDashboard(); }, []);

    const fetchDashboard = async () => {
        try {
            const res = await api.get('/api/safety/dashboard');
            setData(res.data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleLogIncident = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/api/safety/log', formData);
            alert('Incident logged.');
            if (res.data.reportingCheck.requiresReporting) {
                alert(`WARNING: This incident requires immediate OSHA reporting within ${res.data.reportingCheck.deadlineHours} hours!`);
            }
            setShowForm(false);
            fetchDashboard();
        } catch (err) { alert('Failed to log incident.'); }
    };

    const handleGenerate300A = async () => {
        const year = new Date().getFullYear() - 1;
        const hours = prompt(`Enter total hours worked by all employees in ${year}:`, '200000');
        if (!hours) return;
        try {
            await api.post('/api/safety/generate-300a', { year, totalHoursWorked: Number(hours) });
            alert('OSHA 300A Summary generated!');
            fetchDashboard();
        } catch (err) { alert('Generation failed.'); }
    };

    const getSeverityColor = (severity) => {
        if (severity === 'Fatality') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
        if (severity.includes('Amputation') || severity.includes('Hospitalization')) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
        if (severity === 'Medical Treatment') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Safety" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <ShieldIcon className="text-red-500" /> OSHA 300 Log & Workplace Safety
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    {data.overdueAlerts.length > 0 && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-xl flex items-start gap-3 animate-pulse">
                            <WarningAmberIcon className="text-red-600 dark:text-red-400 mt-0.5" />
                            <div>
                                <h3 className="text-sm font-bold text-red-800 dark:text-red-200">COMPLIANCE ALERT: Overdue OSHA Reports</h3>
                                <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                                    {data.overdueAlerts.length} incident(s) have missed their 8-hour or 24-hour federal reporting deadlines. Immediate action required to avoid regulatory fines.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
                            <p className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase">YTD Recordable Cases</p>
                            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{data.ledger?.totalRecordableCases || 0}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
                            <p className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase">YTD DART Cases</p>
                            <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-2">{data.ledger?.totalDARTCases || 0}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
                            <p className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase">Current DART Rate</p>
                            <p className="text-3xl font-bold text-brand-600 dark:text-brand-400 mt-2">{data.ledger?.dartRate || 0.0}</p>
                            <p className="text-xs text-gray-500 mt-1">Per 100 FTEs</p>
                        </div>
                    </div>

                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Recent Incident Log</h2>
                        <div className="flex gap-2">
                            <button onClick={handleGenerate300A} className="px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-white rounded-lg font-semibold hover:bg-gray-200 dark:hover:bg-slate-600 flex items-center gap-2">
                                <AssessmentIcon fontSize="small" /> Generate 300A Summary
                            </button>
                            <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 flex items-center gap-2">
                                <AddIcon fontSize="small" /> Log Incident
                            </button>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                            <thead className="bg-gray-50 dark:bg-slate-900/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Employee</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Severity</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Recordable</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">DART</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                {loading ? (
                                    <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-500">Loading...</td></tr>
                                ) : data.recentIncidents.map(inc => (
                                    <tr key={inc._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                        <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{new Date(inc.incidentDate).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{inc.employeeId?.fullName}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${getSeverityColor(inc.severity)}`}>{inc.severity}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {inc.isRecordable ? <span className="text-red-600 font-bold">Yes</span> : <span className="text-gray-400">No</span>}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {inc.isDART ? <span className="text-amber-600 font-bold">Yes</span> : <span className="text-gray-400">No</span>}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">{inc.status}</span>
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
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Log Workplace Incident</h2>
                        <form onSubmit={handleLogIncident} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Employee ID</label>
                                    <input type="text" value={formData.employeeId} onChange={e => setFormData({ ...formData, employeeId: e.target.value })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Date</label>
                                    <input type="date" value={formData.incidentDate} onChange={e => setFormData({ ...formData, incidentDate: e.target.value })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Description</label>
                                <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} required rows="3" className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Severity</label>
                                <select value={formData.severity} onChange={e => setFormData({ ...formData, severity: e.target.value })} className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white">
                                    <option>Fatality</option>
                                    <option>Amputation/Loss of Eye</option>
                                    <option>In-Patient Hospitalization</option>
                                    <option>Medical Treatment</option>
                                    <option>First Aid Only</option>
                                    <option>Near Miss</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" checked={formData.isWorkRelated} onChange={e => setFormData({ ...formData, isWorkRelated: e.target.checked })} className="rounded text-brand-600" id="workRelated" />
                                <label htmlFor="workRelated" className="text-sm text-gray-700 dark:text-slate-300">Work-Related Incident</label>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 dark:text-slate-400">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700">Log Incident</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
