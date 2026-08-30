/**
 * @fileoverview Department Budgets Pie Chart Widget
 * @description Pie/donut chart showing budget allocation per department.
 * Uses temporary mock data until the backend API is available.
 * Issue: #757
 */
import { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { createChartTooltip } from '../reports/chartTooltip';
import { formatCurrency } from '../../utils/currency';

// Temporary mock data — replace with API call when backend is ready
const MOCK_BUDGET_DATA = [
  { name: 'Engineering', budget: 2400000 },
  { name: 'Sales', budget: 1800000 },
  { name: 'Marketing', budget: 950000 },
  { name: 'HR', budget: 620000 },
  { name: 'Operations', budget: 780000 },
  { name: 'Finance', budget: 540000 },
  { name: 'Support', budget: 430000 },
];

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f97316', // orange
];

export default function DepartmentBudgetWidget() {
  const themeMode = useAppStore((state) => state.themeMode);
  const isDark = themeMode === 'dark';
  const [data, setData] = useState([]);

  useEffect(() => {
    // TODO: Replace with actual API call — e.g. api.get('/api/analytics/department-budgets')
    setData(MOCK_BUDGET_DATA);
  }, []);

  const currency = localStorage.getItem('currency') || 'INR';
  const totalBudget = data.reduce((sum, d) => sum + d.budget, 0);

  const tooltipContent = createChartTooltip({
    isDark,
    formatLabel: (label) => label,
    formatValue: (value) => formatCurrency(Number(value), currency),
  });

  const renderCustomLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }) => {
    if (percent < 0.06) return null; // Skip tiny slices
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontWeight={600}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Summary */}
      <div className="flex items-center gap-3 mb-3">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
          {formatCurrency(totalBudget, currency)}
        </span>
        <span className="text-xs text-gray-500 dark:text-slate-400">
          across {data.length} departments
        </span>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="budget"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="40%"
              outerRadius="72%"
              paddingAngle={2}
              label={renderCustomLabel}
              labelLine={false}
              stroke={isDark ? '#1e293b' : '#ffffff'}
              strokeWidth={2}
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={tooltipContent} />
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
