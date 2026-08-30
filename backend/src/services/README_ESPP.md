# Employee Share Purchase Plan (ESPP) Engine

This module implements qualified Section 423 Employee Share Purchase Plan (ESPP) accounting, valuation, and payroll integrations.

## Core Features

1. **Section 423 Lookback Rule**:
   - Compares the stock Fair Market Value (FMV) on the **Offering Date (Grant Price)** versus the **Purchase Date Price**.
   - Applies the statutory 15% discount to whichever price is lower (`min(grantPrice, purchasePrice)`).

2. **Perquisite Compensation Tax Calculation**:
   - Calculates the discount spread on the purchase date: `(FMV on purchase date - final purchase price) * sharesPurchased`.
   - Surfaces perquisite values for payroll tax withholding.

3. **Residual Fund Management**:
   - Computes whole integer shares purchasable and calculates unspent residual balances.
   - Automatically rolls over residual funds to the next enrollment period.

## Mathematical Formulation

```
Lookback Price = min(P_grant, P_purchase)
Final Purchase Price = Lookback Price * (1 - Discount)
Shares Purchased = floor(Accumulated Funds / Final Purchase Price)
Total Cost = Shares Purchased * Final Purchase Price
Residual Rollover = Accumulated Funds - Total Cost
Taxable Perquisite = (P_purchase - Final Purchase Price) * Shares Purchased
```

## API Specifications

- `POST /api/espp/enroll`: Enroll employee with a contribution cap (1% - 15%).
- `GET /api/espp/enrollments`: Fetch current active enrollments with accumulated balances.
- `POST /api/espp/preview`: Dry-run calculation for lookback price and share outputs.
- `POST /api/espp/purchase-run`: Execute batch purchase and update accumulated payroll pools.
- `GET /api/espp/transactions`: Historical purchase logs and share certificates ledger.