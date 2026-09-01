# Payroll Calculation Determinism & Reconciliation

## Overview

This implementation introduces a **deterministic reconciliation service** that independently recalculates finalized payroll and verifies consistency with stored results. The system identifies component-level differences, ensuring payroll integrity and compliance.

## Problem Statement

Payroll calculations depend on multiple input components (attendance, overtime, leave, bonuses, deductions, tax). A small change in any calculation stage can silently produce different final amounts. Without verification, discrepancies may go unnoticed until audit time.

**Issue**: #1990 - Payroll calculations depend on multiple inputs but lack deterministic verification

## Solution Architecture

### Core Components

#### 1. **PayrollDeterminismService**
File: `backend/src/services/PayrollDeterminismService.js`

**Responsibilities**:
- Independently recalculate payroll from input data
- Compare stored vs. calculated results at component level
- Report first inconsistent component found
- Ensure deterministic rounding using Decimal.js

**Key Methods**:
```javascript
recalculatePayroll(inputData)  // Returns component breakdown
reconcilePayroll(storedPayroll, inputData)  // Compares and reports mismatches
```

**Rounding Strategy**:
- Uses `Decimal.js` library with ROUND_HALF_UP strategy
- All currency values rounded to 2 decimal places
- Ensures identical results for identical inputs

#### 2. **PayrollReconciliationController**
File: `backend/src/controllers/payrollReconciliation.controller.js`

**Endpoints**:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/verify/:payrollId` | POST | Verify single payroll determinism |
| `/batch` | POST | Batch reconcile multiple payrolls |
| `/history` | GET | Get reconciliation history |
| `/:reconciliationId/resolve` | PATCH | Resolve/approve reconciliation |

#### 3. **PayrollReconciliation Model**
File: `backend/src/models/payrollReconciliation.model.js`

**Schema**:
- Tracks verification status per payroll
- Stores component-level differences
- Audit trail with user tracking
- Resolution workflow support

### Calculation Components

PayrollDeterminismService validates these components in order:

1. **Gross Salary** - Base salary amount
2. **Overtime** - Calculated from hours × rate
3. **Bonuses** - Bonus amounts
4. **Deductions** - Leave deductions + other deductions
5. **Tax Components** - Tax rate applied to taxable amount
6. **Net Salary** - Final amount (gross + overtime + bonuses - deductions - tax)

## Implementation Details

### Determinism Features

#### ✅ Component-Level Reporting
Reports the first mismatched component rather than just total mismatch:
```javascript
{
  isConsistent: false,
  mismatchedComponent: 'overtime',
  differences: {
    component: 'overtime',
    stored: 749.99,
    calculated: 750.00,
    variance: { absolute: '0.01', percentage: '0.00%' }
  }
}
```

#### ✅ Precise Rounding
Uses Decimal.js to prevent floating-point errors:
```javascript
// ROUND_HALF_UP strategy
75.33 × 10.5 = 790.965 → rounds to 790.97
1666.666 × 3 = 4999.998 → rounds to 5000.00
```

#### ✅ Tolerance-Based Comparison
Allows 1 cent (0.01) tolerance for legitimate rounding differences:
```javascript
Math.abs(stored - calculated) < 0.01  // Within tolerance
```

#### ✅ Read-Only Verification
Reconciliation does NOT modify payroll data:
- Only records findings in audit log
- Resolution requires explicit approval
- Full audit trail maintained

### Input Data Preservation

Each payroll must store input metadata for reconciliation:
```javascript
{
  baseSalary: 50000,
  dailyRate: 1666.67,
  leaveDays: 1,
  overtimeHours: 5,
  overtimeRate: 75,
  bonuses: 500,
  deductions: 200,
  taxRate: 12
}
```

## API Usage

### Single Payroll Verification

```bash
POST /api/payroll-reconciliation/verify/{payrollId}
Authorization: Bearer {token}
```

**Response (Consistent)**:
```json
{
  "isConsistent": true,
  "message": "Payroll is deterministically consistent",
  "reconciliation": {
    "_id": "...",
    "status": "verified",
    "verifiedBy": {...},
    "verifiedAt": "2024-01-15T10:30:00Z"
  }
}
```

**Response (Mismatch)**:
```json
{
  "isConsistent": false,
  "message": "Component-level mismatch detected: overtime",
  "reconciliation": {
    "_id": "...",
    "status": "mismatch_detected",
    "mismatchedComponent": "overtime",
    "differences": {
      "component": "overtime",
      "stored": 749.99,
      "calculated": 750.00,
      "variance": { "absolute": "0.01", "percentage": "0.00%" }
    }
  }
}
```

### Batch Reconciliation

```bash
POST /api/payroll-reconciliation/batch
Content-Type: application/json
Authorization: Bearer {token}

