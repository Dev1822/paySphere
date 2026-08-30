# Performance Share Units (PSU) Valuation Engine

This module provides Relative Total Shareholder Return (TSR) benchmark analysis and dynamic multiplier curve calculations for executive performance equity awards.

## Core Capabilities

1. **Relative TSR Ranking**:
   - Quantifies Total Shareholder Return: `((Final Price - Baseline Price) / Baseline Price) * 100`.
   - Computes statistical percentile ranking of company equity returns against an index/peer set.

2. **Non-Linear Vesting Multiplier Curves**:
   - Below 25th percentile: 0% payout (0.0x multiplier).
   - 25th percentile (Threshold): 50% payout (0.5x multiplier).
   - 50th percentile (Median Target): 100% payout (1.0x multiplier).
   - 75th percentile and above (Maximum Stretch): 200% payout (2.0x multiplier).

3. **Settlement Share Generation**:
   - Multiplies granted target units by dynamic vesting multiplier and rounds down to the nearest integer share.

## Mathematical Formulation

```
TSR_i = ((P_final,i - P_base,i) / P_base,i) * 100
Percentile Rank = (N_below + 0.5 * N_equal) / Total * 100
Vesting Multiplier = f(Percentile Rank) in [0.0, 2.0]
Final Shares = floor(Target Shares * Vesting Multiplier)
```

## API Specifications

- `POST /api/psu/grants`: Register new executive performance equity award with peer group tickers.
- `GET /api/psu/grants`: List and filter active grants.
- `POST /api/psu/grants/:id/evaluate`: Submit performance close prices, calculate TSR percentile rank, and finalize shares vested.