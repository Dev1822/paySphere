/**
 * @fileoverview Document Request Utility Functions Unit Tests
 */

const {
  VALID_TRANSITIONS,
  CATEGORY_META,
  validateTransition,
  generateRequestNumber,
  calculateExpectedDeliveryDate,
  calculateBusinessDaysElapsed,
  getSLAStatus,
  validateFieldValues,
  formatRequestSummary,
  checkForEscalation,
} = require('../docRequest.utils');

describe('Document Request Utilities', () => {
  // ─── validateTransition ────────────────────────────────────────────

  describe('validateTransition', () => {
    it('should allow valid transitions', () => {
      const result = validateTransition('Draft', 'Submitted');
      expect(result.allowed).toBe(true);
    });

    it('should allow Submitted → ManagerReview', () => {
      const result = validateTransition('Submitted', 'ManagerReview');
      expect(result.allowed).toBe(true);
    });

    it('should allow ManagerReview → ManagerApproved', () => {
      const result = validateTransition('ManagerReview', 'ManagerApproved');
      expect(result.allowed).toBe(true);
    });

    it('should allow ManagerReview → ManagerRejected', () => {
      const result = validateTransition('ManagerReview', 'ManagerRejected');
      expect(result.allowed).toBe(true);
    });

    it('should allow ManagerApproved → HRReview', () => {
      const result = validateTransition('ManagerApproved', 'HRReview');
      expect(result.allowed).toBe(true);
    });

    it('should allow HRReview → HRApproved', () => {
      const result = validateTransition('HRReview', 'HRApproved');
      expect(result.allowed).toBe(true);
    });

    it('should allow HRReview → HRRejected', () => {
      const result = validateTransition('HRReview', 'HRRejected');
      expect(result.allowed).toBe(true);
    });

    it('should allow Processing → Delivered', () => {
      const result = validateTransition('Processing', 'Delivered');
      expect(result.allowed).toBe(true);
    });

    it('should reject invalid transitions', () => {
      const result = validateTransition('Draft', 'Delivered');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Cannot transition');
    });

    it('should reject Delivered → anything', () => {
      const result = validateTransition('Delivered', 'Submitted');
      expect(result.allowed).toBe(false);
    });

    it('should reject Cancelled → anything', () => {
      const result = validateTransition('Cancelled', 'Submitted');
      expect(result.allowed).toBe(false);
    });

    it('should handle unknown status', () => {
      const result = validateTransition('UnknownStatus', 'Submitted');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Unknown current status');
    });
  });

  // ─── generateRequestNumber ─────────────────────────────────────────

  describe('generateRequestNumber', () => {
    it('should generate correct format', () => {
      const num = generateRequestNumber(42, new Date(2026, 7, 15));
      expect(num).toBe('DOC-202608-0042');
    });

    it('should pad sequence to 4 digits', () => {
      const num = generateRequestNumber(1, new Date(2026, 0, 1));
      expect(num).toBe('DOC-202601-0001');
    });

    it('should handle large sequence numbers', () => {
      const num = generateRequestNumber(9999, new Date(2026, 11, 31));
      expect(num).toBe('DOC-202612-9999');
    });

    it('should use current date when no date provided', () => {
      const num = generateRequestNumber(1);
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      expect(num).toBe(`DOC-${year}${month}-0001`);
    });
  });

  // ─── calculateExpectedDeliveryDate ─────────────────────────────────

  describe('calculateExpectedDeliveryDate', () => {
    it('should skip weekends', () => {
      // Friday + 3 business days = Tuesday (skip Sat/Sun)
      const friday = new Date(2026, 7, 28); // Aug 28, 2026 is a Friday
      const result = calculateExpectedDeliveryDate(friday, 3);
      expect(result.getDay()).toBe(2); // Tuesday
    });

    it('should handle 1 business day', () => {
      const monday = new Date(2026, 7, 31); // Aug 31, 2026 is a Monday
      const result = calculateExpectedDeliveryDate(monday, 1);
      expect(result.getDay()).toBe(1); // Tuesday
    });

    it('should handle starting on weekend', () => {
      const saturday = new Date(2026, 8, 5); // Sep 5, 2026 is Saturday
      const result = calculateExpectedDeliveryDate(saturday, 2);
      expect(result.getDay()).not.toBe(0); // Not Sunday
      expect(result.getDay()).not.toBe(6); // Not Saturday
    });

    it('should handle 0 TAT days', () => {
      const date = new Date(2026, 7, 28);
      const result = calculateExpectedDeliveryDate(date, 0);
      expect(result.getTime()).toBe(date.getTime());
    });
  });

  // ─── calculateBusinessDaysElapsed ──────────────────────────────────

  describe('calculateBusinessDaysElapsed', () => {
    it('should count only business days', () => {
      // Mon to Fri = 4 business days
      const monday = new Date(2026, 7, 31);
      const friday = new Date(2026, 8, 4);
      const result = calculateBusinessDaysElapsed(monday, friday);
      expect(result).toBe(4);
    });

    it('should exclude weekends', () => {
      // Friday to next Monday = 1 business day
      const friday = new Date(2026, 7, 28);
      const monday = new Date(2026, 8, 1);
      const result = calculateBusinessDaysElapsed(friday, monday);
      expect(result).toBe(1);
    });

    it('should return 0 for same day', () => {
      const date = new Date(2026, 7, 28);
      const result = calculateBusinessDaysElapsed(date, new Date(date));
      expect(result).toBe(0);
    });
  });

  // ─── getSLAStatus ──────────────────────────────────────────────────

  describe('getSLAStatus', () => {
    it('should return Completed for delivered requests', () => {
      const result = getSLAStatus(new Date(), 'Delivered');
      expect(result.slaStatus).toBe('Completed');
      expect(result.isOverdue).toBe(false);
    });

    it('should return Completed for signed requests', () => {
      const result = getSLAStatus(new Date(), 'Signed');
      expect(result.slaStatus).toBe('Completed');
    });

    it('should return Completed for cancelled requests', () => {
      const result = getSLAStatus(new Date(), 'Cancelled');
      expect(result.slaStatus).toBe('Completed');
    });

    it('should return Overdue when past expected date', () => {
      const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const result = getSLAStatus(pastDate, 'Processing');
      expect(result.slaStatus).toBe('Overdue');
      expect(result.isOverdue).toBe(true);
      expect(result.daysRemaining).toBeLessThan(0);
    });

    it('should return DueToday when expected date is today', () => {
      const today = new Date();
      today.setHours(23, 59, 59);
      const result = getSLAStatus(today, 'HRReview');
      expect(result.slaStatus).toBe('DueToday');
      expect(result.daysRemaining).toBe(0);
    });

    it('should return AtRisk when 1-2 days remaining', () => {
      const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      const result = getSLAStatus(future, 'Processing');
      expect(result.slaStatus).toBe('AtRisk');
    });

    it('should return OnTrack for more than 2 days remaining', () => {
      const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      const result = getSLAStatus(future, 'Processing');
      expect(result.slaStatus).toBe('OnTrack');
    });

    it('should return Unknown when no expected date', () => {
      const result = getSLAStatus(null, 'Processing');
      expect(result.slaStatus).toBe('Unknown');
    });
  });

  // ─── validateFieldValues ───────────────────────────────────────────

  describe('validateFieldValues', () => {
    const fields = [
      { fieldName: 'purpose', fieldLabel: 'Purpose', fieldType: 'text', isOptional: false },
      { fieldName: 'copies', fieldLabel: 'Number of Copies', fieldType: 'select', options: ['1', '2', '3'], isOptional: false },
      { fieldName: 'notes', fieldLabel: 'Additional Notes', fieldType: 'textarea', isOptional: true },
    ];

    it('should pass with all required fields', () => {
      const result = validateFieldValues(fields, {
        purpose: 'Bank loan',
        copies: '2',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when required field is missing', () => {
      const result = validateFieldValues(fields, {
        copies: '2',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"Purpose" is required');
    });

    it('should fail when select value is not in options', () => {
      const result = validateFieldValues(fields, {
        purpose: 'Bank loan',
        copies: '5',
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('must be one of');
    });

    it('should pass when optional field is missing', () => {
      const result = validateFieldValues(fields, {
        purpose: 'Bank loan',
        copies: '1',
      });
      expect(result.valid).toBe(true);
    });

    it('should pass with empty fields array', () => {
      const result = validateFieldValues([], {});
      expect(result.valid).toBe(true);
    });

    it('should pass with null fields', () => {
      const result = validateFieldValues(null, {});
      expect(result.valid).toBe(true);
    });
  });

  // ─── formatRequestSummary ──────────────────────────────────────────

  describe('formatRequestSummary', () => {
    it('should format request summary', () => {
      const request = {
        _id: 'r1',
        requestNumber: 'DOC-202608-0001',
        urgency: 'Normal',
        status: 'Submitted',
        createdAt: new Date('2026-08-28'),
        expectedDeliveryDate: new Date('2026-09-02'),
        notes: 'Need for bank loan',
        fieldValues: { category: 'Employment' },
      };

      const summary = formatRequestSummary(request, 'John Doe', 'Experience Letter');
      expect(summary.employee).toBe('John Doe');
      expect(summary.document).toBe('Experience Letter');
      expect(summary.requestNumber).toBe('DOC-202608-0001');
    });
  });

  // ─── checkForEscalation ────────────────────────────────────────────

  describe('checkForEscalation', () => {
    it('should escalate when past threshold', () => {
      const request = {
        expectedDeliveryDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        status: 'Processing',
      };
      const result = checkForEscalation(request, 2);
      expect(result.shouldEscalate).toBe(true);
      expect(result.daysOverdue).toBeGreaterThanOrEqual(5);
    });

    it('should not escalate when within threshold', () => {
      const request = {
        expectedDeliveryDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        status: 'Processing',
      };
      const result = checkForEscalation(request, 2);
      expect(result.shouldEscalate).toBe(false);
    });

    it('should not escalate completed requests', () => {
      const request = {
        expectedDeliveryDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        status: 'Delivered',
      };
      const result = checkForEscalation(request, 2);
      expect(result.shouldEscalate).toBe(false);
    });

    it('should not escalate when no expected date', () => {
      const request = {
        expectedDeliveryDate: null,
        status: 'Processing',
      };
      const result = checkForEscalation(request, 2);
      expect(result.shouldEscalate).toBe(false);
    });
  });

  // ─── Constants ─────────────────────────────────────────────────────

  describe('VALID_TRANSITIONS', () => {
    it('should have entries for all statuses', () => {
      const statuses = [
        'Draft', 'Submitted', 'ManagerReview', 'ManagerApproved',
        'ManagerRejected', 'HRReview', 'HROnHold', 'HRApproved',
        'HRRejected', 'Processing', 'ReadyForSignature', 'Signed',
        'Delivered', 'Cancelled', 'Expired',
      ];
      for (const status of statuses) {
        expect(VALID_TRANSITIONS[status]).toBeDefined();
      }
    });

    it('should have empty transitions for terminal states', () => {
      expect(VALID_TRANSITIONS.Delivered).toHaveLength(0);
      expect(VALID_TRANSITIONS.Cancelled).toHaveLength(0);
      expect(VALID_TRANSITIONS.Expired).toHaveLength(0);
    });
  });

  describe('CATEGORY_META', () => {
    it('should have metadata for all categories', () => {
      const categories = ['Employment', 'Compensation', 'Tax', 'Legal', 'Immigration', 'Custom'];
      for (const cat of categories) {
        expect(CATEGORY_META[cat]).toBeDefined();
        expect(CATEGORY_META[cat].label).toBeTruthy();
        expect(CATEGORY_META[cat].icon).toBeTruthy();
        expect(CATEGORY_META[cat].description).toBeTruthy();
      }
    });
  });
});
