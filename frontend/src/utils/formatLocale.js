/**
 * formatLocale.js
 *
 * Locale-aware formatting utilities for dates, times, and currencies.
 * All helpers derive the active locale from i18next so that switching
 * the app language automatically updates number/date presentation.
 *
 * Usage:
 *   import { formatDate, formatCurrency } from '../utils/formatLocale';
 *   formatDate('2024-03-15');            // → "15 Mar 2024"  (en-IN)
 *   formatCurrency(75000, 'INR');        // → "₹75,000.00"  (en-IN)
 *   // After the user switches to 'es':
 *   formatDate('2024-03-15');            // → "15 mar 2024"  (es)
 *   formatCurrency(75000, 'INR');        // → "₹75,000.00"  (es)
 */

import i18n from '../i18n/i18n';

/**
 * Returns the locale string that corresponds to the currently active
 * i18next language (e.g. 'en' → 'en', 'es' → 'es').
 * Falls back to the browser's preferred locale when i18n is not ready.
 */
export const getLocale = () =>
  i18n.language || navigator.language || 'en';

/**
 * Formats a date value to a human-readable string using the user's locale.
 *
 * @param {string|number|Date} value - The date to format.
 * @param {Intl.DateTimeFormatOptions} [options] - Override default options.
 * @returns {string} Formatted date string, or '—' for invalid input.
 */
export const formatDate = (value, options) => {
  if (value == null || value === '') return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  const defaultOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  return new Intl.DateTimeFormat(getLocale(), options ?? defaultOptions).format(date);
};

/**
 * Formats a date+time value using the user's locale.
 *
 * @param {string|number|Date} value
 * @param {Intl.DateTimeFormatOptions} [options]
 * @returns {string}
 */
export const formatDateTime = (value, options) => {
  if (value == null || value === '') return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  const defaultOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  return new Intl.DateTimeFormat(getLocale(), options ?? defaultOptions).format(date);
};

/**
 * Formats a time value (hours and minutes) using the user's locale.
 *
 * @param {string|number|Date} value
 * @param {Intl.DateTimeFormatOptions} [options]
 * @returns {string} Formatted time string, or '—' for invalid input.
 */
export const formatTime = (value, options) => {
  if (value == null || value === '') return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  const defaultOptions = {
    hour: '2-digit',
    minute: '2-digit',
  };
  return new Intl.DateTimeFormat(getLocale(), options ?? defaultOptions).format(date);
};

/**
 * Formats a currency amount using the user's locale.
 *
 * @param {number|string} amount
 * @param {string} [currencyCode='INR']
 * @param {Intl.NumberFormatOptions} [options] - Merged with currency defaults.
 * @returns {string} Formatted currency string, or '—' for invalid input.
 */
export const formatCurrency = (amount, currencyCode = 'INR', options) => {
  const num = Number(amount);
  if (!Number.isFinite(num)) return '—';

  try {
    return new Intl.NumberFormat(getLocale(), {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 2,
      ...options,
    }).format(num);
  } catch {
    // Fallback if the currency code is invalid
    return `${currencyCode} ${num.toLocaleString(getLocale())}`;
  }
};

/**
 * Formats a plain number using the user's locale.
 *
 * @param {number|string} value
 * @param {Intl.NumberFormatOptions} [options]
 * @returns {string}
 */
export const formatNumber = (value, options) => {
  if (value == null || value === '') return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return new Intl.NumberFormat(getLocale(), options).format(num);
};
