const https = require('https');
const ExchangeRate = require('../models/exchangeRate.model');
const logger = require('../utils/logger');

/**
 * Fetches exchange rates from a primary API (Frankfurter).
 */
function fetchFromFrankfurter() {
  return new Promise((resolve, reject) => {
    const url = 'https://api.frankfurter.app/latest?from=USD';
    const request = https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const parsed = JSON.parse(data);
            resolve({
              baseCurrency: parsed.amount ? 'USD' : parsed.base || 'USD',
              rates: parsed.rates,
              date: new Date(parsed.date || Date.now()),
            });
            return;
          }
          reject(new Error(`Frankfurter API returned status code ${res.statusCode}`));
        } catch (error) {
          reject(new Error(`Failed to parse Frankfurter response: ${error.message}`));
        }
      });
    });

    request.on('error', (error) => reject(error));
    request.setTimeout(5000, () => {
      request.destroy();
      reject(new Error('Frankfurter API timeout'));
    });
  });
}

/**
 * Fetches exchange rates from secondary API (OpenExchangeRates)
 */
function fetchFromOpenExchangeRates() {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.OXR_API_KEY;
    if (!apiKey) {
      return reject(new Error('OXR_API_KEY not configured'));
    }
    const url = `https://openexchangerates.org/api/latest.json?app_id=${apiKey}&base=USD`;
    const request = https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const parsed = JSON.parse(data);
            resolve({
              baseCurrency: parsed.base || 'USD',
              rates: parsed.rates,
              date: new Date(parsed.timestamp ? parsed.timestamp * 1000 : Date.now()),
            });
            return;
          }
          reject(new Error(`OpenExchangeRates API returned status code ${res.statusCode}`));
        } catch (error) {
          reject(new Error(`Failed to parse OpenExchangeRates response: ${error.message}`));
        }
      });
    });

    request.on('error', (error) => reject(error));
    request.setTimeout(5000, () => {
      request.destroy();
      reject(new Error('OpenExchangeRates API timeout'));
    });
  });
}

/**
 * Orchestrates fetching exchange rates across providers.
 */
async function fetchRatesFromApi() {
  try {
    return await fetchFromFrankfurter();
  } catch (frankfurterError) {
    logger.warn('Primary FX provider (Frankfurter) failed. Trying secondary.', { error: frankfurterError.message });
    try {
      return await fetchFromOpenExchangeRates();
    } catch (oxrError) {
      logger.error('Secondary FX provider (OpenExchangeRates) failed.', { error: oxrError.message });
      throw new Error('All FX providers failed to fetch fresh exchange rates.');
    }
  }
}

/**
 * Daily cron job runner that fetches exchange rates and updates the DB.
 */
async function runForexSyncJob() {
  logger.info('Starting daily exchange rate sync job...');
  try {
    const { baseCurrency, rates, date } = await fetchRatesFromApi();
    
    // Normalize date to midnight UTC
    const normalizedDate = new Date(date);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    const exchangeRate = await ExchangeRate.findOneAndUpdate(
      { date: normalizedDate },
      { baseCurrency, rates },
      { upsert: true, new: true }
    );

    logger.info('Daily exchange rates synchronized successfully.', { date: normalizedDate });
    return exchangeRate;
  } catch (error) {
    logger.error('Failed to run forex sync job:', { error: error.message });
    throw error;
  }
}

module.exports = { runForexSyncJob, fetchRatesFromApi };
