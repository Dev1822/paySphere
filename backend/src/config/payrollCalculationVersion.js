/**
 * Version of the payroll calculation rules used to produce snapshots.
 *
 * Increment this value whenever payroll calculation logic changes.
 * Keeping the version with every snapshot allows historical payrolls to remain
 * reproducible even when newer calculation rules are introduced.
 */
const PAYROLL_CALCULATION_VERSION = '1.0.0';

module.exports = { PAYROLL_CALCULATION_VERSION };