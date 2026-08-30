import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ArchiveIcon from '@mui/icons-material/Archive';
import AssessmentIcon from '@mui/icons-material/Assessment';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import GridViewIcon from '@mui/icons-material/GridView';
import HelpOutlineIcon from '@mui/icons-material/HelpOutlineOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import PeopleIcon from '@mui/icons-material/People';
import SchoolIcon from '@mui/icons-material/School';
import styles from './Sidebar.module.css';
import { useEffect, useMemo, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { useOnboardingStore } from '../store/useOnboardingStore';
import { useTranslation } from 'react-i18next';
import ThemeToggle from './ThemeToggle';
import { navigationFor } from '../config/navigation';

/**
 * The application sidebar (#1012).
 *
 * Two things changed here, and the second is the one worth reading.
 *
 * It used to offer five destinations — dashboard, employees, approvals,
 * reports, settings — against 31 pages. It now renders from
 * `config/navigation.js`, the same registry `App.jsx` builds its routes from,
 * so a routed page cannot be missing from the nav by accident.
 *
 * And it did not navigate. Every item did this:
 *
 *     onClick={(e) => { e.preventDefault(); setActivePage(item.id); onClose(); }}
 *
 * — cancel the link, hand an id to the parent, and let the parent work out
 * what to do. Fifteen pages render this component and each implemented that
 * differently. `Dashboard.jsx` switched on capitalised names (`'Reports'`,
 * `'Flashcards'`) that the sidebar never emitted, since its ids were lowercase,
 * so every click fell through to the default branch. `Reports.jsx` and
 * `Assets.jsx` did `navigate(`/${page.toLowerCase()}`)`, which turned
 * "Employees" into `/employees` and "Approvals" into `/approvals` — neither of
 * which was a route, so both landed on the 404 page.
 *
 * The links are real router links now. Navigation belongs to the thing that
 * owns the destination, not to fifteen separate callers guessing from an id.
 *
 * `setActivePage` is still accepted and still called, because some pages use it
 * for their own internal tab state — `Dashboard.jsx` switches its main panel on
 * it. It is no longer how navigation happens, so the handlers in those pages
 * that call `navigate()` become redundant rather than wrong; the sidebar has
 * already gone to the right place by then.
 */

// ── Icons ─────────────────────────────────────────────────────────────────
//
// Inline SVG rather than @mui/icons-material, matching what this file already
// did: the MUI icon package is ~13MB and tree-shakes poorly through named
// imports, and these are 24 one-line paths.

const svg = (children) =>
  function Icon() {
    return (
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {children}
      </svg>
    );
  };

const ICONS = {
  grid: svg(
    <>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </>,
  ),
  people: svg(
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>,
  ),
  user: svg(
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>,
  ),
  userPlus: svg(
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="23" y1="11" x2="17" y2="11" />
    </>,
  ),
  archive: svg(
    <>
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </>,
  ),
  star: svg(
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
  ),
  document: svg(
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </>,
  ),
  check: svg(
    <>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </>,
  ),
  wallet: svg(
    <>
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4z" />
    </>,
  ),
  exit: svg(
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </>,
  ),
  chart: svg(
    <>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </>,
  ),
  target: svg(
    <>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </>,
  ),
  box: svg(
    <>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    </>,
  ),
  truck: svg(
    <>
      <rect x="1" y="3" width="15" height="13" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </>,
  ),
  receipt: svg(
    <>
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1z" />
      <line x1="8" y1="8" x2="16" y2="8" />
      <line x1="8" y1="13" x2="14" y2="13" />
    </>,
  ),
  book: svg(
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>,
  ),
  shield: svg(<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />),
  checkShield: svg(
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 11 11 13 15 9" />
    </>,
  ),
  alert: svg(
    <>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </>,
  ),
  calendar: svg(
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </>,
  ),
  megaphone: svg(
    <>
      <path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1z" />
      <path d="M18 8a5 5 0 0 1 0 8" />
    </>,
  ),
  flow: svg(
    <>
      <rect x="3" y="3" width="6" height="6" />
      <rect x="15" y="15" width="6" height="6" />
      <path d="M9 6h6a3 3 0 0 1 3 3v6" />
    </>,
  ),
  cards: svg(
    <>
      <rect x="2" y="6" width="14" height="14" rx="2" />
      <path d="M8 6V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2" />
    </>,
  ),
  school: svg(
    <>
      <path d="M22 10 12 5 2 10l10 5 10-5z" />
      <path d="M6 12v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5" />
    </>,
  ),
  game: svg(
    <>
      <line x1="6" y1="11" x2="10" y2="11" />
      <line x1="8" y1="9" x2="8" y2="13" />
      <line x1="15" y1="12" x2="15.01" y2="12" />
      <line x1="18" y1="10" x2="18.01" y2="10" />
      <rect x="2" y="6" width="20" height="12" rx="4" />
    </>,
  ),
  settings: svg(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>,
  ),
  help: svg(
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </>,
  ),
};

const Sidebar = ({
  companyName,
  activePage,
  setActivePage,
  isSidebarOpen,
  onClose,
  onLogout,
}) => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const resetTour = useOnboardingStore((state) => state.resetTour);
  const sidebarRef = useRef(null);

  // `role` is what the login response calls the account type — the server's
  // `resolveAccountType` returns 'ADMIN' or 'EMPLOYEE'.
  const accountType = useAppStore((state) => state.user?.role);

  useEffect(() => {
    if (!isSidebarOpen) return undefined;

    const handleOutsideClick = (event) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isSidebarOpen, onClose]);

  const sections = useMemo(() => navigationFor(accountType), [accountType]);

  const initials = useMemo(() => {
    if (!companyName) return '';
    return companyName
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }, [companyName]);

  /**
   * Whether a nav entry is the page currently on screen.
   *
   * Derived from the URL rather than from the `activePage` prop. The prop was
   * the sole source of truth before, and every page seeded it with a different
   * literal — `'Dashboard'`, `'Reports'`, `'Assets'` — while the sidebar
   * compared against its own lowercase ids, so on most pages nothing was ever
   * highlighted. The URL is the one thing all fifteen callers agree on.
   *
   * `activePage` is still honoured as a fallback for a page whose sidebar entry
   * is a query-string variant of a shared path.
   */
  const isCurrent = (item) => {
    const target = item.navPath || item.path;

    if (target.includes('?')) {
      const [pathPart, query] = target.split('?');
      const tab = new URLSearchParams(query).get('tab');
      return (
        location.pathname === pathPart &&
        new URLSearchParams(location.search).get('tab') === tab
      );
    }

    // An exact match, except for `/dashboard`, which must not light up while a
    // `?tab=` variant of itself is showing.
    if (location.pathname === target) {
      if (target === '/dashboard') {
        return !new URLSearchParams(location.search).get('tab');
      }
      return true;
    }

    // Fallback for a page that renders the sidebar at a path the registry does
    // not know about — it can still say which entry it considers current.
    return Boolean(activePage) && activePage === item.label;
  };

  const handleItemClick = (item) => {
    // Kept for the pages that drive internal tab state from this callback.
    // Navigation is the Link's job now.
    if (setActivePage) setActivePage(item.label);
    onClose();
  };

  return (
    <>
      {isSidebarOpen && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Close sidebar overlay"
          onKeyDown={(e) => e.key === 'Enter' && e.target.click()}
          className={styles.container}
          onClick={onClose}
        />
      )}

      <aside
        aria-label="Sidebar navigation"
        className={`w-56 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 fixed inset-y-0 left-0 flex flex-col z-50 transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } md:translate-x-0`}
        ref={sidebarRef}
      >
        <div className="p-5 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md shadow-blue-200 dark:shadow-none">
              {initials}
            </div>
            <div>
              <p className="font-bold text-sm text-gray-900 dark:text-white">
                {companyName}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-500">
                {t('dashboard.payrollWorkspace', 'Payroll workspace')}
              </p>
            </div>
          </div>
          <button
            className="md:hidden p-2 text-gray-500 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            onClick={onClose}
            aria-label={t('common.close', 'Close sidebar')}
          >
            ✕
          </button>
        </div>

        <nav aria-label="Main menu" className="flex-1 p-3 space-y-1 overflow-y-auto">
          {sections.map(({ group, items }) => (
            <div key={group.id} className="space-y-1 pb-3 last:pb-0">
              <p className="px-4 pt-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {t(`nav.groups.${group.id}`, group.label)}
              </p>
              {items.map((item) => {
                const Icon = ICONS[item.icon] || ICONS.grid;
                const current = isCurrent(item);

                return (
                  <Link
                    key={`${item.path}-${item.label}`}
                    to={item.navPath || item.path}
                    onClick={() => handleItemClick(item)}
                    aria-current={current ? 'page' : undefined}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500 ${current
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20 dark:shadow-none'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon />
                    {t(`nav.${item.id}`, item.label)}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-200 dark:border-slate-800 space-y-2 shrink-0">
          <ThemeToggle showLabel className="w-full" />

          <Link
            to="/settings"
            onClick={onClose}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm text-gray-500 dark:text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-800 transition"
          >
            <ICONS.settings />
            {t('nav.settings', 'Settings')}
          </Link>

          <Link
            to="/profile"
            onClick={onClose}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm text-gray-500 dark:text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-800 transition"
          >
            <ICONS.user />
            {t('settings.profile', 'Profile settings')}
          </Link>

         <button
         onClick={() => {
         resetTour(navigate);
          onClose();
          }}
          className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition font-medium"
          >
          <ICONS.help />
           Onboarding Tour
          </button>

          <button
            onClick={() => {
              window.location.href = 'mailto:support@paysphere.com';
              onClose();
            }}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm text-gray-500 dark:text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-800 transition"
          >
            <ICONS.help />
            {t('common.helpAndSupport', 'Help & Support')}
          </button>

          <button
            onClick={() => {
              if (onLogout) onLogout();
              onClose();
            }}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
          >
            {t('nav.logout', 'Logout')}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
