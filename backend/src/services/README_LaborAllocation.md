# Activity-Based Labor Cost Allocation Ledger

This module splits employee payroll expenditures across project codes, R&D tax credit buckets, and cost centers proportional to logged timesheet hours.

## Core Capabilities

1. **Hourly Ratio Allocation**:
   - Computes dynamic ratio: `Hours_project / Total_Hours`.
   - Distributes base compensation, overtime, employer payroll tax liabilities, and benefits.

2. **Multi-Project Journal Entries**:
   - Produces granular accounting journal vouchers (`LaborCostJournal`) ready for enterprise ERP export.

## Formulation

```
Ratio_k = Hours_k / sum(Hours_i)
Allocated Base_k = Gross Salary * Ratio_k
Allocated Tax_k = Employer Tax * Ratio_k
Allocated Benefits_k = Benefits Cost * Ratio_k
Total Allocated Cost_k = sum(Components_k)
```

## API Specifications

- `POST /api/labor-allocation/rules`: Setup default project allocation splits.
- `GET /api/labor-allocation/rules`: Retrieve active allocation configurations.
- `POST /api/labor-allocation/distribute`: Process timesheet distributions and record voucher ledger lines.
- `GET /api/labor-allocation/journal`: Query project-specific cost vouchers.