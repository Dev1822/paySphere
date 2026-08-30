/**
 * @fileoverview House Rent Allowance (HRA) Controller
 * @description Manages Section 10(13A) HRA tax exemption calculations,
 * rent receipt proof verification, and landlord PAN compliance.
 * Issue: #1763
 */

const {
  computeHraExemption,
  calculateAnnualHraTaxSchedule,
  validateLandlordPanCompliance,
} = require('../utils/hraExemptionEngine.utils');
const Employee = require('../models/employee.model');
const logger = require('../utils/logger');

// In-memory or database-backed active HRA tenancy declarations
const employeeHraDeclarations = new Map();
const recordedRentReceipts = [];

/**
 * POST /api/hra-exemption/calculate
 * Computes monthly or annual statutory HRA tax exemption.
 */
async function calculateHra(req, res, next) {
  try {
    const {
      employeeId,
      basicPay,
      dearnessAllowance = 0,
      actualHraReceived,
      rentPaid,
      city = 'MUMBAI',
      landlordPan,
    } = req.body;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'employeeId is required',
      });
    }

    let employee = null;
    try {
      employee = await Employee.findById(employeeId);
    } catch {
      // Mock fallback
    }

    const basic = basicPay !== undefined ? Number(basicPay) : (employee?.salaryDetails?.basic || 60000);
    const da = dearnessAllowance !== undefined ? Number(dearnessAllowance) : (employee?.salaryDetails?.da || 0);
    const hra = actualHraReceived !== undefined ? Number(actualHraReceived) : (employee?.salaryDetails?.hra || 25000);
    const rent = rentPaid !== undefined ? Number(rentPaid) : 22000;

    const calculation = computeHraExemption(basic, da, hra, rent, city, landlordPan);

    const record = {
      employeeId: String(employeeId),
      city,
      calculatedAt: new Date().toISOString(),
      ...calculation,
    };

    return res.status(200).json({
      success: true,
      data: record,
    });
  } catch (error) {
    logger.error('Error calculating HRA exemption:', error);
    return next(error);
  }
}

/**
 * POST /api/hra-exemption/submit-receipts
 * Submits rent receipts and landlord declaration for tax exemption audit.
 */
async function submitReceipts(req, res, next) {
  try {
    const {
      employeeId,
      monthlyRent,
      city = 'BANGALORE',
      landlordName,
      landlordPan,
      rentalAddress,
      receiptMonths = 12,
    } = req.body;

    if (!employeeId || !monthlyRent || !rentalAddress) {
      return res.status(400).json({
        success: false,
        message: 'employeeId, monthlyRent, and rentalAddress are required',
      });
    }

    const annualRent = Number(monthlyRent) * Number(receiptMonths);
    const panCheck = validateLandlordPanCompliance(annualRent, landlordPan);

    const declarationRecord = {
      declarationId: `HRA-DECL-${Date.now()}`,
      employeeId: String(employeeId),
      monthlyRent: Number(monthlyRent),
      annualRent,
      city,
      landlordName: landlordName || 'Landlord',
      landlordPan: landlordPan ? String(landlordPan).toUpperCase() : null,
      rentalAddress,
      panCheck,
      status: panCheck.isCompliant ? 'VERIFIED' : 'PENDING_PAN',
      submittedAt: new Date().toISOString(),
    };

    employeeHraDeclarations.set(String(employeeId), declarationRecord);
    recordedRentReceipts.push(declarationRecord);

    return res.status(201).json({
      success: true,
      message: panCheck.isCompliant
        ? 'HRA rent declaration verified and registered successfully'
        : 'Rent declaration registered. Landlord PAN is required as annual rent > ₹1,00,000.',
      data: declarationRecord,
    });
  } catch (error) {
    logger.error('Error submitting rent receipts:', error);
    return next(error);
  }
}

/**
 * GET /api/hra-exemption/summary/:employeeId
 * Retrieves annual HRA exemption projection and declaration details.
 */
async function getHraSummary(req, res, next) {
  try {
    const { employeeId } = req.params;
    const declaration = employeeHraDeclarations.get(String(employeeId)) || null;

    let employee = null;
    try {
      employee = await Employee.findById(employeeId);
    } catch {
      // Mock fallback
    }

    const basic = employee?.salaryDetails?.basic || 60000;
    const da = employee?.salaryDetails?.da || 0;
    const hra = employee?.salaryDetails?.hra || 25000;
    const rent = declaration?.monthlyRent || 20000;
    const city = declaration?.city || 'MUMBAI';
    const pan = declaration?.landlordPan || 'ABCDE1234F';

    const monthlyCalc = computeHraExemption(basic, da, hra, rent, city, pan);

    return res.status(200).json({
      success: true,
      data: {
        employeeId,
        hasDeclaration: Boolean(declaration),
        declaration,
        monthlyProjection: monthlyCalc,
        annualExemptionTotal: monthlyCalc.exemptHra * 12,
        annualTaxableHraTotal: monthlyCalc.taxableHra * 12,
      },
    });
  } catch (error) {
    logger.error('Error fetching HRA summary:', error);
    return next(error);
  }
}

module.exports = {
  calculateHra,
  submitReceipts,
  getHraSummary,
  employeeHraDeclarations,
  recordedRentReceipts,
};
