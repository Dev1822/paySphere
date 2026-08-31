/**
 * @fileoverview Workers' Compensation Constants
 * @description Defines standard NCCI class codes, state-specific overtime exclusion rules,
 * and Experience Modification Rate (EMR) thresholds for premium calculations.
 * Issue: #2061
 */

/**
 * Standard NCCI Class Codes (Mock Data)
 */
const NCCI_CLASS_CODES = {
    '8810': { description: 'Clerical Office Employees', riskFactor: 0.12, category: 'Administrative' },
    '8742': { description: 'Salespersons', riskFactor: 0.25, category: 'Sales' },
    '5403': { description: 'Carpentry', riskFactor: 4.50, category: 'Construction' },
    '5190': { description: 'Electrical Wiring', riskFactor: 3.80, category: 'Construction' },
    '8380': { description: 'Automobile Service/Repair', riskFactor: 2.90, category: 'Service' },
    '7380': { description: 'Drivers/Chauffeurs', riskFactor: 5.10, category: 'Logistics' },
    '0917': { description: 'Janitorial Services', riskFactor: 3.20, category: 'Maintenance' }
};

/**
 * State Rules for Overtime Premium Exclusion
 * In many states, the "premium" portion of overtime (the extra 0.5x) is excluded 
 * from WC remuneration calculations.
 */
const OT_EXCLUSION_STATES = {
    CA: true,  // California excludes OT premium
    NY: true,  // New York excludes OT premium
    TX: false, // Texas includes all OT
    FL: true,  // Florida excludes OT premium
    IL: true,  // Illinois excludes OT premium
    PA: true   // Pennsylvania excludes OT premium
};

/**
 * Experience Modification Rate (EMR) Thresholds
 */
const EMR_THRESHOLDS = {
    EXCELLENT: 0.85, // < 0.85 is excellent safety record
    GOOD: 1.00,      // 1.00 is industry average
    POOR: 1.15       // > 1.15 indicates poor safety/high claims
};

/**
 * Audit Risk Categories
 */
const AUDIT_RISK_LEVELS = {
    LOW: 'Low Risk (Clerical/Sales)',
    MEDIUM: 'Medium Risk (Service/Light Industrial)',
    HIGH: 'High Risk (Construction/Heavy Industrial)'
};

module.exports = {
    NCCI_CLASS_CODES,
    OT_EXCLUSION_STATES,
    EMR_THRESHOLDS,
    AUDIT_RISK_LEVELS
};
