import { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import { formatDateTime, formatCurrency } from '../utils/formatLocale';
import TimerIcon from '@mui/icons-material/Timer';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import FlagIcon from '@mui/icons-material/Flag';

export default function TimesheetTracker() {
    const [activeTimer, setActiveTimer] = useState(null);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [recentEntries, setRecentEntries] = useState([]);
    const intervalRef = useRef(null);

    useEffect(() => {
        fetchActiveTimer();
        fetchRecentEntries();
        return () => clearInterval(intervalRef.current);
    }, []);

    const fetchActiveTimer = async () => {
        try {
            // Mocking fetch for active timer
            // const res = await api.get('/api/timesheets/active');
            // setActiveTimer(res.data.entry);
        } catch (err) { console.error(err); }
    };

    const fetchRecentEntries = async () => {
        try {
            // Mocking recent entries
            setRecentEntries([
                { _id: '1', startTime: new Date(Date.now() - 3600000), durationMinutes: 120, billableAmount: 1000, status: 'Approved', description: 'Frontend bug fixes', isFlagged: false },
                { _id: '2', startTime: new Date(Date.now() - 86400000), durationMinutes: 45, billableAmount: 375, status: 'Pending Approval', description: 'Client meeting', isFlagged: true, flagReason: 'Duration too short' }
            ]);
        } catch (err) { console.error(err); }
    };

    const handleStart = async () => {
        try {
            const res = await api.post('/api/timesheets/start', { description: 'General Development' });
            setActiveTimer(res.data.entry);
            setElapsedSeconds(0);

            intervalRef.current = setInterval(() => {
                setElapsedSeconds(prev => prev + 1);
            }, 1000);
        } catch (err) { alert(err.response?.data?.message || 'Failed to start timer'); }
    };

    const handleStop = async () => {
        try {
            clearInterval(intervalRef.current);
            await api.post('/api/timesheets/stop');
            setActiveTimer(null);
            setElapsedSeconds(0);
            fetchRecentEntries();
        } catch (err) { alert('Failed to stop timer'); }
    };

    const formatTime = (totalSeconds) => {
        const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
        const s = (totalSeconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Timesheets" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <TimerIcon /> Gig-Worker Timesheet Tracker
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6">
                    {/* Timer Widget */}
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-lg text-center">
                        <p className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                            {activeTimer ? 'Currently Tracking' : 'Ready to Track'}
                        </p>
                        <h2 className="text-5xl font-mono font-bold text-gray-900 dark:text-white mb-6">
                            {activeTimer ? formatTime(elapsedSeconds) : '00:00:00'}
                        </h2>

                        {activeTimer ? (
                            <button onClick={handleStop} className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-lg shadow-md flex items-center gap-2 mx-auto transition">
                                <StopIcon /> Stop Timer
                            </button>
                        ) : (
                            <button onClick={handleStart} className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-lg shadow-md flex items-center gap-2 mx-auto transition">
                                <PlayArrowIcon /> Start Timer
                            </button>
                        )}
                    </div>

                    {/* Recent Entries */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Recent Time Logs</h3>
                        </div>
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                            <thead className="bg-gray-50 dark:bg-slate-900/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Date & Description</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Duration</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Billable</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                {recentEntries.map(entry => (
                                    <tr key={entry._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                {entry.isFlagged && <FlagIcon className="text-amber-500" fontSize="small" titleAccess={entry.flagReason} />}
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white">{entry.description}</p>
                                                    <p className="text-xs text-gray-500 dark:text-slate-400">{formatDateTime(entry.startTime)}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm font-mono text-gray-700 dark:text-slate-300">
                                            {Math.floor(entry.durationMinutes / 60)}h {entry.durationMinutes % 60}m
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm font-mono font-bold text-gray-900 dark:text-white">
                                            {formatCurrency(entry.billableAmount || 0, 'INR')}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${entry.status === 'Approved' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                                                    entry.status === 'Pending Approval' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' :
                                                        'bg-red-100 text-red-800'
                                                }`}>
                                                {entry.status}
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
