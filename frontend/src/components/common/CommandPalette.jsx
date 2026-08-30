/* eslint-disable */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import SearchIcon from '@mui/icons-material/Search';
import GridViewIcon from '@mui/icons-material/GridView';
import PeopleIcon from '@mui/icons-material/People';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SettingsIcon from '@mui/icons-material/Settings';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LogoutIcon from '@mui/icons-material/Logout';
import ShieldIcon from '@mui/icons-material/Shield';
import ReceiptIcon from '@mui/icons-material/Receipt';
import CampaignIcon from '@mui/icons-material/Campaign';
import CategoryIcon from '@mui/icons-material/Category';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import DescriptionIcon from '@mui/icons-material/Description';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import api from '../../services/api';
import { useAppStore } from '../../store/useAppStore';

const NAV_COMMANDS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    keywords: 'home overview payroll summary',
    icon: <GridViewIcon fontSize="small" />,
    path: '/dashboard',
  },
  {
    id: 'employees',
    label: 'Employees',
    keywords: 'people roster team members directory',
    icon: <PeopleIcon fontSize="small" />,
    path: '/dashboard?tab=employees',
  },
  {
    id: 'approvals',
    label: 'Approvals',
    keywords: 'approve reject review pending',
    icon: <FactCheckIcon fontSize="small" />,
    path: '/dashboard?tab=approvals',
  },
  {
    id: 'advances',
    label: 'Advances & Loans',
    keywords: 'loans salary advance credit',
    icon: <AccountBalanceWalletIcon fontSize="small" />,
    path: '/dashboard?tab=loans',
  },
  {
    id: 'monthly-updates',
    label: 'Monthly Updates',
    keywords: 'payroll run salary process',
    icon: <CalendarMonthIcon fontSize="small" />,
    path: '/monthly-updates',
  },
  {
    id: 'expense-reports',
    label: 'Custom Expense Reports',
    keywords: 'expenses claims reimbursement receipts report',
    icon: <ReceiptIcon fontSize="small" />,
    path: '/expense-reports',
  },
  {
    id: 'audit-logs',
    label: 'Audit Logs & Trail',
    keywords: 'audit system logs security actions history compliance',
    icon: <ShieldIcon fontSize="small" />,
    path: '/audit-logs',
  },
  {
    id: 'announcements',
    label: 'Company Announcements',
    keywords: 'announcements news wysiwyg hr posts updates',
    icon: <CampaignIcon fontSize="small" />,
    path: '/announcements',
  },
  {
    id: 'add-employee',
    label: 'Add Employee',
    keywords: 'new hire onboarding create employee',
    icon: <PersonAddIcon fontSize="small" />,
    path: '/add-employee',
  },
  {
    id: 'assets',
    label: 'Asset Inventory',
    keywords: 'assets equipment devices hardware tracking',
    icon: <CategoryIcon fontSize="small" />,
    path: '/assets',
  },
  {
    id: 'vendors',
    label: 'Vendor Management',
    keywords: 'vendors suppliers contracts procurement',
    icon: <LocalShippingIcon fontSize="small" />,
    path: '/vendors',
  },
  {
    id: 'client-invoices',
    label: 'Client Invoices',
    keywords: 'invoices billing clients payment receivable',
    icon: <DescriptionIcon fontSize="small" />,
    path: '/client-invoices',
  },
  {
    id: 'grievances',
    label: 'Grievance Portal',
    keywords: 'grievances complaints issues HR support ticket',
    icon: <ReportProblemIcon fontSize="small" />,
    path: '/grievances',
  },
  {
    id: 'reports',
    label: 'Reports & Analytics',
    keywords: 'analytics export pdf xlsx csv',
    icon: <AssessmentIcon fontSize="small" />,
    path: '/reports',
  },
  {
    id: 'settings',
    label: 'Settings',
    keywords: 'preferences company profile account notifications',
    icon: <SettingsIcon fontSize="small" />,
    path: '/settings',
  },
];

