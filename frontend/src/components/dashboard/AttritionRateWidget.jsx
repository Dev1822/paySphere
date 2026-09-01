/**
 * @fileoverview Attrition Rate Widget
 * @description Displays attrition rate as a prominent KPI with a sparkline
 * trend and breakdown by reason. Uses temporary mock data.
 * Issue: #757
 */
import { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts';
import { createChartTooltip } from '../reports/chartTooltip';

// Temporary mock data — replace with API call when backend is ready
const MOCK_ATTRITION_DATA = {
  currentRate: 4.2,
  previousRate: 5.1,
  trend: [
    { month: 'Mar', rate: 5.8 },
    { month: 'Apr', rate: 5.3 },
    { month: 'May', rate: 5.1 },
    { month: 'Jun', rate: 4.9 },
    { month: 'Jul', rate: 4.5 },
    { month: 'Aug', rate: 4.2 },
  ],
  reasons: [
    { reason: 'Better opportunity', percentage: 38 },
    { reason: 'Relocation', percentage: 22 },
    { reason: 'Career change', percentage: 18 },
    { reason: 'Compensation', percentage: 14 },
    { reason: 'Other', percentage: 8 },
  ],
};

export default function AttritionRateWidget() {
  const themeMode = useAppStore((state) => state.themeMode);
  const isDark = themeMode === 'dark';
  const [data, setData] = useState(null);

  useEffect(() => {
    // TODO: Replace with actual API call — e.g. api.get('/api/analytics/attrition')
    setData(MOCK_ATTRITION_DATA);
  }, []);

  if (!data) return null;

  const isImproving = data.currentRate < data.previousRate;
  const changeAmount = Math.abs(data.currentRate - data.previousRate).toFixed(
    1,
  );

  const tooltipContent = createChartTooltip({
    isDark,
    formatLabel: (label) => label,
    formatValue: (value) => `${value}%`,
  });

  return (
    <div className="h-full flex flex-col gap-3">
      {/* KPI header row */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white leading-none">
            {data.currentRate}%
          </p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span
              className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold ${
                isImproving
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
              }`}
            >
              {isImproving ? '↓' : '↑'} {changeAmount}%
            </span>
            <span className="text-xs text-gray-500 dark:text-slate-400">
              vs last quarter
            </span>
          </div>
        </div>

        {/* Sparkline */}
        <div className="w-28 h-12">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data.trend}
              margin={{ top: 2, right: 2, left: 2, bottom: 2 }}
            >
              <defs>
                <linearGradient
                  id="attritionSparkGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor={isImproving ? '#10b981' : '#ef4444'}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor={isImproving ? '#10b981' : '#ef4444'}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="rate"
                stroke={isImproving ? '#10b981' : '#ef4444'}
                strokeWidth={2}
                fill="url(#attritionSparkGradient)"
                dot={false}
              />
              <Tooltip content={tooltipContent} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Attrition reasons breakdown */}
      <div className="flex-1 min-h-0 space-y-2 overflow-y-auto">
        <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
          Top Reasons
        </p>
        {data.reasons.map((item) => (
          <div key={item.reason} className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs text-gray-700 dark:text-slate-300 truncate">
                  {item.reason}
                </span>
                <span className="text-xs font-semibold text-gray-900 dark:text-white ml-2">
                  {item.percentage}%
                </span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${item.percentage}%`,
                    backgroundColor: isImproving ? '#10b981' : '#ef4444',
                    opacity: 0.4 + (item.percentage / 100) * 0.6,
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
