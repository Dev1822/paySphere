import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import TimerIcon from '@mui/icons-material/Timer';
import { formatDate } from '../utils/formatLocale';

export default function ShiftBiddingCard({ shift, onBid, isManager }) {
  const dateStr = formatDate(shift.date, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const [timeLeft, setTimeLeft] = useState(shift.nextUpdateInSeconds || 60);

  useEffect(() => {
    setTimeLeft(shift.nextUpdateInSeconds || 60);
  }, [shift.nextUpdateInSeconds]);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
          {shift.shiftTemplateId?.name || 'Open Shift'}
        </span>
        <div className="flex flex-col items-end">
          {shift.premiumMultiplier > 1 && (
            <span className="flex items-center gap-1 text-xs font-bold text-green-600 dark:text-green-400 animate-pulse">
              <AttachMoneyIcon fontSize="small" /> {shift.premiumMultiplier}x
              Pay
            </span>
          )}
          <span className="flex items-center gap-1 text-xs font-medium text-orange-500 dark:text-orange-400 mt-1">
            <TimerIcon fontSize="small" /> Surge in {Math.max(0, timeLeft)}s
          </span>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
          {dateStr}
        </h3>
        <div className="flex items-center gap-2 mt-1 text-sm text-gray-600 dark:text-slate-400">
          <AccessTimeIcon fontSize="small" />
          <span>
            {shift.startTime} - {shift.endTime}
          </span>
        </div>
        {shift.requiredDepartment && (
          <div className="flex items-center gap-2 mt-1 text-sm text-gray-600 dark:text-slate-400">
            <LocationOnIcon fontSize="small" />
            <span>
              {shift.requiredDepartment}{' '}
              {shift.requiredRole ? `• ${shift.requiredRole}` : ''}
            </span>
          </div>
        )}
      </div>

      <p className="text-sm text-gray-500 dark:text-slate-500 italic flex-1">
        "{shift.reason}"
      </p>

      {!isManager && (
        <button
          onClick={() => onBid(shift._id)}
          className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg transition-colors"
        >
          Claim Shift
        </button>
      )}

      {isManager && (
        <button
          onClick={() => onBid(shift._id)}
          className="w-full py-2.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-800 dark:text-white font-semibold rounded-lg transition-colors"
        >
          Auto-Assign Best Bid
        </button>
      )}
    </div>
  );
}

ShiftBiddingCard.propTypes = {
  shift: PropTypes.object.isRequired,
  onBid: PropTypes.func.isRequired,
  isManager: PropTypes.bool,
};