const CommandPalette = () => {
  const navigate = useNavigate();
  const toggleTheme = useAppStore((state) => state.toggleTheme);
  const logout = useAppStore((state) => state.logout);

  const [open, setOpen] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [search, setSearch] = useState('');

  const token =
    useAppStore((state) => state.token) || localStorage.getItem('token');

  // Open on Cmd/Ctrl+K and index employees fresh each time
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setLoadingEmployees(true);
        setOpen(true);
      }
    };

    if (token) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      if (token) {
        document.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [token]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };

    if (open) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      if (open) {
        document.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [open]);

  // Index employee names each time the palette opens so search stays fresh
  useEffect(() => {
    if (!open || !token) return undefined;

    let cancelled = false;

    api
      .get('/api/employees?limit=100')
      .then((res) => {
        if (!cancelled) setEmployees(res.data.employees || []);
      })
      .catch(() => {
        if (!cancelled) setEmployees([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingEmployees(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, token]);

  const runCommand = (cmd) => {
    if (cmd.action) {
      cmd.action();
    } else if (cmd.path) {
      navigate(cmd.path);
    }
    setOpen(false);
  };

  const actions = useMemo(
    () => [
      {
        id: 'run-payroll',
        label: 'Run Payroll',
        keywords: 'finalize submit monthly payroll',
        icon: <RocketLaunchIcon fontSize="small" />,
        path: '/monthly-updates',
      },
      {
        id: 'create-expense-report',
        label: 'Create Expense Report',
        keywords: 'expense custom claim reimbursement',
        icon: <ReceiptIcon fontSize="small" />,
        path: '/expense-reports',
      },
      {
        id: 'compose-announcement',
        label: 'Compose Announcement',
        keywords: 'announcement post publish hr update',
        icon: <CampaignIcon fontSize="small" />,
        path: '/announcements',
      },
      {
        id: 'view-audit-logs',
        label: 'View Audit Logs',
        keywords: 'audit logs trail history actions',
        icon: <ShieldIcon fontSize="small" />,
        path: '/audit-logs',
      },
      {
        id: 'toggle-theme',
        label: 'Toggle Theme',
        keywords: 'dark light mode appearance',
        icon: <DarkModeIcon fontSize="small" />,
        action: toggleTheme,
      },
      {
        id: 'sign-out',
        label: 'Sign Out',
        keywords: 'logout exit',
        icon: <LogoutIcon fontSize="small" />,
        action: () => {
          logout();
          localStorage.removeItem('companyName');
          navigate('/');
        },
      },
    ],
    [logout, navigate, toggleTheme],
  );

  if (!token) return null;

  return (
    open && (
      <div
        className="fixed inset-0 z-[1000] flex items-start justify-center bg-black/50 backdrop-blur-sm pt-[12vh] px-4"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={() => setOpen(false)}
      >
        <Command
          className="w-full max-w-xl overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl"
          onMouseDown={(e) => e.stopPropagation()}
          shouldFilter={false}
        >
          <div className="flex items-center gap-2 border-b border-gray-100 dark:border-slate-800 px-4">
            <SearchIcon fontSize="small" className="text-gray-400" />
            <Command.Input
              value={search}
              onValueChange={setSearch}

              autoFocus
              placeholder="Type a command or search employees…"
              aria-label="Search commands and employees"
              className="w-full bg-transparent py-3.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 outline-none"
            />
            <kbd className="hidden sm:inline-flex px-1.5 py-0.5 text-[10px] font-mono text-gray-400 dark:text-slate-500 border border-gray-200 dark:border-slate-700 rounded">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-[320px] overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-sm text-gray-500 dark:text-slate-400">
              No results for “{search}”.
            </Command.Empty>

            <Command.Group heading="Navigate">
              {NAV_COMMANDS.filter((c) => {
                const q = search.toLowerCase().trim();
                return (
                  !q ||
                  c.label.toLowerCase().includes(q) ||
                  c.keywords.toLowerCase().includes(q)
                );
              }).map((cmd) => (
                <Command.Item
                  key={cmd.id}
                  value={`nav-${cmd.id}`}
                  onSelect={() => runCommand(cmd)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-700 dark:text-slate-200 aria-selected:bg-blue-50 aria-selected:dark:bg-blue-950/40 aria-selected:text-blue-700 aria-selected:dark:text-blue-300 cursor-pointer"
                >
                  <span className="w-6 flex justify-center text-gray-400 dark:text-slate-500">
                    {cmd.icon}
                  </span>
                  {cmd.label}
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Actions">
              {actions
                .filter((c) => {
                  const q = search.toLowerCase().trim();
                  return (
                    !q ||
                    c.label.toLowerCase().includes(q) ||
                    c.keywords.toLowerCase().includes(q)
                  );
                })
                .map((cmd) => (
                  <Command.Item
                    key={cmd.id}
                    value={`action-${cmd.id}`}
                    onSelect={() => runCommand(cmd)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-700 dark:text-slate-200 aria-selected:bg-blue-50 aria-selected:dark:bg-blue-950/40 aria-selected:text-blue-700 aria-selected:dark:text-blue-300 cursor-pointer"
                  >
                    <span className="w-6 flex justify-center text-gray-400 dark:text-slate-500">
                      {cmd.icon}
                    </span>
                    {cmd.label}
                  </Command.Item>
                ))}
            </Command.Group>

            <Command.Group heading="Employees">
              {employees.map((emp) => {
                const matches =
                  !search.trim() ||
                  emp.fullName.toLowerCase().includes(search.toLowerCase()) ||
                  (emp.role || '').toLowerCase().includes(search.toLowerCase());
                if (!matches) return null;

                return (
                  <Command.Item
                    key={emp._id}
                    value={`emp-${emp.fullName}-${emp._id}`}
                    onSelect={() =>
                      runCommand({
                        path: `/dashboard?tab=employees&q=${encodeURIComponent(
                          emp.fullName,
                        )}`,
                      })
                    }
                    className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-700 dark:text-slate-200 aria-selected:bg-blue-50 aria-selected:dark:bg-blue-950/40 aria-selected:text-blue-700 aria-selected:dark:text-blue-300 cursor-pointer"
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                        {emp.fullName
                          .split(' ')
                          .map((w) => w[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                      <span className="truncate">{emp.fullName}</span>
                    </span>
                    {emp.role && (
                      <span className="text-xs text-gray-400 dark:text-slate-500 truncate">
                        {emp.role}
                      </span>
                    )}
                  </Command.Item>
                );
              })}
              {loadingEmployees && (
                <div className="px-3 py-2.5 text-xs text-gray-400 dark:text-slate-500">
                  Loading employees…
                </div>
              )}
            </Command.Group>
          </Command.List>

          <div className="flex items-center justify-between gap-2 border-t border-gray-100 dark:border-slate-800 px-4 py-2 text-[11px] text-gray-400 dark:text-slate-500">
            <span>⌘K to open · ↑↓ to navigate · ↵ to select</span>
            <span className="hidden sm:inline">Ctrl+Enter submits forms</span>
          </div>
        </Command>
      </div>
    )
  );
};

export default CommandPalette;
