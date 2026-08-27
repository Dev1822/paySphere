## Summary
Multi-national enterprises deploying employees on global mobility assignments (expatriates) require automated Cost of Living Allowance (COLA) and Housing Differential calculation engines. These adjust spendable income based on destination city price indices and provide localized housing allowances.

## Problem Statement
1. **Manual Mobility Calculations**: Expat allowances are frequently calculated in ad-hoc spreadsheets, causing pricing index mismatch.
2. **No Spendable Income Tier Modeling**: COLA must only apply to the spendable portion of salary (typically 30%-50% depending on gross income tier), not the entire base pay.
3. **No Hardship & Housing Differentials**: Remote/host locations require location hardship percentage uplifts and statutory housing excess deductions.

## Proposed Implementation

### Backend
- **`expatColaSetting.model.js` (New)**: Stores location pair index tables, spendable income salary tier curves, housing allowance brackets, and hardship percentage uplifts.
- **`expatColaCalculator.service.js` (New)**: Computes home spendable income, applies destination COLA indices, calculates housing excess differentials, and applies hardship percentages.
- **`expatCola.controller.js` (New)**: Endpoints to manage COLA matrices, preview allowance calculations, and generate expat payroll supplements.
- **`expatCola.routes.js` (New)**: Mounted under `/api/expat-cola`.
- **`expatCola.test.js` (New)**: Unit tests for spendable income curve evaluation and differential math.
- **`README_ExpatCOLA.md` (New)**: Architecture documentation.

## Files Affected
- `backend/src/models/expatColaSetting.model.js` (New)
- `backend/src/services/expatColaCalculator.service.js` (New)
- `backend/src/controllers/expatCola.controller.js` (New)
- `backend/src/routes/expatCola.routes.js` (New)
- `backend/src/__tests__/expatCola.test.js` (New)
- `backend/src/services/README_ExpatCOLA.md` (New)
- `backend/src/app.js` (Modified)
