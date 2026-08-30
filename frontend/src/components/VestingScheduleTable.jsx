import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

/**
 * @fileoverview Vesting Schedule Table Component
 * @description Displays upcoming vesting events and their blackout status.
 * Issue: #2010
 */
export default function VestingScheduleTable({ vestings, loading }) {
    const getStatusBadge = (status) => {
        if (status === 'Executed') return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
        if (status === 'Blocked (Blackout)') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                <thead className="bg-gray-50 dark:bg-slate-900/50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Employee</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Vesting Date</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Shares</th>
                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                    {loading ? (
                        <tr><td colSpan="4" className="px-6 py-12 text-center text-gray-500">Loading vesting schedule...</td></tr>
                    ) : vestings.length === 0 ? (
                        <tr><td colSpan="4" className="px-6 py-12 text-center text-gray-500">No upcoming vesting events.</td></tr>
                    ) : vestings.map(v => (
                        <tr key={v._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{v.employeeId?.fullName}</td>
                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{new Date(v.vestingDate).toLocaleDateString()}</td>
                            <td className="px-6 py-4 text-sm text-right font-mono font-bold text-gray-900 dark:text-white">{v.sharesVested}</td>
                            <td className="px-6 py-4 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 justify-center ${getStatusBadge(v.status)}`}>
                                    {v.status === 'Executed' ? <CheckCircleIcon fontSize="small" /> : v.status === 'Blocked (Blackout)' ? <BlockIcon fontSize="small" /> : null}
                                    {v.status}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
