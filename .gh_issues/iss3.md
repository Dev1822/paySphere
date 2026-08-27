## Summary
In global corporate groups, centralized shared service entities (e.g. Central Technology, Shared Finance, Legal Hubs) disburse payroll for personnel who provide services across multiple international subsidiaries. These costs must be allocated and cross-billed to destination entities with arm's length transfer pricing markups (e.g. Cost + 5-10%) for corporate tax and statutory audit compliance.

## Problem Statement
1. **No Cross-Entity Payroll Transfer Pricing**: Global organizations cannot automatically generate intercompany debit/credit accounting entries for shared employees.
2. **Missing Arm's Length Markup Automation**: OECD and local tax rules require applying justifiable transfer pricing markup percentages on shared service payroll expenses.
3. **No Intercompany Settlement Vouchers**: Finance teams lack consolidated billing reports linking original employee payroll costs to receiving subsidiary invoices.

## Proposed Implementation

### Backend
- **`intercompanyPayrollBilling.model.js` (New)**: Records sending legal entity, receiving subsidiary, cost allocation basis, transfer pricing markup percent, and intercompany invoice vouchers.
- **`intercompanyBilling.service.js` (New)**: Aggregates department employee compensation, calculates arm's length markup, and creates intercompany debit/credit journal vouchers.
- **`intercompanyBilling.controller.js` (New)**: Endpoints to generate intercompany payroll billing runs and retrieve cross-border reconciliation reports.
- **`intercompanyBilling.routes.js` (New)**: Mounted under `/api/intercompany-billing`.
- **`intercompanyBilling.test.js` (New)**: Unit tests for markup math and multi-entity allocation verification.
- **`README_IntercompanyBilling.md` (New)**: Intercompany transfer pricing documentation.

## Files Affected
- `backend/src/models/intercompanyPayrollBilling.model.js` (New)
- `backend/src/services/intercompanyBilling.service.js` (New)
- `backend/src/controllers/intercompanyBilling.controller.js` (New)
- `backend/src/routes/intercompanyBilling.routes.js` (New)
- `backend/src/__tests__/intercompanyBilling.test.js` (New)
- `backend/src/services/README_IntercompanyBilling.md` (New)
- `backend/src/app.js` (Modified)
