import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'; // <-- Added Edit Icon
import { useState } from 'react';
import SalaryStructurePanel from './SalaryStructurePanel';

/**
 * EmployeeCard
 *
 * Renders a single employee card. Extracted from Dashboard.jsx (issue #40).
 * Supports two visual variants that previously lived inline in the page:
 *
 *   variant="overview"  — compact card used on the Dashboard overview grid.
 *                         Shows header, a salary box, and an action button.
 *   variant="breakdown" — detailed card used on the Employee Management grid.
 *                         Shows header, a salary breakdown (leave, overtime,
 *                         bonus, deductions), divider, and net salary.
 *
 * Props:
 *   emp         - employee object ({ _id, fullName, role, monthlySalary })
 *   payroll     - optional payroll object for this employee, or null/undefined
 *   variant     - 'overview' (default) | 'breakdown'
 *   onAddUpdate     - callback fired by the action button (overview variant only)
 *   onDeleteEmployee - optional callback fired by the "Delete Employee" button
 *                      (breakdown variant only). When omitted, the button is not rendered.
 *   onEdit           - callback fired by the edit (pen) button in the header // <-- Added
 */
const AVATAR_COLORS = [
  '#6366F1',
  '#EC4899',
  '#F59E0B',
  '#10B981',
  '#3B82F6',
  '#8B5CF6',
  '#EF4444',
  '#14B8A6',
];

const getAvatarColor = (name) => {
  const idx = name
    .split('')
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
};

const getInitials = (name) =>
  name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const fmt = (n, c = "INR") => new Intl.NumberFormat('en-IN', { style: 'currency', currency: c }).format(n);

const StatusBadge = ({ finalized }) => (
  <span
    className={`text-xs font-bold px-2 py-2 rounded-md border ${
      finalized
        ? 'bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-900/50'
        : 'bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-900/50'
    }`}
  >
    {finalized ? 'Finalized' : 'Pending'}
  </span>
);

// <-- Added onEdit prop and Edit Button next to StatusBadge
const CardHeader = ({ emp, finalized, onEdit }) => (
  <div className="flex justify-between items-center">
    <div className="flex items-center gap-3">
      <div
        className="w-11 h-11 rounded-full text-white flex items-center justify-center font-bold"
        style={{ backgroundColor: getAvatarColor(emp.fullName) }}
      >
        {getInitials(emp.fullName)}
      </div>
      <div>
        <p className="font-bold text-sm text-slate-900 dark:text-white">
          {emp.fullName}
        </p>
        <p className="text-xs text-gray-500 dark:text-slate-500">
          {emp.role || 'Employee'}
        </p>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <StatusBadge finalized={finalized} />
      {onEdit && (
        <button
          onClick={onEdit}
          className="pt-2 px-2 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 bg-gray-50 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          title="Edit Employee"
         aria-label="EditOutlinedIcon">
        <EditOutlinedIcon fontSize="small" className='mb-2'/>
      </button>
      )}
    </div>
  </div>
);

