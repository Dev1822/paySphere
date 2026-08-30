import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import SalaryStructurePanel from './SalaryStructurePanel';
import { formatCurrency } from '../utils/formatLocale';

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

const safeName = (name) =>
  typeof name === 'string' && name.trim() ? name.trim() : 'Employee';

const getAvatarColor = (name) => {
  const str = safeName(name);
  const idx =
    str.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) %
    AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
};

const getInitials = (name) =>
  safeName(name)
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase();

const fmt = (n, c = 'INR') => formatCurrency(n, c);

const StatusBadge = ({ finalized }) => {
  const { t } = useTranslation();
  return (
    <span
      className={`text-xs font-bold px-2 py-2 rounded-md border ${
        finalized
          ? 'bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-900/50'
          : 'bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-900/50'
      }`}
    >
      {finalized
        ? t('dashboard.statuses.finalized', 'Finalized')
        : t('dashboard.statuses.pending_approval', 'Pending')}
    </span>
  );
};

const CardHeader = ({ emp, finalized, onEdit }) => {
  const { t } = useTranslation();
  const name =
    emp?.fullName ||
    (emp?.firstName ? `${emp.firstName} ${emp.lastName || ''}`.trim() : '') ||
    emp?.name ||
    emp?.employeeName ||
    'Employee';

  return (
    <div className="flex justify-between items-center w-full">
      <div className="flex items-center gap-3">
        <div
          className="w-11 h-11 rounded-full text-white flex items-center justify-center font-bold"
          style={{ backgroundColor: getAvatarColor(name) }}
        >
          {getInitials(name)}
        </div>
        <div>
          <p className="font-bold text-sm text-slate-900 dark:text-white">
            {name}
          </p>
          <p className="text-xs text-gray-500 dark:text-slate-500">
            {emp?.role || t('dashboard.table.employee', 'Employee')}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge finalized={finalized} />
        {onEdit && (
          <button
            onClick={onEdit}
            className="pt-2 px-2 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 bg-gray-50 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            title={t('common.edit', 'Edit Employee')}
            aria-label={`Edit ${name}`}
          >
            <EditOutlinedIcon fontSize="small" className="mb-2" />
          </button>
        )}
      </div>
    </div>
  );
};

