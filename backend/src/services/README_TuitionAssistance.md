# Enterprise Tuition Reimbursement & Education Assistance (Section 127) Tracker

This module provides Section 127 educational assistance plan tracking, annual exemption cap monitoring ($5,250), and automatic taxable perquisite spillover generation.

## Core Capabilities

1. **Annual Section 127 Exemption Ceiling ($5,250)**:
   - Aggregates cumulative approved claims for the employee within the calendar/fiscal year.
   - Automatically grants tax-free reimbursement up to the remaining limit.

2. **Automated Taxable Spillover**:
   - Any dollar exceeding the annual exemption threshold is tagged as taxable compensation (`taxableSpilloverPerquisiteAmount`).
   - Surfaces taxable components for W-2 / Form 16 payroll tax withholding.

3. **Academic & Accreditation Validation**:
   - Stores institution accreditation and passing grade achievements for compliance audit trails.

## Mathematical Formulation

```
Remaining Cap = max(0, $5,250 - Prior Fiscal Claims)
Exempt Amount = min(Claimed Amount, Remaining Cap)
Taxable Spillover = Claimed Amount - Exempt Amount
```

## API Specifications

- `POST /api/tuition-assistance/preview`: Dry-run calculation of exempt vs taxable spillover splits.
- `POST /api/tuition-assistance/claims`: Submit tuition reimbursement with course details.
- `GET /api/tuition-assistance/claims`: Query historical educational assistance claims.
- `PUT /api/tuition-assistance/claims/:id/approve`: Gated HR manager approval.