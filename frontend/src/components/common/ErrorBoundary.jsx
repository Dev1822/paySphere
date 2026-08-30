import React from 'react';
import PropTypes from 'prop-types';
import * as Sentry from '@sentry/react';

/**
 * ErrorBoundary Component to catch rendering errors in React trees.
 * Catches errors during rendering, in lifecycle methods, and in constructors of the whole tree below them.
 * Handles fallback UI and logs/reports exceptions.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    // Report to Sentry with component stack
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
    });
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { level = 'page' } = this.props;

      if (level === 'widget' || level === 'section') {
        return (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 p-6 rounded-2xl text-center text-sm text-red-600 dark:text-red-400 transition-colors duration-200 h-full flex flex-col justify-center items-center">
            <div className="flex flex-col items-center gap-2">
              <svg
                className="w-8 h-8 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <p className="font-semibold">
                Something went wrong loading this {level}.
              </p>
              <button
                onClick={this.resetError}
                className="mt-2 text-xs font-semibold underline hover:text-red-700 dark:hover:text-red-300"
              >
                Try again
              </button>
            </div>
          </div>
        );
      }

      // Default Full Page Fallback UI
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col justify-center items-center p-6 text-center transition-colors duration-200">
          <div className="max-w-md w-full bg-white dark:bg-slate-800 p-8 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-950/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
              An unexpected error occurred. Please try reloading the page or
              contact support if the issue persists.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={this.resetError}
                className="w-full px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="w-full px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white rounded-lg text-sm font-semibold transition"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  fallback: PropTypes.node,
  level: PropTypes.oneOf(['page', 'section', 'widget']),
};

/**
 * Component-level localized fallback UI
 */
export function ComponentFeedbackFallback() {
  return (
    <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 p-6 rounded-2xl text-center text-sm text-red-600 dark:text-red-400 transition-colors duration-200">
      <div className="flex flex-col items-center gap-2">
        <svg
          className="w-8 h-8 text-red-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <p className="font-semibold">
          Something went wrong loading this component.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 text-xs font-semibold underline hover:text-red-700 dark:hover:text-red-300"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
