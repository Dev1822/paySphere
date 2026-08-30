# Fringe Benefit Tax (FBT) Gross-Up & Valuation Engine

This module provides statutory gross-up calculations, employee non-cash perk logging, and quarterly employer FBT liability reports.

## Core Capabilities

1. **Dual Gross-Up Multiplier Modes**:
   - **Type 1 (GST-Creditable)**: `2.0802` standard statutory gross-up factor.
   - **Type 2 (GST-Free)**: `1.8868` standard gross-up factor.

2. **Employee Contribution Offsetting**:
   - Deducts employee cash payments or salary sacrifice from raw perk values to calculate net taxable benefit.

3. **Quarterly FBT Returns**:
   - Aggregates liabilities across housing, company cars, soft loans, and meal perks for fiscal returns.

## Mathematical Formulation

```
Net Taxable Value = max(0, Raw Benefit - Employee Contribution)
Grossed-Up Value = Net Taxable Value * Gross-Up Multiplier
Employer FBT Liability = Grossed-Up Value * (FBT Rate % / 100)
```

## API Specifications

- `POST /api/fringe-benefits/preview`: Simulate FBT gross-up and tax liabilities.
- `POST /api/fringe-benefits/records`: Log perk transaction under an employee.
- `GET /api/fringe-benefits/records`: Filter active benefit entries.
- `GET /api/fringe-benefits/quarterly-report`: Generate consolidated quarterly tax returns.