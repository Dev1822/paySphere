import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import zxcvbn from '../utils/zxcvbn';

import { Helmet } from 'react-helmet-async';
import ThemeToggle from '../components/ThemeToggle';
import { useAppStore } from '../store/useAppStore';

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48">
    <path
      fill="#FFC107"
      d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
    />
  </svg>
);

const GitHubIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z"
    />
  </svg>
);

export default function PaySphereLogin() {
  const navigate = useNavigate();
  const setCredentials = useAppStore((state) => state.setCredentials);
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('mode') === 'signup' ? 'signup' : 'login';
  const [activeTab, setActiveTab] = useState(initialTab);

  const resetFormState = () => {
    setError('');
    setSuccessMessage('');
    setIsForgotPassword(false);
  };

  // Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [password, setPassword] = useState('');

  const passwordStrength = useMemo(() => {
    if (!password) return null;
    return zxcvbn(password);
  }, [password]);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot Password State
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Pre-load reCAPTCHA v3 script in background if site key is present
  useEffect(() => {
    const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
    if (siteKey && !window.grecaptcha) {
      const script = document.createElement('script');
      script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, []);

  const executeRecaptcha = async (action) => {
    const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
    if (!siteKey) {
      return null;
    }

    return new Promise((resolve) => {
      const runTokenGen = () => {
        window.grecaptcha.ready(async () => {
          try {
            const token = await window.grecaptcha.execute(siteKey, { action });
            resolve(token);
          } catch (e) {
            console.error('reCAPTCHA execution error:', e);
            resolve(null);
          }
        });
      };

      if (!window.grecaptcha) {
        const script = document.createElement('script');
        script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
        script.async = true;
        script.defer = true;
        script.onload = runTokenGen;
        document.body.appendChild(script);
      } else {
        runTokenGen();
      }
    });
  };

  const handleGitHubCallback = async (code) => {
    setLoading(true);
    setError('');

    // Clear code from URL
    const newUrl = window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);

    try {
      const storedCompanyName = sessionStorage.getItem('github_signup_company');
      const payload = { code };
      if (storedCompanyName) {
        payload.companyName = storedCompanyName;
      }

      const response = await api.post(`/api/auth/github`, payload);

      if (response.status === 202 && response.data.needsCompanyName) {
        setError(response.data.message);
        setActiveTab('signup');
      } else {
        const { token, companyName: savedCompanyName } = response.data;
        setCredentials({ user: response.data.user || null, token });
        localStorage.setItem('companyName', savedCompanyName);
        if (response.data.currency) {
          localStorage.setItem('currency', response.data.currency);
        }
        sessionStorage.removeItem('github_signup_company');
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'GitHub Login failed.');
    } finally {
      setLoading(false);
    }
  };

  // Handle GitHub Callback
  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      handleGitHubCallback(code);
    }
  }, [searchParams]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (activeTab === 'signup') {
      const strength = zxcvbn(password);
      if (strength.score < 3) {
        setError(`Password is too weak. ${strength.feedback.warning || ''} Suggestions: ${strength.feedback.suggestions.join(', ')}`);
        setLoading(false);
        return;
      }
    }

    const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
    let recaptchaToken = null;
    if (siteKey) {
      recaptchaToken = await executeRecaptcha(activeTab === 'signup' ? 'signup' : 'login');
      if (!recaptchaToken) {
        setError('Failed to generate security verification. Please try again.');
        setLoading(false);
        return;
      }
    }

    const endpoint = activeTab === 'signup' ? '/signup' : '/login';
    const payload =
      activeTab === 'signup'
        ? { fullName, email, companyName, password, recaptchaToken }
        : { email, password, recaptchaToken };

    try {
      const response = await api.post(`/api/auth${endpoint}`, payload);

      const { token, companyName: savedCompanyName } = response.data;

      // Save to localStorage
      setCredentials({ user: response.data.user || null, token });
      localStorage.setItem('companyName', savedCompanyName);
      if (response.data.currency) {
        localStorage.setItem('currency', response.data.currency);
      }

      // Navigate to dashboard
      navigate('/dashboard');
    } catch (err) {
      setError(
        err.response?.data?.message ||
          'Something went wrong. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      const response = await api.post('/api/auth/forgot-password', {
        email: forgotEmail,
      });
      setSuccessMessage(
        response.data.message || 'Password reset link sent to your email.',
      );
      setForgotEmail('');
    } catch (err) {
      setError(
        err.response?.data?.message ||
          'Failed to send reset link. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const onGitHubClick = () => {
    if (activeTab === 'signup') {
      if (!companyName) {
        setError('Please enter your Company Name to sign up with GitHub.');
        return;
      }
      sessionStorage.setItem('github_signup_company', companyName);
    } else {
      sessionStorage.removeItem('github_signup_company');
    }
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
    if (!clientId) {
      setError('GitHub Client ID is not configured.');
      return;
    }
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=user:email`;
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-950 flex flex-col font-sans relative transition-colors duration-200">
      <Helmet>
        <title>
          {activeTab === 'signup'
            ? 'Create Account | PaySphere'
            : 'Login | PaySphere'}
        </title>
        <meta
          name="description"
          content={
            activeTab === 'signup'
              ? 'Join PaySphere and automate your payroll today.'
              : 'Login to your PaySphere account to manage your employees.'
          }
        />
      </Helmet>

      {/* Floating Theme Toggle */}
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-6 sm:py-8">
        <div className="w-full max-w-6xl bg-white dark:bg-slate-900 border border-transparent dark:border-slate-800/80 rounded-2xl sm:rounded-3xl shadow-xl flex flex-col md:flex-row overflow-hidden transition-colors">
          {/* LEFT PANEL (hidden on mobile) */}
          <div className="hidden md:flex md:w-[42%] bg-linear-to-br from-indigo-50 via-red-50 to-yellow-100 dark:from-slate-800 dark:via-slate-850 dark:to-slate-900 p-8 lg:p-10 flex-col justify-between relative overflow-hidden">
            <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-blue-500/10" />
            <div className="absolute bottom-24 -left-10 w-40 h-40 rounded-full bg-yellow-400/20" />

            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-12 lg:mb-16">
                <div className="w-8 h-8 bg-blue-600 rounded-lg shadow-sm" />
                <span className="font-bold text-lg text-gray-900 dark:text-white">
                  PaySphere
                </span>
              </div>

              <h1 className="text-3xl lg:text-4xl font-serif text-gray-900 dark:text-white mb-4 leading-tight">
                Back to <br /> simplicity.
              </h1>

              <p className="text-gray-500 dark:text-slate-450 text-sm max-w-xs leading-relaxed">
                Experience the digital ledger for modern Bharat.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 lg:p-5 shadow-md border border-transparent dark:border-slate-800/80 relative z-10">
              <p className="text-sm text-gray-500 dark:text-slate-500 mb-2">
                Last Month Payout
              </p>
              <h2 className="text-xl lg:text-2xl font-serif text-gray-900 dark:text-white">
                ₹12,45,000
              </h2>
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className="w-full md:flex-1 px-5 sm:px-8 md:px-12 py-8 sm:py-10 flex flex-col justify-center text-slate-800 dark:text-slate-200">
            {/* tabs */}
            <div role="tablist" aria-label="Account type" className="flex bg-gray-100 dark:bg-slate-950 rounded-xl p-1 mb-6 sm:mb-8 transition-colors">
              <button
                role="tab"
                aria-selected={activeTab === 'login'}
                onClick={() => {
                  setActiveTab('login');
                  resetFormState();
                }}
                className={`flex-1 py-2 cursor-pointer rounded-lg text-sm font-medium transition ${
                  activeTab === 'login'
                    ? 'bg-white dark:bg-slate-900 shadow text-gray-900 dark:text-white'
                    : 'text-gray-500 dark:text-slate-450 hover:text-gray-700 dark:hover:text-slate-200'
                }`}
              >
                Login
              </button>

              <button
                role="tab"
                aria-selected={activeTab === 'signup'}
                onClick={() => {
                  setActiveTab('signup');
                  resetFormState();
                }}
                className={`flex-1 py-2 cursor-pointer rounded-lg text-sm font-medium transition ${
                  activeTab === 'signup'
                    ? 'bg-white dark:bg-slate-900 shadow text-gray-900 dark:text-white'
                    : 'text-gray-500 dark:text-slate-450 hover:text-gray-700 dark:hover:text-slate-200'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* LOGIN */}
            {activeTab === 'login' ? (
              <>
                {isForgotPassword ? (
                  <>
                    <h2 className="text-2xl font-serif text-gray-900 dark:text-white mb-1">
                      Reset Password
                    </h2>
                    <p className="text-gray-500 dark:text-slate-500 text-sm mb-6">
                      Enter your registered email to receive a password reset
                      link.
                    </p>

                    <form onSubmit={handleForgotPassword}>
                      <input
                        type="email"
                        id="forgot-email"
                        name="forgotEmail"
                        aria-label="Email address for password reset"
                        placeholder="name@company.com"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        required
                        className="w-full mb-4 px-4 py-3 rounded-lg bg-gray-100 dark:bg-slate-950 text-gray-950 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 border border-transparent dark:border-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 dark:focus:border-blue-500 outline-none transition-colors"
                      />

                      {error && (
                        <p className="text-red-500 text-xs mb-4">{error}</p>
                      )}
                      {successMessage && (
                        <p className="text-green-600 text-xs mb-4">
                          {successMessage}
                        </p>
                      )}

                      <button
                        type="submit"
                        className="w-full py-3 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white font-bold rounded-lg transition shadow-lg shadow-brand-500/30"
                      >
                        {loading ? 'Sending...' : 'Send Reset Link'}
                      </button>
                    </form>

                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setIsForgotPassword(false);
                          setError('');
                          setSuccessMessage('');
                        }}
                        className="text-sm text-blue-600 dark:text-blue-450 hover:underline font-semibold"
                      >
                        Back to Login
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="text-2xl font-serif text-gray-900 dark:text-white mb-1">
                      Welcome back
                    </h2>
                    <p className="text-gray-500 dark:text-slate-500 text-sm mb-6">
                      Enter your credentials
                    </p>

                    <form onSubmit={handleAuth}>
                      <input
                        type="email"
                        id="login-email"
                        name="email"
                        aria-label="Email address"
                        placeholder="name@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full mb-4 px-4 py-3 rounded-lg bg-gray-100 dark:bg-slate-950 text-gray-950 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 border border-transparent dark:border-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 dark:focus:border-blue-500 outline-none transition-colors"
                      />

                      <input
                        type="password"
                        id="login-password"
                        name="password"
                        aria-label="Password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full mb-4 px-4 py-3 rounded-lg bg-gray-100 dark:bg-slate-950 text-gray-950 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 border border-transparent dark:border-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 dark:focus:border-blue-500 outline-none transition-colors"
                      />

                      <div className="flex justify-end mb-4 -mt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsForgotPassword(true);
                            setError('');
                            setSuccessMessage('');
                          }}
                          className="text-xs cursor-pointer text-blue-600 dark:text-blue-450 hover:underline font-semibold"
                        >
                          Forgot Password?
                        </button>
                      </div>

                      {error && (
                        <p className="text-red-500 text-xs mb-4" role="alert">{error}</p>
                      )}

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 cursor-pointer hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition mb-5 text-center disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                      >
                        {loading ? 'Logging in...' : 'Login'}
                      </button>
                    </form>
                  </>
                )}

                <div className="flex items-center gap-3 mb-5">
                  <div className="flex-1 h-px bg-gray-200 dark:bg-slate-800" />
                  <span className="text-xs text-gray-500 dark:text-slate-500 font-semibold">
                    OR
                  </span>
                  <div className="flex-1 h-px bg-gray-200 dark:bg-slate-800" />
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    disabled
                    aria-label="Sign in with Google"
                    className="flex-1 border cursor-pointer border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-200 py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-slate-600 hover:shadow transition disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                  >
                    <GoogleIcon />
                    Google (unavailable)
                  </button>

                  <button
                    onClick={onGitHubClick}
                    disabled={loading}
                    aria-label="Sign in with GitHub"
                    className="flex-1 border cursor-pointer border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-200 py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-slate-600 hover:shadow transition disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                  >
                    <GitHubIcon />
                    GitHub
                  </button>
                </div>

                <p className="text-center text-sm text-gray-600 dark:text-slate-400 mt-6">
                  {activeTab === 'login'
                    ? "Don't have an account?"
                    : 'Already have an account?'}
                  {/* Fixed: Replaced anchor with button for valid semantics (Issue #660) */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab(activeTab === 'login' ? 'signup' : 'login');
                      resetFormState();
                    }}
                    className="ml-1 font-bold text-brand-600 dark:text-brand-400 hover:underline focus:outline-none focus:ring-2 focus:ring-brand-500 rounded"
                  >
                    {activeTab === 'login' ? 'Sign Up' : 'Login'}
                  </button>
                </p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-serif text-gray-900 dark:text-white mb-1">
                  Create your account
                </h2>
                <p className="text-gray-500 dark:text-slate-500 text-sm mb-6">
                  Set up your company roster
                </p>

                <form onSubmit={handleAuth}>
                  <input
                    type="text"
                    id="signup-fullname"
                    name="fullName"
                    aria-label="Full name"
                    placeholder="Full Name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="w-full mb-4 px-4 py-3 rounded-lg bg-gray-100 dark:bg-slate-950 text-gray-950 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 border border-transparent dark:border-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 dark:focus:border-blue-500 outline-none transition-colors"
                  />

                  <input
                    type="email"
                    id="signup-email"
                    name="email"
                    aria-label="Email address"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full mb-4 px-4 py-3 rounded-lg bg-gray-100 dark:bg-slate-950 text-gray-950 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 border border-transparent dark:border-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 dark:focus:border-blue-500 outline-none transition-colors"
                  />

                  <input
                    type="text"
                    id="signup-company"
                    name="companyName"
                    aria-label="Company name"
                    placeholder="Company Name"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                    className="w-full mb-4 px-4 py-3 rounded-lg bg-gray-100 dark:bg-slate-950 text-gray-950 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 border border-transparent dark:border-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 dark:focus:border-blue-500 outline-none transition-colors"
                  />

                  <input
                    type="password"
                    id="signup-password"
                    name="password"
                    aria-label="Password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full mb-4 px-4 py-3 rounded-lg bg-gray-100 dark:bg-slate-950 text-gray-950 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 border border-transparent dark:border-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 dark:focus:border-blue-500 outline-none transition-colors"
                  />

                  {password && passwordStrength && (
                    <div className="mb-4 text-left">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-gray-500 dark:text-slate-455">Password Strength:</span>
                        <span className={`text-xs font-bold ${
                          passwordStrength.score < 2 ? 'text-red-500' :
                          passwordStrength.score === 2 ? 'text-yellow-500' :
                          passwordStrength.score === 3 ? 'text-blue-500' : 'text-green-500'
                        }`}>
                          {passwordStrength.score === 0 && 'Very Weak'}
                          {passwordStrength.score === 1 && 'Weak'}
                          {passwordStrength.score === 2 && 'Fair'}
                          {passwordStrength.score === 3 && 'Good'}
                          {passwordStrength.score === 4 && 'Strong'}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${
                            passwordStrength.score < 2 ? 'bg-red-500' :
                            passwordStrength.score === 2 ? 'bg-yellow-500' :
                            passwordStrength.score === 3 ? 'bg-blue-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${(passwordStrength.score + 1) * 20}%` }}
                        />
                      </div>
                      {passwordStrength.feedback.suggestions.length > 0 && (
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1 leading-normal">
                          💡 {passwordStrength.feedback.suggestions[0]}
                        </p>
                      )}
                    </div>
                  )}

                  {error && (
                    <p className="text-red-500 text-xs mb-4">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 cursor-pointer hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition mb-5 text-center disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                  >
                    {loading ? 'Creating Account...' : 'Create Account'}
                  </button>
                </form>

                <div className="flex items-center gap-3 mb-5">
                  <div className="flex-1 h-px bg-gray-200 dark:bg-slate-800" />
                  <span className="text-xs text-gray-500 dark:text-slate-500 font-semibold">
                    OR
                  </span>
                  <div className="flex-1 h-px bg-gray-200 dark:bg-slate-800" />
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    disabled
                    aria-label="Sign up with Google"
                    className="flex-1 border cursor-pointer border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-200 py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-slate-600 hover:shadow transition disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                  >
                    <GoogleIcon />
                    Google (unavailable)
                  </button>

                  <button
                    onClick={onGitHubClick}
                    disabled={loading}
                    aria-label="Sign up with GitHub"
                    className="flex-1 border cursor-pointer border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-200 py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-slate-600 hover:shadow transition disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                  >
                    <GitHubIcon />
                    GitHub
                  </button>
                </div>

                <p className="text-center text-sm text-gray-600 dark:text-slate-400 mt-6">
                  {activeTab === 'login'
                    ? "Don't have an account?"
                    : 'Already have an account?'}
                  {/* Fixed: Replaced anchor with button for valid semantics (Issue #660) */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab(activeTab === 'login' ? 'signup' : 'login');
                      resetFormState();
                    }}
                    className="ml-1 font-bold text-brand-600 dark:text-brand-400 hover:underline focus:outline-none focus:ring-2 focus:ring-brand-500 rounded"
                  >
                    {activeTab === 'login' ? 'Sign Up' : 'Login'}
                  </button>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
