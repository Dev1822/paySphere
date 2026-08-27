## Summary
In multiple jurisdictions, statutory paternity and parental leave benefits are partially subsidized by government social security or state disability insurance funds. Employers provide a top-up benefit to guarantee 100% regular wage replacement. The payroll engine must calculate net employer top-up liabilities by deducting statutory benefits from regular monthly salary.

## Problem Statement
1. **Manual Top-Up Calculations**: Determining the exact employer top-up amount requires factoring in state daily benefit rates and maximum statutory benefit ceilings.
2. **Missing Reconciliation & Clawback Tracking**: If a government insurance fund rejects an employee's claim or pays a different rate, the employer top-up ledger must record reconciliation adjustments.
3. **No Pro-Rated Parental Leave Ledger**: Partial-month leave cycles require pro-rated calendar day deductions and statutory benefit matching.

## Proposed Implementation

### Backend
- **`parentalLeaveClaim.model.js` (New)**: Records leave periods, statutory state benefit entitlement rates, employer top-up formulas, and claim reconciliation statuses.
- **`parentalLeaveCalculator.service.js` (New)**: Computes statutory benefit baselines, pro-rated working day deductions, net employer top-up liabilities, and adjustment clawbacks.
- **`parentalLeave.controller.js` (New)**: Endpoints to submit parental leave claims, calculate top-up breakdowns, and reconcile social security disbursements.
- **`parentalLeave.routes.js` (New)**: Mounted under `/api/parental-leave`.
- **`parentalLeave.test.js` (New)**: Unit tests for wage replacement top-up calculations and state rate offsetting.
- **`README_ParentalLeave.md` (New)**: Parental leave top-up specifications.

## Files Affected
- `backend/src/models/parentalLeaveClaim.model.js` (New)
- `backend/src/services/parentalLeaveCalculator.service.js` (New)
- `backend/src/controllers/parentalLeave.controller.js` (New)
- `backend/src/routes/parentalLeave.routes.js` (New)
- `backend/src/__tests__/parentalLeave.test.js` (New)
- `backend/src/services/README_ParentalLeave.md` (New)
- `backend/src/app.js` (Modified)
