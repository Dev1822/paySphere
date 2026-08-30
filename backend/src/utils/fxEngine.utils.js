/**
 * @fileoverview FX Engine Utilities
 * @description Calculates base-currency liabilities, manages rate expirations, 
 * and determines FX gain/loss upon settlement.
 * Issue: #1568
 */

/**
 * Calculates the base currency liability using a locked exchange rate.
 * @param {number} foreignAmount 
 * @param {number} exchangeRate - Base currency per 1 unit of foreign currency (e.g., 1.15)
 * @returns {number} Base currency amount
 */
function calculateBaseLiability(foreignAmount, exchangeRate) {
    return Math.round(foreignAmount * exchangeRate * 100) / 100;
}

/**
 * Checks if an exchange rate lock has expired.
 * @param {Date} lockExpiresAt 
 * @param {Date} currentDate 
 * @returns {boolean}
 */
function isRateExpired(lockExpiresAt, currentDate) {
    return new Date(currentDate) > new Date(lockExpiresAt);
}

/**
 * Calculates the FX Gain or Loss upon actual settlement.
 * 
 * @param {number} foreignAmount 
 * @param {number} lockedRate 
 * @param {number} actualSettlementRate 
 * @returns {{ lockedBase: number, actualBase: number, variance: number, type: string }}
 */
function calculateFXVariance(foreignAmount, lockedRate, actualSettlementRate) {
    const lockedBase = calculateBaseLiability(foreignAmount, lockedRate);
    const actualBase = calculateBaseLiability(foreignAmount, actualSettlementRate);

    // Variance = Actual Cost - Locked Cost
    // If Actual Cost > Locked Cost, it's a Loss (we paid more base currency)
    // If Actual Cost < Locked Cost, it's a Gain (we paid less base currency)
    const variance = Math.round((actualBase - lockedBase) * 100) / 100;

    const type = variance > 0 ? 'Loss' : variance < 0 ? 'Gain' : 'None';

    return {
        lockedBase,
        actualBase,
        variance: Math.abs(variance),
        type
    };
}

module.exports = { calculateBaseLiability, isRateExpired, calculateFXVariance };
