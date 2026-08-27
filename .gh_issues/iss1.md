## Summary
Executive compensation frequently includes Nonqualified Deferred Compensation (NQDC) plans governed by IRC Section 409A (or international equivalents). These plans allow top-tier executives to defer base salary and annual performance bonuses into phantom accounts with customized investment benchmarking and scheduled future distribution tranches.

## Problem Statement
1. **No Deferred Compensation Ledger**: PaySphere currently treats all salary and bonuses as immediately taxable and payable in the active pay period.
2. **Missing 409A Timing & Tax Split Rules**: FICA/social security taxes are due at the time of deferral (when vested), while income taxes must only be withheld at distribution.
3. **No Phantom Growth Valuation**: Executives select phantom benchmark return rates (e.g. S&P 500 or fixed hurdle rates) which require compounding balance calculations.

## Proposed Implementation

### Backend
- **`deferredCompensation.model.js` (New)**: Stores executive deferral elections, phantom benchmark return benchmarks, accumulated balances, and scheduled distribution tranches.
- **`deferredCompensation.service.js` (New)**: Implements quarterly interest compounding, calculates FICA tax liability at deferral vs income tax at distribution, and enforces 409A distribution timing guardrails.
- **`deferredCompensation.controller.js` (New)**: Endpoints to record deferral elections, run interest accruals, and schedule distribution tranches.
- **`deferredCompensation.routes.js` (New)**: Mounted under `/api/deferred-compensation`.
- **`deferredCompensation.test.js` (New)**: Unit tests for tax splitting and compounding calculations.
- **`README_DeferredCompensation.md` (New)**: Technical specifications and accounting guide.

## Files Affected
- `backend/src/models/deferredCompensation.model.js` (New)
- `backend/src/services/deferredCompensation.service.js` (New)
- `backend/src/controllers/deferredCompensation.controller.js` (New)
- `backend/src/routes/deferredCompensation.routes.js` (New)
- `backend/src/__tests__/deferredCompensation.test.js` (New)
- `backend/src/services/README_DeferredCompensation.md` (New)
- `backend/src/app.js` (Modified)
