/**
 * @fileoverview Foreign Exchange (FX) Rate Service
 * @description Provides real-time foreign exchange rate sync, Redis caching (24h TTL),
 * multi-currency conversion, and rate locking for global payroll processing.
 */

'use strict';

const logger = require('../utils/logger');
const cacheService = require('./cache.service');
const ExchangeRate = require('../models/exchangeRate.model');

class FXService {
  /**
   * Normalize currency code to 3-letter uppercase ISO format.
   * @param {string} code
   * @returns {string}
   */
  static _normalizeCurrency(code) {
    if (!code || typeof code !== 'string') return 'USD';
    return code.trim().toUpperCase();
  }

  /**
   * Get fresh rates from the database.
   * Throws an error if rates are missing or older than 48 hours.
   */
  static async _getFreshRates() {
    const rateDoc = await ExchangeRate.findOne().sort({ date: -1 });
    const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;
    
    if (!rateDoc || !rateDoc.date || (Date.now() - new Date(rateDoc.date).getTime() > FORTY_EIGHT_HOURS)) {
      throw new Error('Fresh exchange rates are not available (rates are older than 48 hours). Please ensure the exchange rate synchronization job is running.');
    }
    
    return rateDoc;
  }

  /**
   * Get exchange rate between two currencies.
   * Uses Redis caching with a 24-hour TTL.
   *
   * @param {string} fromCurrency Base currency (e.g. 'USD')
   * @param {string} toCurrency Target currency (e.g. 'EUR')
   * @returns {Promise<number>} Exchange rate multiplier
   */
  static async getExchangeRate(fromCurrency, toCurrency) {
    const from = this._normalizeCurrency(fromCurrency);
    const to = this._normalizeCurrency(toCurrency);

    if (from === to) return 1.0;

    const cacheKey = `fx:rate:${from}:${to}`;

    try {
      // Check Redis cache first
      const cachedRate = await cacheService.get(cacheKey);
      if (cachedRate && typeof cachedRate === 'number' && !isNaN(cachedRate)) {
        return cachedRate;
      }
    } catch (err) {
      logger.warn('Redis read failed in FXService, falling back to database', { error: err.message });
    }

    // Fetch from database
    const rateDoc = await this._getFreshRates();
    
    const getRateVal = (target) => {
      if (target === 'USD') return 1.0;
      if (typeof rateDoc.rates.get === 'function') {
        return rateDoc.rates.get(target) || 1.0;
      }
      return rateDoc.rates[target] || 1.0;
    };

    const fromRateUSD = getRateVal(from);
    const toRateUSD = getRateVal(to);
    const rate = Number((toRateUSD / fromRateUSD).toFixed(6));

    try {
      // Cache rate for 24 hours.
      await cacheService.setEx(cacheKey, 86400, rate);
    } catch (err) {
      logger.warn('Redis write failed in FXService', { error: err.message });
    }

    return rate;
  }

  /**
   * Convert an amount from one currency to another.
   *
   * @param {number} amount Monetary amount
   * @param {string} fromCurrency
   * @param {string} toCurrency
   * @returns {Promise<{originalAmount: number, convertedAmount: number, fromCurrency: string, toCurrency: string, fxRate: number, timestamp: string}>}
   */
  static async convertCurrency(amount, fromCurrency, toCurrency) {
    const numAmount = Number(amount) || 0;
    const from = this._normalizeCurrency(fromCurrency);
    const to = this._normalizeCurrency(toCurrency);

    const rate = await this.getExchangeRate(from, to);
    const convertedAmount = Number((numAmount * rate).toFixed(2));

    return {
      originalAmount: numAmount,
      convertedAmount,
      fromCurrency: from,
      toCurrency: to,
      fxRate: rate,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Fetch exchange rates for a given base currency for multi-currency UI rendering.
   *
   * @param {string} baseCurrency (default 'USD')
   * @returns {Promise<{baseCurrency: string, rates: object, timestamp: string}>}
   */
  static async getRatesForBase(baseCurrency = 'USD') {
    const base = this._normalizeCurrency(baseCurrency);
    const rateDoc = await this._getFreshRates();
    
    const currencies = Array.from(rateDoc.rates.keys());
    if (!currencies.includes('USD')) currencies.push('USD');
    
    const rates = {};

    for (const curr of currencies) {
      rates[curr] = await this.getExchangeRate(base, curr);
    }

    return {
      baseCurrency: base,
      rates,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = FXService;
