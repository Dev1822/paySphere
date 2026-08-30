/**
 * @fileoverview Salary Distribution Histogram Widget
 * @description Bar chart (histogram) showing the distribution of employees
 * across salary ranges. Uses temporary mock data.
 * Issue: #757
 */
import { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { createChartTooltip } from '../reports/chartTooltip';

// Temporary mock data — replace with API call when backend is ready
const MOCK_SALARY_DISTRIBUTION = [
  { range: '0–25K', count: 12, color: '#6366f1' },
  { range: '25–50K', count: 34, color: '#818cf8' },
  { range: '50–75K', count: 56, color: '#a78bfa' },
  { range: '75–100K', count: 42, color: '#c084fc' },
  { range: '100–125K', count: 28, color: '#e879f9' },
  { range: '125–150K', count: 18, color: '#f472b6' },
  { range: '150K+', count: 14, color: '#fb7185' },
];

export default function SalaryDistributionWidget() {
  const themeMode = useAppStore((state) => state.themeMode);
  const isDark = themeMode === 'dark';
  const [data, setData] = useState([]);

  useEffect(() => {
    // TODO: Replace with actual API call — e.g. api.get('/api/analytics/salary-distribution')
    setData(MOCK_SALARY_DISTRIBUTION);
  }, []);

  const tooltipContent = createChartTooltip({
    isDark,
    formatLabel: (label) => `Salary Range: ${label}`,
    formatValue: (value) => `${value} employees`,
  });

  const totalEmployees = data.reduce((sum, d) => sum + d.count, 0);
  const peakRange = data.reduce((max, d) => (d.count > max.count ? d : max), {
    count: 0,
  });

  return (
    <div className="h-full flex flex-col">
      {/* Summary badges */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400">
          {totalEmployees} total
        </span>
        <span className="text-xs text-gray-500 dark:text-slate-400">
          Peak: {peakRange.range} ({peakRange.count} employees)
        </span>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke={isDark ? '#334155' : '#e5e7eb'}
              opacity={0.5}
            />
            <XAxis
              dataKey="range"
              axisLine={false}
              tickLine={false}
              tick={{ fill: isDark ? '#94a3b8' : '#6b7280', fontSize: 11 }}
              dy={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: isDark ? '#94a3b8' : '#6b7280', fontSize: 11 }}
              label={{
                value: 'Employees',
                angle: -90,
                position: 'insideLeft',
                style: { fill: isDark ? '#94a3b8' : '#6b7280', fontSize: 11 },
              }}
            />
            <Tooltip
              cursor={{
                fill: isDark
                  ? 'rgba(30, 41, 59, 0.25)'
                  : 'rgba(148, 163, 184, 0.16)',
              }}
              content={tooltipContent}
            />
            <Bar
              dataKey="count"
              name="Employees"
              radius={[6, 6, 0, 0]}
              maxBarSize={48}
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
