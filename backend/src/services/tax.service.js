/**
 * @fileoverview Automated Statutory Tax Slab Engine & Multi-Regime Evaluator
 * @description Computes marginal tax liabilities, statutory exemptions (Standard Deduction, FICA, Section 80C),
 * regime comparisons (Old vs New Regime), and social security contributions across regions.
 */

'use strict';

const mongoose = require('mongoose');
const TaxBracket = require('../models/taxBracket.model');
const logger = require('../utils/logger');
  round2,
  taxOn,
  taxOnBonus,
  effectiveRate,
  validateSlabs,
} = require('../utils/taxCalculator');

/**
 * Standard Statutory Exemption Defaults per Region.
 */
const STATUTORY_DEFAULTS = {
  US: { standardDeduction: 14600, ficaCap: 168600, ficaRate: 7.65 },
  UK: { personalAllowance: 12570, niThreshold: 12570, niRate: 8.0 },
  IN: { standardDeduction: 75000, sec80cCap: 150000, cessRate: 4.0 },
  DEFAULT: { standardDeduction: 0, ficaRate: 0 },
};

function nothingOwed() {
  return {
    totalTax: 0,
    socialSecurity: 0,
    effectiveRate: 0,
    currency: null,
    configured: false,
    breakdown: [],
  };
}

class TaxService {
  /**
   * Tax and statutory contributions on annual gross income with regime & exemption support.
   *
   * @param {string} tenantId Company ID
   * @param {string} region Region code ('US', 'UK', 'IN', etc.)
   * @param {number} grossAnnualIncome Gross income amount
   * @param {object} [options={}] Optional parameters ({ regime: 'NEW'|'OLD', exemptions: 0 })
   * @returns {Promise<object>}
   */
  static async calculateTax(tenantId, region, grossAnnualIncome, options = {}) {
    const gross = Number(grossAnnualIncome);
    const regime = options.regime || 'NEW';
    const userExemptions = Number(options.exemptions) || 0;

    if (!Number.isFinite(gross) || gross <= 0) {
      return nothingOwed();
    }

    if (!tenantId || !mongoose.Types.ObjectId.isValid(tenantId)) {
      logger.warn('Tax calculation attempted without a valid tenant', { region });
      return nothingOwed();
    }

    const taxConfig = await TaxBracket.findOne({ tenantId, region });

    if (!taxConfig) {
      return nothingOwed();
    }

    const configErrors = validateSlabs(taxConfig.brackets);
    if (configErrors.length > 0) {
      logger.error('Tax table configuration contains errors', { tenantId: String(tenantId), region, errors: configErrors });
      return { ...nothingOwed(), configured: true, errors: configErrors };
    }

    // Apply statutory deductions based on region and regime
    const defaults = STATUTORY_DEFAULTS[region] || STATUTORY_DEFAULTS.DEFAULT;
    let stdDeduction = defaults.standardDeduction || 0;

    // Under OLD regime (e.g. IN), allow additional tax-saving exemptions (Section 80C up to cap)
    let totalDeductions = stdDeduction;
    if (regime === 'OLD') {
      const allowedSec80c = Math.min(userExemptions, defaults.sec80cCap || Infinity);
      totalDeductions += allowedSec80c;
    }

    const taxableIncome = Math.max(0, gross - totalDeductions);
    const { totalTax: incomeTax, breakdown } = taxOn(taxableIncome, taxConfig.brackets);
    
    // Support bonus withholding calculation
    const bonusIncome = Number(options.bonusIncome) || 0;
    let bonusTax = 0;
    if (bonusIncome > 0) {
      bonusTax = taxOnBonus(bonusIncome, taxableIncome, taxConfig.brackets, { 
        method: options.bonusTaxMethod || 'AGGREGATE' 
      });
    }

    const baseTax = incomeTax + bonusTax;

    // Apply health/education cess or surcharge if applicable
    const cessRate = defaults.cessRate || 0;
    const cessAmount = round2(baseTax * (cessRate / 100));
    const totalTax = round2(baseTax + cessAmount);

    const socialSecurity = round2(
      gross * ((Number(taxConfig.socialSecurityRate) || defaults.ficaRate || 0) / 100)
    );

    return {
      totalTax,
      socialSecurity,
      effectiveRate: effectiveRate(totalTax, socialSecurity, gross),
      currency: taxConfig.currency || null,
      configured: true,
      regime,
      grossIncome: gross,
      bonusIncome,
      taxableIncome,
      deductionsApplied: totalDeductions,
      breakdown,
    };
  }

  /**
   * Comparative side-by-side tax analysis across tax regimes (e.g. OLD vs NEW regime).
   *
   * @param {string} tenantId
   * @param {string} region
   * @param {number} grossAnnualIncome
   * @param {number} [userExemptions=0]
   * @returns {Promise<{oldRegime: object, newRegime: object, recommendedRegime: string, annualSavings: number}>}
   */
  static async compareTaxRegimes(tenantId, region, grossAnnualIncome, userExemptions = 0) {
    const [oldRegime, newRegime] = await Promise.all([
      this.calculateTax(tenantId, region, grossAnnualIncome, { regime: 'OLD', exemptions: userExemptions }),
      this.calculateTax(tenantId, region, grossAnnualIncome, { regime: 'NEW', exemptions: 0 }),
    ]);

    const oldTotal = oldRegime.totalTax + oldRegime.socialSecurity;
    const newTotal = newRegime.totalTax + newRegime.socialSecurity;

    const recommendedRegime = newTotal <= oldTotal ? 'NEW' : 'OLD';
    const annualSavings = round2(Math.abs(oldTotal - newTotal));

    return {
      oldRegime,
      newRegime,
      recommendedRegime,
      annualSavings,
    };
  }
}

module.exports = TaxService;
