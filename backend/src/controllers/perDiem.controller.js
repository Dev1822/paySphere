/**
 * @fileoverview Per Diem & Travel Allowance Controller
 * @description Manages travel itinerary per diem calculations, benchmark rate catalogs,
 * and Section 10(14) tax exemption reports.
 * Issue: #1668
 */

const {
  computeItineraryDurationDays,
  calculatePerDiemEntitlementAndTax,
  aggregatePerDiemYtdTax,
  DOMESTIC_PER_DIEM_CAPS_INR,
  INTERNATIONAL_PER_DIEM_CAPS_USD,
} = require('../utils/perDiemTaxEngine.utils');
const logger = require('../utils/logger');

// In-memory or database-backed travel per diem disbursements
const recordedTravelDisbursements = [];

/**
 * POST /api/per-diem/calculate-itinerary
 * Calculates per diem entitlement, tax-exempt ceiling, and taxable excess for a trip.
 */
async function calculateItinerary(req, res, next) {
  try {
    const {
      employeeId,
      tripId,
      destinationType = 'DOMESTIC',
      locationCode = 'TIER_1_METRO',
      departureDateTime,
      arrivalDateTime,
      disbursedDailyRate,
      fxRateToInr = 83.5,
    } = req.body;

    if (!employeeId || !departureDateTime || !arrivalDateTime) {
      return res.status(400).json({
        success: false,
        message: 'employeeId, departureDateTime, and arrivalDateTime are required',
      });
    }

    const duration = computeItineraryDurationDays(departureDateTime, arrivalDateTime);
    const defaultRate = destinationType === 'INTERNATIONAL' ? 120 : 3500;
    const dailyRate = disbursedDailyRate !== undefined ? Number(disbursedDailyRate) : defaultRate;

    const calculation = calculatePerDiemEntitlementAndTax(
      destinationType,
      locationCode,
      duration.billableDays,
      dailyRate,
      Number(fxRateToInr),
    );

    const disbursementRecord = {
      disbursementId: `PER-DIEM-${Date.now()}`,
      employeeId: String(employeeId),
      tripId: tripId || `TRIP-${Date.now()}`,
      departureDateTime,
      arrivalDateTime,
      durationHours: duration.totalHours,
      createdAt: new Date().toISOString(),
      ...calculation,
    };

    recordedTravelDisbursements.push(disbursementRecord);

    return res.status(200).json({
      success: true,
      data: disbursementRecord,
    });
  } catch (error) {
    logger.error('Error calculating itinerary per diem:', error);
    return next(error);
  }
}

/**
 * GET /api/per-diem/rates
 * Returns benchmark statutory per diem caps.
 */
async function getPerDiemRates(req, res, next) {
  try {
    return res.status(200).json({
      success: true,
      data: {
        domesticCapsINR: DOMESTIC_PER_DIEM_CAPS_INR,
        internationalCapsUSD: INTERNATIONAL_PER_DIEM_CAPS_USD,
      },
    });
  } catch (error) {
    logger.error('Error fetching per diem rates:', error);
    return next(error);
  }
}

/**
 * GET /api/per-diem/travel-tax-summary/:employeeId
 * Fetches YTD travel disbursements and taxable perquisite additions for payroll.
 */
async function getTravelTaxSummary(req, res, next) {
  try {
    const { employeeId } = req.params;
    const employeeTrips = recordedTravelDisbursements.filter(
      (d) => String(d.employeeId) === String(employeeId),
    );

    const summary = aggregatePerDiemYtdTax(employeeTrips);

    return res.status(200).json({
      success: true,
      data: {
        employeeId,
        ...summary,
        trips: employeeTrips,
      },
    });
  } catch (error) {
    logger.error('Error fetching travel tax summary:', error);
    return next(error);
  }
}

module.exports = {
  calculateItinerary,
  getPerDiemRates,
  getTravelTaxSummary,
  recordedTravelDisbursements,
};
