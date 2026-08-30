/**
 * DEV-ONLY auth bypass utility.
 *
 * Usage (browser console):
 *   devLogin()            → logs in as a demo admin user
 *   devLogin('manager')   → logs in with role "manager"
 *   devLogout()           → clears the fake session
 *
 * ⚠️  This file is only loaded in development mode.
 *     Remove or gate behind import.meta.env.DEV before shipping.
 */

import { useAppStore } from '../store/useAppStore';

const FAKE_TOKEN = 'dev-bypass-token-' + Date.now();

const DEMO_USER = {
  _id: 'dev-user-001',
  id: 'dev-user-001',
  name: 'Dev User',
  email: 'dev@paysphere.local',
  role: 'admin',
  company: {
    _id: 'dev-company-001',
    name: 'PaySphere Demo Corp',
  },
  avatar: null,
  createdAt: new Date().toISOString(),
};

function devLogin(role = 'admin') {
  const user = { ...DEMO_USER, role };
  const token = FAKE_TOKEN;

  // Set in localStorage (ProtectedRoute checks this)
  localStorage.setItem('token', token);

  // Set in Zustand store (components read from here)
  useAppStore.getState().setCredentials({ user, token });

  console.log(
    '%c✅ Dev bypass active — logged in as:',
    'color: #4ade80; font-weight: bold;',
    { name: user.name, email: user.email, role: user.role }
  );
  console.log(
    '%c💡 Navigate to /dashboard or refresh the page.',
    'color: #60a5fa;'
  );

  // Auto-navigate if on /auth page
  if (window.location.pathname === '/' || window.location.pathname.startsWith('/auth')) {
    window.location.href = '/dashboard';
  }
}

function devLogout() {
  useAppStore.getState().logout();
  console.log(
    '%c🔒 Dev session cleared.',
    'color: #f87171; font-weight: bold;'
  );
  window.location.href = '/auth';
}

// Expose globally
if (import.meta.env.DEV) {
  window.devLogin = devLogin;
  window.devLogout = devLogout;

  console.log(
    '%c🛠️  Dev auth bypass available — type devLogin() to skip login',
    'color: #c084fc; font-weight: bold; font-size: 13px;'
  );
}

export { devLogin, devLogout };
