import { useState, useEffect } from 'react';
import api from '../services/api';
import TimelineEventCard from './TimelineEventCard';
import { useTranslation } from 'react-i18next';

const CATEGORIES = [
  'All',
  'Compensation',
  'Role',
  'Milestones',
  'Performance',
  'Other',
];

export default function EmployeeTimeline({ employeeId }) {
  const { t } = useTranslation();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchTimeline = async (reset = false) => {
    try {
      const currentPage = reset ? 1 : page;
      const res = await api.get(`/api/employees/${employeeId}/timeline`, {
        params: {
          page: currentPage,
          limit: 10,
          category: category !== 'All' ? category : undefined,
          isVisible: true,
        },
      });

      const newEvents = res.data.events;
      if (reset) {
        setEvents(newEvents);
      } else {
        setEvents((prev) => [...prev, ...newEvents]);
      }

      setHasMore(currentPage < res.data.pagination.totalPages);
      setPage(currentPage + 1);
    } catch (err) {
      console.error('Failed to fetch timeline:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchTimeline(true);
  }, [employeeId, category]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {t('timeline.title', 'My Journey')}
          </h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            A chronological timeline of your journey here.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full transition ${
                category === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        {events.length === 0 && !loading ? (
          <div className="text-center py-12 text-gray-500 dark:text-slate-400">
            No events found for this category.
          </div>
        ) : (
          events.map((event) => (
            <TimelineEventCard key={event._id} event={event} />
          ))
        )}

        {loading && (
          <div className="py-8 flex justify-center">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        )}

        {!loading && hasMore && (
          <div className="mt-8 text-center">
            <button
              onClick={() => fetchTimeline(false)}
              className="px-4 py-2 text-sm font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition"
            >
              Load More
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
