import React from 'react';
import { format, differenceInDays } from 'date-fns';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';

export default function ProbationTimeline({ tracker }) {
  if (!tracker) return null;

  const startDate = new Date(tracker.startDate);
  const endDate = new Date(tracker.endDate);
  const today = new Date();

  const totalDays = differenceInDays(endDate, startDate);
  const daysPassed = Math.max(0, differenceInDays(today, startDate));
  const progressPercent = Math.min(
    100,
    Math.round((daysPassed / totalDays) * 100),
  );

  const getStatusColor = () => {
    if (tracker.status === 'confirmed')
      return 'text-green-600 bg-green-50 border-green-200';
    if (tracker.status === 'terminated')
      return 'text-red-600 bg-red-50 border-red-200';
    if (tracker.status === 'extended')
      return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-blue-600 bg-blue-50 border-blue-200';
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold text-gray-800">
          Probation Journey
        </h3>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium border uppercase ${getStatusColor()}`}
        >
          {tracker.status}
        </span>
      </div>

      <div className="relative pt-4 pb-8">
        {/* Progress bar background */}
        <div className="h-2 bg-gray-100 rounded-full w-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              tracker.status === 'confirmed' ? 'bg-green-500' : 'bg-indigo-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="absolute top-0 w-full flex justify-between transform -translate-y-1/2 text-xs font-medium text-gray-500">
          <div className="flex flex-col items-center">
            <div className="w-4 h-4 rounded-full bg-indigo-600 ring-4 ring-white mb-1" />
            <span>Started</span>
            <span className="text-gray-900">
              {format(startDate, 'MMM d, yyyy')}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <div
              className={`w-4 h-4 rounded-full ring-4 ring-white mb-1 ${progressPercent >= 100 ? 'bg-indigo-600' : 'bg-gray-300'}`}
            />
            <span>End Date</span>
            <span className="text-gray-900">
              {format(endDate, 'MMM d, yyyy')}
            </span>
          </div>
        </div>
      </div>

      {tracker.reviews && tracker.reviews.length > 0 && (
        <div className="mt-8 border-t border-gray-100 pt-6">
          <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
            Review History
          </h4>
          <div className="space-y-4">
            {tracker.reviews.map((rev, i) => (
              <div key={i} className="flex space-x-3">
                <div className="mt-1">
                  {rev.recommendation === 'confirm' && (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  )}
                  {rev.recommendation === 'extend' && (
                    <Clock className="w-5 h-5 text-amber-500" />
                  )}
                  {rev.recommendation === 'terminate' && (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Manager recommended to{' '}
                    <span className="uppercase">{rev.recommendation}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {format(new Date(rev.reviewDate), 'MMM d, yyyy h:mm a')}
                  </p>
                  <p className="text-sm text-gray-600 mt-1 italic">
                    "{rev.notes}"
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
