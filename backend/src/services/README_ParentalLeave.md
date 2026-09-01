# Statutory Paternity & Parental Leave Insurance Top-Up Reconciliation Engine

This module calculates employer supplemental top-up wages by offsetting expected state insurance/social security paternity benefits and auditing reconciliation clawbacks.

## Core Capabilities

1. **Wage Replacement Top-Up Math**:
   - Calculates daily regular base wage: `Monthly Salary / 22`.
   - Computes pro-rated salary for the leave period.
   - Subtracts the state statutory daily insurance allowance to derive net employer top-up.

2. **Statutory Insurance Variance Reconciliation**:
   - Compares estimated statutory benefits against actual social security fund remittances.
   - Generates reconciliation adjustment vouchers (supplementary payment or clawback).

## Mathematical Formulation

```
Daily Base Salary = Monthly Salary / 22
Pro-Rated Base = Daily Base Salary * Leave Days
Estimated State Benefit = State Daily Rate * Leave Days
Employer Top-Up Obligation = max(0, Pro-Rated Base - Estimated State Benefit)
Reconciliation Adjustment = Estimated State Benefit - Actual Benefit Received
```

## API Specifications

- `POST /api/parental-leave/preview`: Dry-run simulation of top-up obligations.
- `POST /api/parental-leave/claims`: Submit new statutory leave period top-up claim.
- `GET /api/parental-leave/claims`: Query active leave top-up vouchers.
- `POST /api/parental-leave/claims/:id/reconcile`: Post actual state insurance payouts and calculate variance.