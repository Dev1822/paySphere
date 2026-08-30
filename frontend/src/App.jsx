import { createTheme, CssBaseline, ThemeProvider } from '@mui/material';
import * as Sentry from '@sentry/react';
import { Suspense, useEffect, useMemo } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import CommandPalette from './components/common/CommandPalette';
import OnboardingTour from './components/common/OnboardingTour';
import ScrollToTop from './components/common/ScrollToTop';
import OfflineSyncIndicator from './components/OfflineSyncIndicator';
import ProtectedRoute from './components/ProtectedRoute';
import { ToastProvider } from './context/ToastContext';
import { useAppStore } from './store/useAppStore';
import { NotFound, ROUTABLE } from './config/navigation';
import RouteFallback from './components/common/RouteFallback';
import AppPageShell from './components/Layout/AppPageShell';
import ImpersonationBanner from './components/common/ImpersonationBanner';
import OnboardingTooltip from './components/onboarding/OnboardingTooltip';
import ErrorBoundary from './components/common/ErrorBoundary';

// DEV-ONLY: exposes window.devLogin() / window.devLogout() in browser console
if (import.meta.env.DEV) {
  import('./utils/devBypass');
}

function App() {
  const user = useAppStore((state) => state.user);
  const themeMode = useAppStore((state) => state.themeMode);
  const logout = useAppStore((state) => state.logout);

  // Sync user context to Sentry (#770)
  useEffect(() => {
    if (user) {
      Sentry.setUser({
        id: user.id || user._id,
        email: user.email,
        username: user.name,
      });
    } else {
      Sentry.setUser(null);
    }
  }, [user]);

  // Synchronize Redux auth state when API interceptor
  // detects expired/invalid authentication
  useEffect(() => {
    const handleAuthLogout = () => {
      logout();
    };

    window.addEventListener('auth:logout', handleAuthLogout);

    return () => {
      window.removeEventListener('auth:logout', handleAuthLogout);
    };
  }, [logout]);

  // Sync dark class on html document element
  // for Tailwind v4 custom dark variant
  useEffect(() => {
    if (themeMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [themeMode]);

  // Create MUI theme based on the active theme mode
  const muiTheme = useMemo(() => {
    return createTheme({
      palette: {
        mode: themeMode,
        primary: {
          main: '#3b82f6',
        },
        background: {
          default: themeMode === 'dark' ? '#090d16' : '#f3f4f6',
          paper: themeMode === 'dark' ? '#111827' : '#ffffff',
        },
      },
    });
  }, [themeMode]);

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />

      <ToastProvider>
        <BrowserRouter>
          <ImpersonationBanner />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              {/* Built from `config/navigation.js` rather than written out
                  here, so the router and the sidebar cannot disagree about
                  which pages exist — which is how seventeen finished pages
                  ended up with no route at all (#1012).

                  `Page` is a local const rather than a destructured parameter
                  on purpose: this project does not enable eslint-plugin-react,
                  so `no-unused-vars` cannot tell that a name is used in JSX.
                  The config exempts capitalised *variables* through
                  `varsIgnorePattern`, and that exemption does not reach
                  function arguments. */}
              {ROUTABLE.map((route) => {
                const Page = route.component;

                return (
                  <Route
                    key={route.path}
                    path={route.path}
                    element={
                      <ErrorBoundary level="page">
                        {route.isProtected === false ? (
                          <Page />
                        ) : (
                          <ProtectedRoute>
                            {route.appShell ? (
                              <AppPageShell>
                                <Page />
                              </AppPageShell>
                            ) : (
                              <Page />
                            )}
                          </ProtectedRoute>
                        )}
                      </ErrorBoundary>
                    }
                  />
                );
              })}

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>

          <ScrollToTop />
          <CommandPalette />
          <OnboardingTour />

          {/* Global Offline Sync Indicator (Issue #815) */}
          <OfflineSyncIndicator />
          <OnboardingTooltip />
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
