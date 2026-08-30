import { describe, it, expect, beforeEach } from 'vitest';
import i18n from '../../i18n/i18n';
import {
  getLocale,
  formatDate,
  formatTime,
  formatDateTime,
  formatCurrency,
  formatNumber,
} from '../formatLocale';

describe('formatLocale utilities', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  describe('getLocale', () => {
    it('returns current i18n language', async () => {
      expect(getLocale()).toBe('en');
      await i18n.changeLanguage('es');
      expect(getLocale()).toBe('es');
      await i18n.changeLanguage('fr');
      expect(getLocale()).toBe('fr');
    });
  });

  describe('formatDate', () => {
    const testDate = '2024-03-15T10:30:00Z';

    it('formats date for English locale', async () => {
      await i18n.changeLanguage('en');
      const formatted = formatDate(testDate);
      expect(formatted).toContain('2024');
      expect(formatted).toMatch(/Mar|15/);
    });

    it('formats date for Spanish locale', async () => {
      await i18n.changeLanguage('es');
      const formatted = formatDate(testDate);
      expect(formatted).toContain('2024');
      expect(formatted.toLowerCase()).toMatch(/mar|15/);
    });

    it('formats date for French locale', async () => {
      await i18n.changeLanguage('fr');
      const formatted = formatDate(testDate);
      expect(formatted).toContain('2024');
      expect(formatted.toLowerCase()).toMatch(/mars|15/);
    });

    it('returns fallback for invalid date', () => {
      expect(formatDate(null)).toBe('—');
      expect(formatDate('')).toBe('—');
      expect(formatDate('invalid-date')).toBe('—');
    });
  });

  describe('formatTime', () => {
    it('formats time for English locale', async () => {
      await i18n.changeLanguage('en');
      // Use a local midnight + fixed minutes so we don't hit UTC/local offset issues
      const d = new Date(2024, 2, 15, 14, 45, 0); // local time 14:45
      const formatted = formatTime(d);
      expect(formatted).toMatch(/14:45|2:45/);
    });

    it('returns fallback for invalid inputs', () => {
      expect(formatTime(null)).toBe('—');
      expect(formatTime('abc')).toBe('—');
    });
  });

  describe('formatDateTime', () => {
    it('formats date and time based on active locale', async () => {
      await i18n.changeLanguage('en');
      const d = new Date(2024, 2, 15, 14, 45, 0); // local time
      const formatted = formatDateTime(d);
      expect(formatted).toContain('2024');
      expect(formatted).toMatch(/14:45|2:45/);
    });

    it('returns fallback for invalid input', () => {
      expect(formatDateTime(undefined)).toBe('—');
    });
  });

  describe('formatCurrency', () => {
    it('formats INR currency', async () => {
      await i18n.changeLanguage('en');
      const formatted = formatCurrency(75000, 'INR');
      expect(formatted).toContain('75,000');
    });

    it('formats USD currency', async () => {
      await i18n.changeLanguage('en');
      const formatted = formatCurrency(1250, 'USD');
      expect(formatted).toContain('1,250');
    });

    it('returns fallback for invalid numbers', () => {
      expect(formatCurrency('invalid')).toBe('—');
      expect(formatCurrency(NaN)).toBe('—');
    });
  });

  describe('formatNumber', () => {
    it('formats plain numbers according to locale', async () => {
      await i18n.changeLanguage('en');
      expect(formatNumber(1234567.89)).toContain('1,234,567.89');
    });

    it('returns fallback for non-finite values', () => {
      expect(formatNumber(null)).toBe('—');
      expect(formatNumber(Infinity)).toBe('—');
    });
  });
});