{
  "payrollIds": ["id1", "id2", "id3"]
}
```

**Response**:
```json
{
  "message": "Batch reconciliation completed",
  "results": {
    "total": 3,
    "consistent": 2,
    "inconsistent": 1,
    "errors": 0,
    "mismatches": [
      {
        "payrollId": "id2",
        "mismatchedComponent": "netSalary",
        "differences": {...}
      }
    ]
  }
}
```

### Get History

```bash
GET /api/payroll-reconciliation/history?payrollId={payrollId}
Authorization: Bearer {token}
```

### Resolve Reconciliation

```bash
PATCH /api/payroll-reconciliation/{reconciliationId}/resolve
Content-Type: application/json
Authorization: Bearer {token}

{
  "resolution": "approved",
  "notes": "Verified payroll correctness through manual review"
}
```

## Test Coverage

Comprehensive test suite covers:

### Rounding Boundaries
- ✅ Gross salary rounding (.005 edge case)
- ✅ Overtime with fractional hours/rates
- ✅ Leave deduction rounding (recurring decimals)
- ✅ Tax component rounding
- ✅ Cumulative rounding effects on net salary

### Component-Level Reconciliation
- ✅ Perfect match scenarios
- ✅ First mismatch detection in each component
- ✅ Tolerance handling (±0.01)
- ✅ Variance calculation accuracy

### Edge Cases
- ✅ Zero values
- ✅ Negative deductions (credits)
- ✅ Very large salary amounts
- ✅ Missing input data
- ✅ Invalid stored format

### Determinism Verification
- ✅ Identical inputs → identical outputs
- ✅ Order independence of calculations

**Run Tests**:
```bash
npm test -- payroll-determinism.test.js
```

## Database Migrations

### Payroll Model Updates

Add metadata fields to store input data:
```javascript
// In Payroll model schema
dailyRate: Number,
leaveDays: Number,
overtimeHours: Number,
overtimeRate: Number,
taxRate: Number,
// Store components for reconciliation
components: {
  grossSalary: Number,
  overtime: Number,
  bonuses: Number,
  deductions: Number,
  taxComponents: {},
  netSalary: Number
}
```

### PayrollReconciliation Collection

Created new collection with schema (see model file).

## Configuration

### Environment Variables

```bash
# Decimal.js precision for payroll calculations
PAYROLL_PRECISION=10

# Reconciliation tolerance (in cents)
RECONCILIATION_TOLERANCE=1

# Auto-archive old reconciliation records after (days)
RECONCILIATION_ARCHIVE_DAYS=90
```

### Permissions Required

- `payroll:verify` - To run reconciliation
- `payroll:view` - To view reconciliation history
- `payroll:approve` - To resolve reconciliations

## Acceptance Criteria - Fulfilled

✅ **A finalized payroll can be independently reconciled**
- `recalculatePayroll()` method independently recalculates from inputs
- No dependency on original calculation system

✅ **Component-level differences are reported**
- Returns first mismatched component
- Includes stored vs. calculated values
- Shows variance statistics

✅ **Reconciliation does not modify payroll data**
- Only creates audit records
- Read-only verification
- Explicit approval required for corrections

✅ **Identical inputs produce identical calculation results**
- Verified by determinism tests
- Decimal.js ensures precision
- ROUND_HALF_UP strategy is consistent

✅ **Rounding behavior is deterministic**
- All values rounded to 2 decimal places consistently
- ROUND_HALF_UP ensures same result for same input
- Test cases cover rounding boundaries

✅ **Tests cover rounding boundaries and mismatched components**
- 25+ test cases
- Tests for .005 rounding edge case
- Component mismatch detection for each type
- Variance calculation tests

## Backward Compatibility

Legacy methods preserved:
- `reconcileAnomaly()` - Old anomaly reconciliation
- `getReconciliations()` - Old query method

Routes support both old and new endpoints.

## Future Enhancements

1. **Automated Scheduling**
   - Run batch reconciliation on monthly finalization
   - Schedule daily verification for recent payrolls

2. **Analytics**
   - Dashboard showing reconciliation status by department
   - Variance trends over time
   - Common mismatch patterns

3. **Correction Workflow**
   - Automated correction for known patterns
   - Adjustment approval process
   - Re-verification after correction

4. **Integration**
   - Webhook notifications for mismatches
   - Integration with compliance reporting
   - Export reconciliation reports

## Troubleshooting

### Common Issues

**Issue**: Payroll fails reconciliation with 0.01 variance
**Solution**: This is within tolerance and expected due to rounding. Verify calculation method hasn't changed.

**Issue**: Tax components showing mismatch
**Solution**: Ensure tax rate and base calculation rules haven't changed. Check for any updates to tax calculation logic.

**Issue**: Batch reconciliation times out
**Solution**: Process in smaller batches (e.g., 100 payrolls at a time) or schedule as background job.

## Support

For issues or questions:
1. Check reconciliation history for patterns
2. Review test cases for expected behavior
3. Verify input data is stored correctly in payroll records
4. Contact: [support team]

## References

- Issue #1990: Payroll Calculation Determinism
- Decimal.js Documentation: https://mikemcl.github.io/decimal.js/
- Rounding Strategies: https://en.wikipedia.org/wiki/Rounding