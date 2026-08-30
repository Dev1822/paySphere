# Statutory Severance and Retrenchment Relief Engine

This module provides compliant severance package modeling, statutory retrenchment formula automation, and tax relief spreading.

## Core Capabilities

1. **Statutory Retrenchment Formulas**:
   - Calculates 15 days average pay per completed year of continuous service using standard 26-working-day daily rates (`Monthly Basic / 26`).
   - Computes pro-rated notice period payouts and accrued leave encashment.

2. **Statutory Tax Relief (Section 10(10C) & Section 89)**:
   - Evaluates statutory exemption ceilings (e.g. up to $500,000 / ₹5,00,000 for qualifying VRS schemes).
   - Computes multi-year progressive tax bracket spreads to prevent excessive tax withholding on lump sum retrenchment settlements.

3. **Settlement Approval Gates**:
   - Requires explicit two-step approval before final disbursement and ledger posting.

## Statutory Retrenchment Formulas

```
Daily Wage Rate = Monthly Salary / 26
Statutory Retrenchment Pay = 15 * Daily Wage Rate * Completed Years
Notice Pay = (Monthly Salary / 30) * Notice Days
Gross Severance = Statutory Retrenchment + Notice Pay + Voluntary Ex-Gratia + Leave Encashment
Taxable Severance = max(0, Gross Severance - Statutory Exemption Cap)
Section 89 Relief = Taxable Severance * Marginal Spread Differential
```

## API Specifications

- `POST /api/severance/preview`: Simulate severance payouts with parameter inputs.
- `POST /api/severance/packages`: Create an immutable severance package proposal.
- `GET /api/severance/packages`: Filter and inspect created severance packages.
- `PUT /api/severance/packages/:id/approve`: Gated HR manager approval.
- `POST /api/severance/packages/:id/disburse`: Trigger disbursement to settlement register.