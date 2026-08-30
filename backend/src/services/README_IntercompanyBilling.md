# Cross-Entity Intercompany Shared Services Payroll Billing & Transfer Pricing Engine

This module allocates centralized shared-service payroll expenditures to global subsidiaries with OECD-compliant arm's length transfer pricing markups.

## Core Capabilities

1. **Arm's Length Transfer Pricing Markups**:
   - Calculates customizable cost-plus markups (e.g. 5% - 10%).
   - Generates debit and credit invoice records for both entities.

2. **Cross-Border Statutory Compliance**:
   - Maintains immutable billing voucher records with sending/receiving entity metadata.
   - Provides audit trails for cross-border corporate tax and transfer pricing audits.

## Mathematical Formulation

```
Direct Cost Subtotal = Direct Labor + Allocated Benefits
Markup Amount = Direct Cost Subtotal * (Transfer Pricing Markup % / 100)
Total Intercompany Billed = Direct Cost Subtotal + Markup Amount
```

## API Specifications

- `POST /api/intercompany-billing/preview`: Simulate transfer pricing markup allocations.
- `POST /api/intercompany-billing/vouchers`: Create draft intercompany billing voucher.
- `GET /api/intercompany-billing/vouchers`: Filter and list cross-entity billing records.
- `PUT /api/intercompany-billing/vouchers/:id/approve`: Gated finance approval.