export default function EmployeeCard({
  emp,
  payroll,
  variant = 'overview',
  onAddUpdate,
  onDeleteEmployee,
  onEdit, // <-- Added
}) {
  const p = payroll;

  // Salary package + revision timeline (#461). Collapsed by default and
  // mounted lazily, so a grid of employee cards does not fire a request per
  // card on load.
  const [showSalaryHistory, setShowSalaryHistory] = useState(false);

  if (variant === 'breakdown') {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-gray-200 dark:border-slate-800 shadow-sm hover:shadow-md transition duration-200">
        <div className="flex justify-between items-center mb-5">
          <CardHeader emp={emp} finalized={!!p} onEdit={onEdit} /> {/* <-- Passed onEdit */}
        </div>

        {/* Breakdown */}
        <div className="space-y-2 text-sm mb-5 text-slate-700 dark:text-slate-300">
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-slate-500">Base Salary</span>
            <span className="font-semibold text-gray-950 dark:text-white">
              {fmt(emp.monthlySalary, emp.currency)}
            </span>
          </div>

          {p && p.leaveDays > 0 && (
            <div className="flex justify-between">
              <span className="text-red-600 dark:text-red-400">
                − {p.leaveDays} day{p.leaveDays > 1 ? 's' : ''} leave
              </span>
              <span className="text-red-600 dark:text-red-400 font-semibold">
                - {fmt(p.leaveDeduction, emp.currency)}
              </span>
            </div>
          )}

          {p && p.overtimeHours > 0 && (
            <div className="flex justify-between">
              <div className="relative group flex items-center gap-1 text-blue-600 dark:text-blue-400">
                <span className="cursor-pointer">
                  + {p.overtimeHours} hr{p.overtimeHours > 1 ? 's' : ''} overtime
                </span>

                <InfoOutlinedIcon
                  fontSize="inherit"
                  className="text-sm cursor-help text-blue-500 dark:text-blue-400"
                />

                <div className="absolute left-0 top-full mt-2 hidden group-hover:block z-50 w-64 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-xl text-slate-800 dark:text-slate-200">
                  <p className="font-semibold text-gray-800 dark:text-white mb-2">
                    Overtime Calculation
                  </p>
                  <div className="space-y-1 text-xs text-gray-600 dark:text-slate-500">
                    <p>Hours Worked: {p.overtimeHours}</p>
                    <p>Overtime Pay: {fmt(p.overtimePay, emp.currency)}</p>
                    <p className="font-semibold text-gray-800 dark:text-white mt-2 mb-1">
                      Formula
                    </p>
                    <p>Overtime Rate × Hours Worked</p>
                  </div>
                </div>
              </div>
              <span className="text-blue-600 dark:text-blue-400 font-semibold">
                + {fmt(p.overtimePay, emp.currency)}
              </span>
            </div>
          )}

          {p && p.bonus > 0 && (
            <div className="flex justify-between">
              <span className="text-green-600 dark:text-green-400">+ Bonus</span>
              <span className="text-green-600 dark:text-green-400 font-semibold">
                + {fmt(p.bonus, emp.currency)}
              </span>
            </div>
          )}

          {p && p.deductions > 0 && (
            <div className="flex justify-between">
              <span className="text-red-600 dark:text-red-400">− Deductions</span>
              <span className="text-red-600 dark:text-red-400 font-semibold">
                - {fmt(p.deductions, emp.currency)}
              </span>
            </div>
          )}
        </div>

        <div className="h-px bg-gray-200 dark:bg-slate-800 mb-4" />

        {/* Net */}
        <div className="flex justify-between items-center">
          <span className="text-xs uppercase text-gray-500 dark:text-slate-500 font-bold">
            {p ? 'Net Salary' : 'Monthly Salary'}
          </span>
          <span className="text-2xl font-semibold text-blue-600 dark:text-blue-400">
            {fmt(p ? p.netSalary : emp.monthlySalary, emp.currency)}
          </span>
        </div>

        {/* Salary package & revision history (#461) */}
        <button
          onClick={() => setShowSalaryHistory((v) => !v)}
          className="mt-4 w-full py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors text-sm font-medium"
        >
          {showSalaryHistory ? 'Hide salary history' : 'Salary package & history'}
        </button>

        {showSalaryHistory && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-800">
            <SalaryStructurePanel
              employeeId={emp._id}
              employeeName={emp.fullName}
              currency={emp.currency}
            />
          </div>
        )}

        {/* Delete Employee */}
        {onDeleteEmployee && (
          <button
            onClick={() => onDeleteEmployee(emp)}
            className="mt-4 w-full py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 transition-colors"
          >
            Delete Employee
          </button>
        )}
      </div>
    );
  }

  // variant === 'overview'
  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm hover:shadow-md transition flex flex-col gap-4 duration-200">
      <CardHeader emp={emp} finalized={!!p} onEdit={onEdit} />

      {/* Salary */}
      <div className="bg-gray-50 dark:bg-slate-950 p-3 rounded-lg transition-colors">
        <div className="flex justify-between items-baseline">
          <p className="text-xs text-gray-500 dark:text-slate-500 uppercase">
            {p ? 'Net Salary' : 'Base Salary'}
          </p>
          {p && (p.leaveDays > 0 || p.overtimeHours > 0) && (
            <span className="text-[10px] text-gray-500 dark:text-slate-500 font-medium">
              Incl. adjustments
            </span>
          )}
        </div>
        <p className="text-lg font-bold text-slate-900 dark:text-white">
          {fmt(p ? p.netSalary : emp.monthlySalary, emp.currency)}
        </p>
      </div>

      {/* Button */}
      <button
        onClick={onAddUpdate}
        className="border border-gray-200 dark:border-slate-800 rounded-lg py-2 text-blue-600 dark:text-blue-400 font-semibold hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
      >
        {p ? 'Edit Updates' : '+ Add Update'}
      </button>
    </div>
  );
}
