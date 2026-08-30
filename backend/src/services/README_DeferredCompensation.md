# Executive Deferred Compensation Plan (Section 409A NQDC) Ledger

This module implements Section 409A Nonqualified Deferred Compensation (NQDC) plan management, tax bifurcation rules, phantom interest compounding, and distribution tranche accounting.

## Core Capabilities

1. **Tax Timing Bifurcation (FICA vs Income Tax)**:
   - FICA (Social Security & Medicare) taxes are calculated and due at the **time of deferral** once vested.
   - Federal & state income taxes are **deferred until distribution** when cash is actually disbursed.

2. **Phantom Growth Benchmark Accrual**:
   - Accounts grow using a phantom benchmark yield rate (e.g. 6.5% annual hurdle).
   - Accrues quarterly compounded growth: `Quarterly Rate = Annual Rate / 4`.

3. **Section 409A Distribution Guardrails**:
   - Manages pre-elected irrevocable distribution triggers (Fixed calendar date, separation from service, change of control).
   - Maintains multi-tranche distribution schedules.

## Mathematical Formulation

```
Principal Deferred = Gross Comp * (Deferral % / 100)
FICA Tax at Deferral = Principal Deferred * 7.65%
Quarterly Interest = Accumulated Balance * (Annual Benchmark % / 400)
Updated Balance = Accumulated Balance + Quarterly Interest
Tranche Payout = Updated Balance * (Tranche % / 100)
```

## API Specifications

- `POST /api/deferred-compensation/preview`: Dry-run calculation of deferral amounts and FICA tax obligations.
- `POST /api/deferred-compensation/plans`: Create and activate Section 409A NQDC plan with distribution tranches.
- `GET /api/deferred-compensation/plans`: Query active executive deferral accounts.
- `POST /api/deferred-compensation/plans/:id/accrue-interest`: Process quarterly phantom compounding.