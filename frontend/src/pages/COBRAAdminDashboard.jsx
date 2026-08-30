import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AddIcon from '@mui/icons-material/Add';
import SendIcon from '@mui/icons-material/Send';

export default function COBRAAdminDashboard() {
    const [data, setData] = useState({ events: [], elections: [], unpaidLedgers: [], overdueNotices: 0 });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('events');
    const [showForm, setShowForm] = useState(false);
    const [eventForm, setEventForm] = useState({ employeeId: '', eventType: 'Termination', eventDate: '', coverageEndDate: '', baseMonthlyPremium: 0 });

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/api/cobra/dashboard');
            setData(res.data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleLogEvent = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/cobra/events', eventForm);
            alert('Qualifying event logged.');
            setShowForm(false);
            fetchData();
        } catch (err) { alert(err.response?.data?.message || 'Failed to log event.'); }
    };

    const handleSendNotice = async (eventId) => {
        if (!window.confirm('Confirm COBRA election notice has been mailed/sent to the participant?')) return;
        try {
            await api.patch(`/api/cobra/events/${eventId}/notice`);
            alert('Notice dispatched and ERISA deadline tracked.');
            fetchData();
        } catch (err) { alert('Failed to update notice status.'); }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="COBRA" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <HealthAndSafetyIcon className="text-blue-500" /> COBRA Administration & Billing
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    {data.overdueNotices > 0 && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-xl flex items-start gap-3 animate-pulse">
                            <WarningAmberIcon className="text-red-600 dark:text-red-400 mt-0.5" />
                            <div>
                                <h3 className="text-sm font-bold text-red-800 dark:text-red-200">ERISA COMPLIANCE ALERT</h3>
                                <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                                    {data.overdueNotices} qualifying event(s) have missed the 14-day employer notice deadline. Immediate action required to avoid DOL penalties.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-between items-center">
                        <div className="flex border-b border-gray-200 dark:border-slate-700">
                            <button onClick={() => setActiveTab('events')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'events' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>Qualifying Events</button>
                            <button onClick={() => setActiveTab('billing')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'billing' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>Unpaid Premiums</button>
                        </div>
                        {activeTab === 'events' && (
                            <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 flex items-center gap-2">
                                <AddIcon fontSize="small" /> Log Event
                            </button>
                        )}
                    </div>

                    {activeTab === 'events' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Employee</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Event Type</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Event Date</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Status</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {loading ? (
                                        <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-500">Loading...</td></tr>
                                    ) : data.events.map(ev => (
                                        <tr key={ev._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{ev.employeeId?.fullName}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{ev.eventType}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{new Date(ev.eventDate).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${ev.isNoticeOverdue ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                                                    {ev.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {ev.status === 'Pending Notice' && (
                                                    <button onClick={() => handleSendNotice(ev._id)} className="text-xs font-bold text-brand-600 hover:underline flex items-center gap-1 mx-auto">
                                                        <SendIcon fontSize="small" /> Send Notice
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'billing' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Participant</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Coverage Month</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Amount Due</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Grace Period Ends</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {data.unpaidLedgers.map(l => (
                                        <tr key={l._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{l.electionId?.eventId?.employeeId?.fullName}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{l.coverageMonth}/{l.coverageYear}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono text-gray-900 dark:text-white">${l.amountDue.toFixed(2)}</td>
                                            <td className="px-6 py-4 text-sm text-right text-gray-700 dark:text-slate-300">{new Date(l.gracePeriodEndDate).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${l.status === 'Grace Period' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>{l.status}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {showForm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-md p-6">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Log Qualifying Event</h2>
                        <form onSubmit={handleLogEvent} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Employee ID</label>
                                <input type="text" value={eventForm.employeeId} onChange={e => setEventForm({ ...eventForm, employeeId: e.target.value })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Event Type</label>
                                <select value={eventForm.eventType} onChange={e => setEventForm({ ...eventForm, eventType: e.target.value })} className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white">
                                    <option>Termination</option><option>ReductionInHours</option><option>Divorce</option><option>Death</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Event Date</label>
                                    <input type="date" value={eventForm.eventDate} onChange={e => setEventForm({ ...eventForm, eventDate: e.target.value })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Coverage Ends</label>
                                    <input type="date" value={eventForm.coverageEndDate} onChange={e => setEventForm({ ...eventForm, coverageEndDate: e.target.value })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Base Monthly Premium ($)</label>
                                <input type="number" step="0.01" value={eventForm.baseMonthlyPremium} onChange={e => setEventForm({ ...eventForm, baseMonthlyPremium: Number(e.target.value) })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 dark:text-slate-400">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700">Log Event</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
