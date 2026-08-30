/**
 * @fileoverview Sick Pay Tax Engine
 * @description Calculates taxable portions of third-party disability payments based on premium splits.
 * Issue: #1868
 */

/**
 * Calculates the taxable portion of a sick pay benefit.
 * If the employer paid a portion of the premiums pre-tax, that percentage of the benefit is taxable.
 * If the employee paid 100% of premiums post-tax, the benefit is 0% taxable.
 * 
 * @param {number} grossBenefit 
 * @param {number} employerPremiumPercentage 
 * @returns {{ taxablePercentage: number, taxableAmount: number, nonTaxableAmount: number }}
 */
function calculateSickPayTaxability(grossBenefit, employerPremiumPercentage) {
    const taxablePercentage = employerPremiumPercentage;
    const taxableAmount = Math.round(grossBenefit * taxablePercentage * 100) / 100;
    const nonTaxableAmount = Math.round((grossBenefit - taxableAmount) * 100) / 100;

    return { taxablePercentage, taxableAmount, nonTaxableAmount };
}

/**
 * W-2 Integration Guardrail: Maps taxable sick pay to correct W-2 boxes.
 * @param {number} taxableAmount 
 * @param {boolean} ficaTaxable 
 * @param {number} ytdFICAWages - Current YTD Social Security/Medicare wages
 * @param {number} ficaWageBase - Annual SS wage base
 * @returns {{ box1Addition: number, box3Addition: number, box5Addition: number }}
 */
function mapToW2Boxes(taxableAmount, ficaTaxable, ytdFICAWages, ficaWageBase) {
    const box1Addition = taxableAmount; // Always added to Box 1 (Federal Wages)

    let box3Addition = 0;
    let box5Addition = 0;

    if (ficaTaxable) {
        const remainingSSCap = Math.max(0, ficaWageBase - ytdFICAWages);
        box3Addition = Math.min(taxableAmount, remainingSSCap);
        box5Addition = taxableAmount; // Medicare has no cap
    }

    return {
        box1Addition: Math.round(box1Addition * 100) / 100,
        box3Addition: Math.round(box3Addition * 100) / 100,
        box5Addition: Math.round(box5Addition * 100) / 100
    };
}

module.exports = { calculateSickPayTaxability, mapToW2Boxes };
