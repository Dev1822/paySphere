/**
 * @fileoverview Employee Growth Over Time Widget
 * @description Line chart showing employee headcount growth month-over-month.
 * Uses temporary mock data until the backend API is available.
 * Issue: #757
 */
import { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { createChartTooltip } from '../reports/chartTooltip';

// Temporary mock data — replace with API call when backend is ready
const MOCK_GROWTH_DATA = [
  { month: 'Sep 2025', employees: 142 },
  { month: 'Oct 2025', employees: 148 },
  { month: 'Nov 2025', employees: 153 },
  { month: 'Dec 2025', employees: 151 },
  { month: 'Jan 2026', employees: 158 },
  { month: 'Feb 2026', employees: 165 },
  { month: 'Mar 2026', employees: 172 },
  { month: 'Apr 2026', employees: 178 },
  { month: 'May 2026', employees: 183 },
  { month: 'Jun 2026', employees: 190 },
  { month: 'Jul 2026', employees: 195 },
  { month: 'Aug 2026', employees: 204 },
];

export default function EmployeeGrowthWidget() {
  const themeMode = useAppStore((state) => state.themeMode);
  const isDark = themeMode === 'dark';
  const [data, setData] = useState([]);

  useEffect(() => {
    // TODO: Replace with actual API call — e.g. api.get('/api/analytics/employee-growth')
    setData(MOCK_GROWTH_DATA);
  }, []);

  const tooltipContent = createChartTooltip({
    isDark,
    formatLabel: (label) => label,
    formatValue: (value) => `${value} employees`,
  });

  const netChange =
    data.length >= 2 ? data[data.length - 1].employees - data[0].employees : 0;
  const percentGrowth =
    data.length >= 2
      ? (
          ((data[data.length - 1].employees - data[0].employees) /
            data[0].employees) *
          100
        ).toFixed(1)
      : 0;

  return (
    <div className="h-full flex flex-col">
      {/* Summary badge */}
      <div className="flex items-center gap-3 mb-3">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
          ↑ {percentGrowth}%
        </span>
        <span className="text-xs text-gray-500 dark:text-slate-400">
          +{netChange} employees in 12 months
        </span>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
          >
            <defs>
              <linearGradient
                id="employeeGrowthGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke={isDark ? '#334155' : '#e5e7eb'}
              opacity={0.5}
            />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: isDark ? '#94a3b8' : '#6b7280', fontSize: 11 }}
              dy={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: isDark ? '#94a3b8' : '#6b7280', fontSize: 11 }}
              domain={['dataMin - 10', 'dataMax + 10']}
            />
            <Tooltip
              cursor={{
                stroke: isDark ? '#475569' : '#d1d5db',
                strokeWidth: 1,
              }}
              content={tooltipContent}
            />
            <Area
              type="monotone"
              dataKey="employees"
              name="Headcount"
              stroke="#10b981"
              strokeWidth={2.5}
              fill="url(#employeeGrowthGradient)"
              dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }}
              activeDot={{
                r: 5,
                fill: '#10b981',
                stroke: '#fff',
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
