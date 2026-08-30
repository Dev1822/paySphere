import axios from 'axios';

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // In production (e.g. static host or served by backend), fall back to origin/relative path
  if (import.meta.env.PROD) {
    return typeof window !== 'undefined' ? window.location.origin : '';
  }
  return 'http://localhost:5000';
};

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

function getCsrfTokenFromCookie() {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const csrfToken = getCsrfTokenFromCookie();
    if (
      csrfToken &&
      ['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase())
    ) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }

    if (['post', 'put', 'patch'].includes(config.method?.toLowerCase())) {
      if (
        !config.headers['Idempotency-Key'] &&
        !config.headers['idempotency-key']
      ) {
        config.headers['Idempotency-Key'] =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).substring(2, 15) +
              Date.now().toString(36);
      }
    }

    return config;
  },
  (error) => Promise.reject(error),
);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

/**
 * Tear the session down: the server no longer accepts who we claim to be.
 *
 * Reserved for 401 and for a refresh that itself fails. A 403 must never come
 * here — see the note in the interceptor below.
 */
const handleAuthFailure = () => {
  localStorage.removeItem('token');
  window.dispatchEvent(new Event('auth:logout'));
  if (
    typeof window !== 'undefined' &&
    window.location.pathname !== '/auth' &&
    window.location.pathname !== '/'
  ) {
    window.location.href = '/auth';
  }
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Network or connection error without a server response
    if (!error || !error.response) {
      return Promise.reject(error);
    }

    // Skip token refresh for auth endpoints where 401 is expected (e.g., wrong password)
    if (
      originalRequest?.url?.includes('/api/auth/login') ||
      originalRequest?.url?.includes('/api/auth/signup') ||
      originalRequest?.url?.includes('/api/auth/google') ||
      originalRequest?.url?.includes('/api/auth/refresh')
    ) {
      if (
        originalRequest?.url?.includes('/api/auth/refresh') &&
        (error.response.status === 401 || error.response.status === 403)
      ) {
        handleAuthFailure();
      }
      return Promise.reject(error);
    }

    if (error.response.status === 401) {
      const isBackground =
        originalRequest.isBackground ||
        originalRequest.headers?.['X-Background-Request'] === 'true' ||
        originalRequest.headers?.['x-background-request'] === 'true';

      if (originalRequest._retry) {
        // Retried request failed with 401 again -> clear session & redirect (or handle background)
        if (isBackground) {
          window.dispatchEvent(
            new CustomEvent('toast:show', {
              detail: {
                message:
                  'Auto-save failed: Session expired. Please login again to save your work.',
                severity: 'warning',
              },
            }),
          );
          return Promise.resolve({
            data: { success: false, error: 'Session expired' },
          });
        }
        handleAuthFailure();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = 'Bearer ' + token;
            return api(originalRequest);
          })
          .catch((err) => {
            if (isBackground) {
              window.dispatchEvent(
                new CustomEvent('toast:show', {
                  detail: {
                    message:
                      'Auto-save failed: Session expired. Please login again to save your work.',
                    severity: 'warning',
                  },
                }),
              );
              return Promise.resolve({
                data: { success: false, error: 'Session expired' },
              });
            }
            handleAuthFailure();
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post(
          `${API_BASE_URL}/api/auth/refresh`,
          {},
          { withCredentials: true },
        );
        const { token } = res.data;
        localStorage.setItem('token', token);
        api.defaults.headers.common['Authorization'] = 'Bearer ' + token;
        originalRequest.headers['Authorization'] = 'Bearer ' + token;

        processQueue(null, token);
        return api(originalRequest);
      } catch (err) {
        processQueue(err, null);
        if (isBackground) {
          window.dispatchEvent(
            new CustomEvent('toast:show', {
              detail: {
                message:
                  'Auto-save failed: Session expired. Please login again to save your work.',
                severity: 'warning',
              },
            }),
          );
          return Promise.resolve({
            data: { success: false, error: 'Session expired' },
          });
        }
        handleAuthFailure();
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    // A 403 is deliberately *not* an auth failure.
    //
    // 401 means "I do not know who you are" — clearing the token is right.
    // 403 means "I know exactly who you are, and you may not do this", and the
    // session is perfectly valid. Logging the user out here meant a permission
    // denial destroyed their session: `config/permissions.js` gives HRManager
    // payroll write but deliberately not APPROVE_PAYROLL, so opening the
    // Approvals page returned 403 and bounced them to /auth with no
    // explanation. Log back in, click it again, thrown out again.
    //
    // The same applied to the CORS rejection in `app.js`, which answers 403 —
    // a deployment where FRONTEND_URL does not match the served origin logged
    // every visitor out on their first XHR, reading as "login is broken".
    //
    // The rejection is passed through so the caller can render the server's
    // message. Approvals.jsx already has the right copy for it; it was simply
    // unreachable. A refresh call that 403s is still treated as a failure, in
    // the auth-endpoint branch above, because that genuinely is a dead session.
    return Promise.reject(error);
  },
);
// DEV-ONLY: return mock data when backend is unreachable
if (import.meta.env.DEV) {
  import('../utils/mockApi').then(({ installMockInterceptor }) => {
    installMockInterceptor(api);
  });
}

/**
 * Helper to extract data from an API response, handling both
 * the new standard ResponseEnvelope ({ success: true, data: ... })
 * and legacy shapes (res.data, res.data.employees, etc.).
 */
export const extractData = (response) => {
  if (!response || !response.data) return null;
  const body = response.data;

  // New Envelope format
  if (body.success === true && body.data !== undefined) {
    return body.data;
  }

  // Legacy fallback
  return body;
};

/**
 * Helper to extract the error message from an API error, handling both
 * the new standard ResponseEnvelope ({ success: false, error: { message } })
 * and legacy shapes.
 */
export const extractErrorMessage = (error) => {
  if (error?.response?.data) {
    const body = error.response.data;

    // New Envelope format
    if (body.success === false && body.error && body.error.message) {
      return body.error.message;
    }

    // Legacy fallback
    if (body.message) {
      return body.message;
    }

    return typeof body === 'string' ? body : 'An unexpected error occurred';
  }

  return error?.message || 'Network Error';
};

export default api;
