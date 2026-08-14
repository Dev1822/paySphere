/**
 * @fileoverview Section 194C & 194J Statutory Contractor & Professional TDS Engine
 * @description Implements statutory withholding logic for Indian Income Tax Act Sections 194C and 194J,
 * cumulative threshold tracking (₹30k single / ₹1L aggregate), 20% penalty rates for missing/invalid PAN,
 * and Form 16A quarterly certificate ledger aggregation.
 */

'use strict';

const mongoose = require('mongoose');
const { VendorInvoice } = require('../models/vendor.model');

/**
 * Validates if a PAN is structurally valid (AAAAA1234A format).
 * @param {string} pan 
 * @returns {boolean}
 */
function isValidPAN(pan) {
  if (!pan || typeof pan !== 'string') return false;
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return panRegex.test(pan.trim().toUpperCase());
}

/**
 * Calculates TDS for a specific vendor invoice under Section 194C or 194J.
 * 
 * Rules:
 * Section 194C:
 * 1. Single invoice > 30,000 OR aggregate FY > 1,00,000 -> TDS applies.
 * 2. Rate: 1% for Individual/HUF, 2% for Company/Firm/Others.
 * 3. Missing/invalid PAN -> 20% penalty rate (Section 206AA).
 * 
 * Section 194J:
 * 1. Aggregate FY > 30,000 -> TDS applies.
 * 2. Rate: 2% for Technical services/Royalty, 10% for Professional services.
 * 3. Missing/invalid PAN -> 20% penalty rate.
 * 
 * @param {Object} vendor - The Vendor document
 * @param {number} grossAmount - The current invoice gross amount
 * @param {number} financialYear - The FY start year (e.g. 2024 for FY 2024-25)
 * @param {string} tenantId 
 * @param {string} [section='194C'] - '194C' | '194J'
 * @returns {Promise<{ tdsRate: number, tdsAmount: number, netPayable: number, thresholdBreached: boolean, section: string }>}
 */
async function calculateTDS(vendor, grossAmount, financialYear, tenantId, section = '194C') {
  const numericAmount = Number(grossAmount) || 0;
  let currentAggregate = 0;

  try {
    const tenantObjId = mongoose.Types.ObjectId.isValid(tenantId)
      ? new mongoose.Types.ObjectId(tenantId)
      : tenantId;

    const aggregateResult = await VendorInvoice.aggregate([
      {
        $match: {
          tenantId: tenantObjId,
          vendorId: vendor._id,
          financialYear,
        },
      },
      { $group: { _id: null, totalGross: { $sum: '$grossAmount' } } },
    ]);

    currentAggregate = aggregateResult.length > 0 ? Number(aggregateResult[0].totalGross) : 0;
  } catch {
    currentAggregate = 0;
  }

  const projectedAggregate = currentAggregate + numericAmount;
  let thresholdBreached = false;
  let tdsRate = 0;

  const validPan = isValidPAN(vendor.pan);

  if (section === '194J') {
    // Section 194J: Professional/Technical threshold is ₹30,000 aggregate in a financial year
    thresholdBreached = projectedAggregate > 30000;
    if (!thresholdBreached) {
      return { tdsRate: 0, tdsAmount: 0, netPayable: numericAmount, thresholdBreached: false, section };
    }

    if (!validPan) {
      tdsRate = 20;
    } else if (vendor.vendorType === 'Technical/Royalty') {
      tdsRate = 2;
    } else {
      tdsRate = 10; // Standard 194J professional rate
    }
  } else {
    // Section 194C: Contractor single ₹30,000 or annual aggregate ₹1,00,000
    const singleThreshold = 30000;
    const aggregateThreshold = 100000;
    thresholdBreached = numericAmount > singleThreshold || projectedAggregate > aggregateThreshold;

    if (!thresholdBreached) {
      return { tdsRate: 0, tdsAmount: 0, netPayable: numericAmount, thresholdBreached: false, section: '194C' };
    }

    if (!validPan) {
      tdsRate = 20;
    } else if (vendor.vendorType === 'Individual/HUF') {
      tdsRate = 1;
    } else {
      tdsRate = 2;
    }
  }

  const tdsAmount = Math.round((numericAmount * tdsRate) / 100);
  const netPayable = numericAmount - tdsAmount;

  return {
    tdsRate,
    tdsAmount,
    netPayable,
    thresholdBreached: true,
    section,
  };
}

/**
 * Backward-compatible helper for 194C.
 */
async function calculateTDS194C(vendor, grossAmount, financialYear, tenantId) {
  return calculateTDS(vendor, grossAmount, financialYear, tenantId, '194C');
}

/**
 * Aggregates vendor invoices into quarterly Form 16A certificate breakdowns.
 * Indian Fiscal Year: Q1 (Apr-Jun), Q2 (Jul-Sep), Q3 (Oct-Dec), Q4 (Jan-Mar).
 *
 * @param {Array<object>} invoices
 * @param {number} financialYear
 * @returns {object}
 */
function aggregateForm16AQuarterly(invoices = [], financialYear) {
  const quarters = {
    Q1: { quarter: 'Q1 (Apr-Jun)', grossAmount: 0, tdsDeducted: 0, netPaid: 0, invoiceCount: 0 },
    Q2: { quarter: 'Q2 (Jul-Sep)', grossAmount: 0, tdsDeducted: 0, netPaid: 0, invoiceCount: 0 },
    Q3: { quarter: 'Q3 (Oct-Dec)', grossAmount: 0, tdsDeducted: 0, netPaid: 0, invoiceCount: 0 },
    Q4: { quarter: 'Q4 (Jan-Mar)', grossAmount: 0, tdsDeducted: 0, netPaid: 0, invoiceCount: 0 },
  };

  let totalGross = 0;
  let totalTds = 0;

  for (const inv of invoices) {
    if (financialYear && inv.financialYear && inv.financialYear !== financialYear) continue;

    const date = new Date(inv.invoiceDate || inv.createdAt);
    const month = date.getMonth(); // 0-11

    let qKey = 'Q4';
    if (month >= 3 && month <= 5) qKey = 'Q1';
    else if (month >= 6 && month <= 8) qKey = 'Q2';
    else if (month >= 9 && month <= 11) qKey = 'Q3';

    const gross = Number(inv.grossAmount || 0);
    const tds = Number(inv.tdsAmount || 0);
    const net = Number(inv.netPayable || gross - tds);

    quarters[qKey].grossAmount += gross;
    quarters[qKey].tdsDeducted += tds;
    quarters[qKey].netPaid += net;
    quarters[qKey].invoiceCount++;

    totalGross += gross;
    totalTds += tds;
  }

  return {
    financialYear: financialYear || new Date().getFullYear(),
    totalGross: Math.round(totalGross * 100) / 100,
    totalTds: Math.round(totalTds * 100) / 100,
    totalNetPaid: Math.round((totalGross - totalTds) * 100) / 100,
    quarters,
  };
}

module.exports = {
  isValidPAN,
  calculateTDS,
  calculateTDS194C,
  aggregateForm16AQuarterly,
};
