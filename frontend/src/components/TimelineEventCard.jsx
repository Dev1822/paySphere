import { useState } from 'react';
import { formatDistanceToNow, format } from 'date-fns';

const CATEGORY_STYLES = {
  Compensation: {
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-100 dark:bg-green-900/30',
  },
  Role: {
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
  },
  Performance: {
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-100 dark:bg-purple-900/30',
  },
  Milestones: {
    color: 'text-yellow-600 dark:text-yellow-400',
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
  },
  Other: {
    color: 'text-gray-600 dark:text-gray-400',
    bg: 'bg-gray-100 dark:bg-gray-800',
  },
};

const getEventIcon = (eventType) => {
  switch (eventType) {
    case 'HIRED':
      return '🎉';
    case 'DEPARTMENT_TRANSFERRED':
      return '🔄';
    case 'ROLE_CHANGED':
      return '💼';
    case 'SALARY_CHANGED':
      return '💰';
    case 'APPRAISAL_COMPLETED':
      return '📈';
    case 'WORK_ANNIVERSARY':
      return '🎂';
    case 'TENURE_MILESTONE':
      return '🏆';
    case 'WARNING':
      return '⚠️';
    case 'TERMINATED':
      return '⛔';
    default:
      return '📝';
  }
};

const formatValue = (val) => {
  if (typeof val === 'object' && val !== null) {
    return JSON.stringify(val);
  }
  return String(val);
};

export default function TimelineEventCard({ event }) {
  const [expanded, setExpanded] = useState(false);
  const style = CATEGORY_STYLES[event.category] || CATEGORY_STYLES.Other;

  const hasChanges = event.previousValues || event.newValues;

  return (
    <div className="relative pl-8 sm:pl-32 py-6 group">
      {/* Timeline line & dot */}
      <div className="sm:hidden absolute left-0 top-0 bottom-0 w-px bg-gray-200 dark:bg-slate-800 transform translate-x-3.5 group-last:bg-transparent" />
      <div className="hidden sm:block absolute left-24 top-0 bottom-0 w-px bg-gray-200 dark:bg-slate-800 group-last:bg-transparent" />

      <div
        className={`absolute left-0 sm:left-[5.5rem] top-6 w-7 h-7 rounded-full border-4 border-white dark:border-slate-950 flex items-center justify-center text-xs shadow-sm ${style.bg} ${style.color}`}
      >
        {getEventIcon(event.eventType)}
      </div>

      {/* Date (Left side on desktop) */}
      <div className="hidden sm:block absolute left-0 top-6 w-20 text-right pr-4">
        <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
          {format(new Date(event.occurredAt), 'MMM d')}
        </div>
        <div className="text-xs text-gray-500 dark:text-slate-400">
          {format(new Date(event.occurredAt), 'yyyy')}
        </div>
      </div>

      {/* Card Content */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4 shadow-sm hover:shadow-md transition">
        <div className="flex justify-between items-start mb-2">
          <div>
            <div className="sm:hidden text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1">
              {format(new Date(event.occurredAt), 'MMM d, yyyy')}
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white capitalize">
              {event.eventType.replace(/_/g, ' ').toLowerCase()}
            </h3>
            <span
              className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider ${style.bg} ${style.color}`}
            >
              {event.category}
            </span>
          </div>
          <div className="text-xs text-gray-500 dark:text-slate-400 text-right">
            {formatDistanceToNow(new Date(event.occurredAt), {
              addSuffix: true,
            })}
            {event.recordedBy && (
              <div className="mt-1">
                by {event.recordedBy.fullName || 'System'}
              </div>
            )}
          </div>
        </div>

        {event.note && (
          <p className="text-sm text-gray-600 dark:text-slate-300 mt-3 bg-gray-50 dark:bg-slate-800/50 p-3 rounded-lg">
            "{event.note}"
          </p>
        )}

        {hasChanges && (
          <div className="mt-3">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline focus:outline-none"
            >
              {expanded ? 'Hide Details' : 'View Changes'}
            </button>

            {expanded && (
              <div className="mt-3 grid grid-cols-2 gap-4 text-sm bg-slate-50 dark:bg-slate-800/30 p-3 rounded-lg border border-gray-100 dark:border-slate-700/50">
                <div>
                  <div className="text-xs text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wide mb-1">
                    Previous
                  </div>
                  {event.previousValues &&
                    Object.entries(event.previousValues).map(([k, v]) => (
                      <div key={k} className="mb-1">
                        <span className="text-gray-600 dark:text-slate-300 capitalize">
                          {k}:
                        </span>{' '}
                        <span className="font-mono text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-1 py-0.5 rounded line-through">
                          {formatValue(v)}
                        </span>
                      </div>
                    ))}
                  {!event.previousValues ||
                    (Object.keys(event.previousValues).length === 0 && (
                      <span className="text-gray-400 italic">None</span>
                    ))}
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wide mb-1">
                    New
                  </div>
                  {event.newValues &&
                    Object.entries(event.newValues).map(([k, v]) => (
                      <div key={k} className="mb-1">
                        <span className="text-gray-600 dark:text-slate-300 capitalize">
                          {k}:
                        </span>{' '}
                        <span className="font-mono text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-1 py-0.5 rounded">
                          {formatValue(v)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
