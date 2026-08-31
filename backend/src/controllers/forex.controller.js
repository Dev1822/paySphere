/**
 * @fileoverview Forex Reconciliation Report Controller
 * @description Computes variance between payroll run conversion rates and current market rates.
 * Issue: #1844
 */
const PayrollUpdate = require('../models/payroll.model');
const ExchangeRate = require('../models/exchangeRate.model');

/**
 * Exposes a reconciliation report showing forex conversion variance.
 * Variance shows the difference between the conversion rate applied at run time
 * vs the latest exchange rate from the market.
 */
exports.getReconciliationReport = async (req, res, next) => {
  try {
    const { month, year } = req.query;

    const query = {};
    if (month) query.month = parseInt(month, 10);
    if (year) query.year = parseInt(year, 10);

    const [payrolls, latestRateDoc] = await Promise.all([
      PayrollUpdate.find(query).lean(),
      ExchangeRate.findOne().sort({ date: -1 }).lean(),
    ]);

    const fallbackRates = {
      EUR: 0.92,
      GBP: 0.79,
      INR: 83.5,
      CAD: 1.36,
      AUD: 1.51,
      JPY: 155.2,
      SGD: 1.34,
      USD: 1.0,
    };

    const getLatestRate = (currency) => {
      const cur = (currency || 'USD').toUpperCase();
      if (cur === 'USD') return 1.0;
      if (latestRateDoc && latestRateDoc.rates) {
        if (latestRateDoc.rates instanceof Map) {
          return latestRateDoc.rates.get(cur) || fallbackRates[cur] || 1.0;
        }
        return latestRateDoc.rates[cur] || fallbackRates[cur] || 1.0;
      }
      return fallbackRates[cur] || 1.0;
    };

    const report = payrolls.map((row) => {
      const target = row.targetCurrency || row.currency || 'USD';
      const histRate = row.exchangeRate || 1.0;
      const currentRate = getLatestRate(target);

      const netSalary = row.netSalary || 0;
      const histConverted = row.convertedNetSalary || (netSalary / histRate);
      const currentConverted = netSalary / currentRate;

      // Variance is conversion value delta
      const variance = Math.round((histConverted - currentConverted) * 100) / 100;

      return {
        payrollId: row._id,
        employeeName: row.employeeName,
        month: row.month,
        year: row.year,
        targetCurrency: target,
        baseCurrency: row.baseCurrency || 'USD',
        netSalary,
        historicalExchangeRate: histRate,
        currentExchangeRate: currentRate,
        historicalConvertedNetSalary: Math.round(histConverted * 100) / 100,
        currentConvertedNetSalary: Math.round(currentConverted * 100) / 100,
        variance,
      };
    });

    res.status(200).json({
      success: true,
      baseCurrency: 'USD',
      data: report,
    });
  } catch (error) {
    next(error);
  }
};
