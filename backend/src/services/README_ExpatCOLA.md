# Expatriate Cost of Living Allowance (COLA) and Housing Differential Engine

This module models global mobility compensation adjustments, spendable income curves, destination price indices, and housing norm differentials.

## Core Capabilities

1. **Spendable Income Curve Application**:
   - Isolates spendable income from fixed savings and taxes (`Base Salary * Spendable %`).
   - Applies the destination city price index ratio (`Index / 100`).

2. **Housing Differential Norms**:
   - Computes location-specific housing excess: `max(0, Host Housing Norm - Home Housing Norm)`.

3. **Hardship Allowance Multipliers**:
   - Adds hardship percentages (0% to 50%) for designated remote or high-difficulty international assignments.

## Mathematical Formulation

```
Spendable Income = Base Salary * Spendable%
COLA = Spendable Income * max(0, (Price Index - 100) / 100)
Housing Diff = max(0, Host Housing Norm - Home Housing Norm)
Hardship = Base Salary * Hardship%
Total Monthly Expat Allowance = COLA + Housing Diff + Hardship
Gross Expat Compensation = Base Salary + Total Monthly Expat Allowance
```

## API Specifications

- `POST /api/expat-cola/preview`: Simulate mobility package breakdowns.
- `POST /api/expat-cola/settings`: Save city-pair index tables and housing norms.
- `GET /api/expat-cola/settings`: List configured global mobility indices.