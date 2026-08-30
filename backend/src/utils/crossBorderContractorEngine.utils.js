/**
 * @fileoverview Cross-Border Contractor Multi-Currency Retainer & Withholding Tax Engine
 * @description Computes multi-currency FX spot conversions, international withholding taxes
 * (IRS W-8BEN/W-9 treaties, Section 195 TDS), and digital tax certificates (Form 16A / 1099-NEC).
 * Issue: #1648
 */

const crypto = require('crypto');

const STATUTORY_TAX_RATES = {
  W8BEN_CERTIFIED: 0,           // 0% for certified foreign contractor services performed outside US
  W9_US_RESIDENT: 0,            // 0% standard withholding (subject to annual Form 1099-NEC filing)
  NON_RESIDENT_UNSPECIFIED: 30, // 30% IRS default non-resident alien withholding
  FOREIGN_SECTION_195: 20,      // 20% Indian Section 195 foreign enterprise TDS
  CUSTOM_TREATY: 10,           // 10% DTAA bilateral double taxation treaty rate
};

/**
 * Calculates dual-currency retainer payout and statutory withholding tax.
 *
 * @param {number} invoiceAmount - Retainer amount in invoice currency
 * @param {string} invoiceCurrency - Currency of the invoice (e.g. 'USD', 'EUR', 'GBP')
 * @param {string} payoutCurrency - Settlement currency (e.g. 'INR', 'EUR', 'USD')
 * @param {number} fxRate - Foreign exchange spot conversion rate
 * @param {keyof STATUTORY_TAX_RATES} taxStatus - Contractor tax certification status
 * @param {number} customTreatyRate - Custom treaty rate if applicable
 * @returns {{ invoiceAmount: number, invoiceCurrency: string, payoutCurrency: string, fxRate: number, convertedGrossPayout: number, effectiveTaxRate: number, withholdingTaxAmount: number, netSettlementAmount: number }}
 */
function computeContractorPayoutWithholding(
  invoiceAmount,
  invoiceCurrency = 'USD',
  payoutCurrency = 'INR',
  fxRate = 83.5,
  taxStatus = 'W8BEN_CERTIFIED',
  customTreatyRate = null,
) {
  const safeInvoice = Math.max(0, Number(invoiceAmount) || 0);
  const safeRate = Math.max(0.000001, Number(fxRate) || 1);

  let effectiveTaxRate = STATUTORY_TAX_RATES[taxStatus] !== undefined
    ? STATUTORY_TAX_RATES[taxStatus]
    : STATUTORY_TAX_RATES.NON_RESIDENT_UNSPECIFIED;

  if (taxStatus === 'CUSTOM_TREATY' && customTreatyRate !== null) {
    effectiveTaxRate = Math.max(0, Math.min(100, Number(customTreatyRate) || 0));
  }

  const convertedGrossPayout = Math.round(safeInvoice * safeRate * 100) / 100;
  const withholdingTaxAmount = Math.round(((convertedGrossPayout * effectiveTaxRate) / 100) * 100) / 100;
  const netSettlementAmount = Math.round((convertedGrossPayout - withholdingTaxAmount) * 100) / 100;

  return {
    invoiceAmount: safeInvoice,
    invoiceCurrency: invoiceCurrency.toUpperCase(),
    payoutCurrency: payoutCurrency.toUpperCase(),
    fxRate: safeRate,
    taxStatus,
    effectiveTaxRate,
    convertedGrossPayout,
    withholdingTaxAmount,
    netSettlementAmount,
  };
}

/**
 * Generates a tamper-evident digital withholding certificate (1099-NEC / Form 16A equivalent).
 */
function generateWithholdingCertificate(
  contractorId,
  contractorName,
  taxIdentifier,
  taxFormType,
  grossPaidUSD,
  taxWithheldUSD,
  periodYear = new Date().getFullYear(),
) {
  const certId = `CERT-TAX-${periodYear}-${contractorId}-${Date.now()}`;
  const payloadToSign = `${certId}:${contractorId}:${taxIdentifier}:${grossPaidUSD}:${taxWithheldUSD}:${periodYear}`;
  const verificationHash = crypto.createHash('sha256').update(payloadToSign).digest('hex');

  return {
    certificateId: certId,
    issuedAt: new Date().toISOString(),
    periodYear,
    contractorId,
    contractorName: contractorName || 'International Contractor',
    taxIdentifier: taxIdentifier || 'FOREIGN-NID',
    taxFormType: taxFormType || 'W-8BEN',
    totalGrossDisbursedUSD: grossPaidUSD,
    totalTaxWithheldUSD: taxWithheldUSD,
    verificationChecksum: verificationHash,
    isDigitallySigned: true,
  };
}

/**
 * Aggregates organization-wide foreign currency volume and withholding tax liability.
 */
function aggregateCrossBorderExposure(payouts = []) {
  let totalGrossUSD = 0;
  let totalWithheldUSD = 0;
  let totalNetSettledUSD = 0;
  const currencyBreakdown = {};

  for (const p of payouts) {
    const gross = Number(p.convertedGrossPayout) || Number(p.invoiceAmount) || 0;
    const withheld = Number(p.withholdingTaxAmount) || 0;
    const net = Number(p.netSettlementAmount) || (gross - withheld);
    const curr = (p.payoutCurrency || p.invoiceCurrency || 'USD').toUpperCase();

    totalGrossUSD += gross;
    totalWithheldUSD += withheld;
    totalNetSettledUSD += net;

    currencyBreakdown[curr] = (currencyBreakdown[curr] || 0) + gross;
  }

  return {
    totalPayoutRecords: payouts.length,
    totalGrossDisbursed: Math.round(totalGrossUSD * 100) / 100,
    totalTaxWithheld: Math.round(totalWithheldUSD * 100) / 100,
    totalNetSettled: Math.round(totalNetSettledUSD * 100) / 100,
    currencyBreakdown,
  };
}

module.exports = {
  STATUTORY_TAX_RATES,
  computeContractorPayoutWithholding,
  generateWithholdingCertificate,
  aggregateCrossBorderExposure,
};
