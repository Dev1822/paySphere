/**
 * @fileoverview Widget Registry
 * @description Maps widget IDs to their React components and default grid dimensions.
 * Issue: #932, #757
 */
import DepartmentChart from '../reports/DepartmentChart';
import OvertimeChart from '../reports/OvertimeChart';
import PayrollTrendChart from '../reports/PayrollTrendChart';
import SummaryCards from '../reports/SummaryCards';

// Analytics widgets — Issue #757
import AttritionRateWidget from './AttritionRateWidget';
import DepartmentBudgetWidget from './DepartmentBudgetWidget';
import EmployeeGrowthWidget from './EmployeeGrowthWidget';
import SalaryDistributionWidget from './SalaryDistributionWidget';

// Placeholder components for widgets that need specific data fetching
// eslint-disable-next-line react-refresh/only-export-components
const PendingApprovalsWidget = () => (
  <div className="flex items-center justify-center h-full text-gray-500 dark:text-slate-400 text-sm">
    Pending Approvals List (Fetches independently)
  </div>
);

// eslint-disable-next-line react-refresh/only-export-components
const RecentActivityWidget = () => (
  <div className="flex items-center justify-center h-full text-gray-500 dark:text-slate-400 text-sm">
    Recent Activity Feed
  </div>
);

export const WIDGET_REGISTRY = {
  'summary-cards': {
    title: 'Summary Cards',
    component: SummaryCards,
    defaultW: 12,
    defaultH: 2,
    minW: 6,
    minH: 2,
  },
  'payroll-trend': {
    title: 'Payroll Trend',
    component: PayrollTrendChart,
    defaultW: 6,
    defaultH: 4,
    minW: 4,
    minH: 3,
  },
  'department-breakdown': {
    title: 'Department Breakdown',
    component: DepartmentChart,
    defaultW: 6,
    defaultH: 4,
    minW: 4,
    minH: 3,
  },
  'overtime-analysis': {
    title: 'Overtime Analysis',
    component: OvertimeChart,
    defaultW: 6,
    defaultH: 4,
    minW: 4,
    minH: 3,
  },
  'pending-approvals': {
    title: 'Pending Approvals',
    component: PendingApprovalsWidget,
    defaultW: 6,
    defaultH: 4,
    minW: 4,
    minH: 3,
  },
  'recent-activity': {
    title: 'Recent Activity',
    component: RecentActivityWidget,
    defaultW: 6,
    defaultH: 4,
    minW: 4,
    minH: 3,
  },

  // Analytics widgets (Issue #757)
  'employee-growth': {
    title: 'Employee Growth',
    component: EmployeeGrowthWidget,
    defaultW: 6,
    defaultH: 4,
    minW: 4,
    minH: 3,
  },
  'salary-distribution': {
    title: 'Salary Distribution',
    component: SalaryDistributionWidget,
    defaultW: 6,
    defaultH: 4,
    minW: 4,
    minH: 3,
  },
  'department-budgets': {
    title: 'Department Budgets',
    component: DepartmentBudgetWidget,
    defaultW: 6,
    defaultH: 5,
    minW: 4,
    minH: 4,
  },
  'attrition-rate': {
    title: 'Attrition Rate',
    component: AttritionRateWidget,
    defaultW: 6,
    defaultH: 5,
    minW: 4,
    minH: 4,
  },
};

export const DEFAULT_LAYOUT = [
  { i: 'summary-cards', x: 0, y: 0, w: 12, h: 2, minW: 6, minH: 2 },
  { i: 'payroll-trend', x: 0, y: 2, w: 6, h: 4, minW: 4, minH: 3 },
  { i: 'department-breakdown', x: 6, y: 2, w: 6, h: 4, minW: 4, minH: 3 },
  { i: 'pending-approvals', x: 0, y: 6, w: 6, h: 4, minW: 4, minH: 3 },
  { i: 'recent-activity', x: 6, y: 6, w: 6, h: 4, minW: 4, minH: 3 },

  // Analytics widgets (Issue #757)
  { i: 'employee-growth', x: 0, y: 10, w: 6, h: 4, minW: 4, minH: 3 },
  { i: 'salary-distribution', x: 6, y: 10, w: 6, h: 4, minW: 4, minH: 3 },
  { i: 'department-budgets', x: 0, y: 14, w: 6, h: 5, minW: 4, minH: 4 },
  { i: 'attrition-rate', x: 6, y: 14, w: 6, h: 5, minW: 4, minH: 4 },
];