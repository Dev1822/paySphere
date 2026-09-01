/**
 * @fileoverview Local Tax & Reciprocity Constants
 * @description Defines municipal tax types, reciprocity frameworks (e.g., PA Act 32), 
 * and jurisdiction conflict rules for local income tax withholding.
 * Issue: #2062
 */

/**
 * Local Tax Types
 */
const LOCAL_TAX_TYPES = {
    EIT: 'Earned Income Tax (EIT)',
    LST: 'Local Services Tax (LST)',
    SCHOOL_DISTRICT: 'School District Income Tax',
    COMMUTER_TAX: 'Commuter/Municipal Income Tax'
};

/**
 * Reciprocity Frameworks
 */
const RECIPROCITY_FRAMEWORKS = {
    NONE: 'No Reciprocity (Double Taxation Possible)',
    PA_ACT_32: 'PA Act 32 (Resident vs Non-Resident EIT)',
    OH_SCHOOL_DISTRICT: 'Ohio School District (Residence Based)',
    NY_YONKERS: 'NY Yonkers (Resident/Non-Resident Surcharge)',
    NYC: 'NYC (Resident/Non-Resident Tax)'
};

/**
 * Standard Municipality FIPS/PSD Codes (Mock Data)
 */
const MUNICIPALITY_CODES = {
    '5101000': { name: 'Philadelphia, PA', state: 'PA', type: 'EIT' },
    '5102000': { name: 'Pittsburgh, PA', state: 'PA', type: 'EIT' },
    '4718000': { name: 'Columbus, OH', state: 'OH', type: 'COMMUTER_TAX' },
    '3651000': { name: 'New York City, NY', state: 'NY', type: 'NYC' },
    '3684000': { name: 'Yonkers, NY', state: 'NY', type: 'NY_YONKERS' }
};

/**
 * Conflict Resolution Rules
 */
const CONFLICT_RESOLUTION = {
    RESIDENT_HIGHER: 'Withhold Non-Resident to Work City. Employee owes difference to Home City.',
    NON_RESIDENT_HIGHER: 'Withhold Work City rate. No credit applied to Home City.',
    FULL_CREDIT: 'Withhold Work City rate. Full credit applied against Home City liability.'
};

module.exports = {
    LOCAL_TAX_TYPES,
    RECIPROCITY_FRAMEWORKS,
    MUNICIPALITY_CODES,
    CONFLICT_RESOLUTION
};