export default function EmployeeCard({
  emp,
  payroll,
  variant = 'overview',
  onAddUpdate,
  onDeleteEmployee,
  onEdit,
  onGenerateLetter,
}) {
  const { t } = useTranslation();
  const p = payroll;

  // Salary package + revision timeline (#461). Collapsed by default and
  // mounted lazily, so a grid of employee cards does not fire a request per
  // card on load.
  const [showSalaryHistory, setShowSalaryHistory] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');

  const handleCopyEmployeeId = async () => {
    try {
      await navigator.clipboard.writeText(emp._id);
      setCopyStatus('success');
    } catch {
      setCopyStatus('error');
    }

    setTimeout(() => setCopyStatus(''), 2000);
  };
  if (variant === 'breakdown') {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-gray-200 dark:border-slate-800 shadow-sm hover:shadow-md transition duration-200">
        <div className="flex justify-between items-center mb-5">
          <CardHeader emp={emp} finalized={!!p} onEdit={onEdit} />
        </div>

        {/* Breakdown */}
        <div className="space-y-2 text-sm mb-5 text-slate-700 dark:text-slate-300">
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-slate-500">
              {t('dashboard.table.baseSalary', 'Base Salary')}
            </span>
            <span className="font-semibold text-gray-950 dark:text-white">
              {fmt(emp.monthlySalary, emp.currency)}
            </span>
          </div>

          {p && p.leaveDays > 0 && (
            <div className="flex justify-between">
              <span className="text-red-600 dark:text-red-400">
                − {p.leaveDays}{' '}
                {p.leaveDays > 1
                  ? t('common.days', 'days')
                  : t('common.day', 'day')}{' '}
                {t('common.leave', 'leave')}
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
                  + {p.overtimeHours}{' '}
                  {p.overtimeHours > 1
                    ? t('common.hrs', 'hrs')
                    : t('common.hr', 'hr')}{' '}
                  {t('common.overtime', 'overtime')}
                </span>

                <InfoOutlinedIcon
                  fontSize="inherit"
                  className="text-sm cursor-help text-blue-500 dark:text-blue-400"
                />

                <div className="absolute left-0 top-full mt-2 hidden group-hover:block z-50 w-64 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-xl text-slate-800 dark:text-slate-200">
                  <p className="font-semibold text-gray-800 dark:text-white mb-2">
                    {t('common.overtimeCalculation', 'Overtime Calculation')}
                  </p>
                  <div className="space-y-1 text-xs text-gray-600 dark:text-slate-500">
                    <p>
                      {t('common.hoursWorked', 'Hours Worked')}:{' '}
                      {p.overtimeHours}
                    </p>
                    <p>
                      {t('common.overtimePay', 'Overtime Pay')}:{' '}
                      {fmt(p.overtimePay, emp.currency)}
                    </p>
                    <p className="font-semibold text-gray-800 dark:text-white mt-2 mb-1">
                      {t('common.formula', 'Formula')}
                    </p>
                    <p>
                      {t(
                        'common.overtimeFormula',
                        'Overtime Rate × Hours Worked',
                      )}
                    </p>
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
              <span className="text-green-600 dark:text-green-400">
                + {t('common.bonus', 'Bonus')}
              </span>
              <span className="text-green-600 dark:text-green-400 font-semibold">
                + {fmt(p.bonus, emp.currency)}
              </span>
            </div>
          )}

          {p && p.deductions > 0 && (
            <div className="flex justify-between">
              <span className="text-red-600 dark:text-red-400">
                − {t('common.deductions', 'Deductions')}
              </span>
              <span className="text-red-600 dark:text-red-400 font-semibold">
                - {fmt(p.deductions, emp.currency)}
              </span>
            </div>
          )}
        </div>

        {emp.customData && Object.keys(emp.customData).length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-800 mb-4">
            <p className="text-xs uppercase text-gray-500 font-bold mb-2">
              {t('common.additionalInfo', 'Additional Info')}
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm text-slate-700 dark:text-slate-300">
              {Object.entries(emp.customData).map(([key, value]) => (
                <div key={key}>
                  <span className="text-gray-500 block text-xs">{key}</span>
                  <span className="font-semibold">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="h-px bg-gray-200 dark:bg-slate-800 mb-4" />

        {/* Net */}
        <div className="flex justify-between items-center">
          <span className="text-xs uppercase text-gray-500 dark:text-slate-500 font-bold">
            {p
              ? t('dashboard.table.netSalary', 'Net Salary')
              : t('dashboard.table.salary', 'Monthly Salary')}
          </span>
          <span className="text-2xl font-semibold text-blue-600 dark:text-blue-400">
            {fmt(p ? p.netSalary : emp.monthlySalary, emp.currency)}
          </span>
        </div>

        {/* Salary package & revision history (#461) */}
        <button
          onClick={() => setShowSalaryHistory((v) => !v)}
          aria-expanded={showSalaryHistory}
          aria-label={
            showSalaryHistory
              ? `Hide salary history for ${emp.fullName}`
              : `View salary package and history for ${emp.fullName}`
          }
          className="mt-4 w-full py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors text-sm font-medium"
        >
          {showSalaryHistory
            ? t('common.hideSalaryHistory', 'Hide salary history')
            : t('common.salaryPackageHistory', 'Salary package & history')}
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
            aria-label={`Delete ${emp.fullName}`}
            className="mt-4 w-full py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 transition-colors"
          >
            {t('common.deleteEmployee', 'Delete Employee')}
          </button>
        )}

        {/* Generate Letter */}
        {onGenerateLetter && (
          <button
            onClick={() => onGenerateLetter(emp)}
            className="mt-2 w-full py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            Generate Letter
          </button>
        )}
      </div>
    );
  }

  // variant === 'overview'
  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm hover:shadow-md transition flex flex-col gap-4 duration-200">
      <CardHeader emp={emp} finalized={!!p} onEdit={onEdit} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-500 dark:text-slate-500">
          Employee ID: {emp._id}
        </span>

        <button
          type="button"
          onClick={handleCopyEmployeeId}
          className="px-2.5 py-1.5 text-xs font-semibold border border-gray-200 dark:border-slate-700 rounded-md text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
          aria-label={`Copy employee ID for ${emp.fullName}`}
        >
          Copy
        </button>
      </div>

      {copyStatus === 'success' && (
        <p className="text-xs text-green-600 dark:text-green-400">
          ✓ Employee ID copied!
        </p>
      )}

      {copyStatus === 'error' && (
        <p className="text-xs text-red-600 dark:text-red-400">
          Unable to copy employee ID.
        </p>
      )}
      {/* Salary */}
      <div className="bg-gray-50 dark:bg-slate-950 p-3 rounded-lg transition-colors">
        <div className="flex justify-between items-baseline">
          <p className="text-xs text-gray-500 dark:text-slate-500 uppercase">
            {p
              ? t('dashboard.table.netSalary', 'Net Salary')
              : t('dashboard.table.baseSalary', 'Base Salary')}
          </p>
          {p && (p.leaveDays > 0 || p.overtimeHours > 0) && (
            <span className="text-[10px] text-gray-500 dark:text-slate-500 font-medium">
              {t('common.inclAdjustments', 'Incl. adjustments')}
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
        aria-label={
          p
            ? `Edit updates for ${emp.fullName}`
            : `Add update for ${emp.fullName}`
        }
        className="border border-gray-200 dark:border-slate-800 rounded-lg py-2 text-blue-600 dark:text-blue-400 font-semibold hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
      >
        {p
          ? t('dashboard.editUpdates', 'Edit Updates')
          : t('common.addUpdate', '+ Add Update')}
      </button>

      {/* Generate Letter */}
      {onGenerateLetter && (
        <button
          onClick={() => onGenerateLetter(emp)}
          className="border border-indigo-200 dark:border-indigo-800 rounded-lg py-2 bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          Generate Letter
        </button>
      )}
    </div>
  );
}
