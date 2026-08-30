/**
 * @fileoverview Tests for the document vault utility functions.
 */

const {
  validateFileUpload,
  computeExpiryDate,
  checkDocumentExpiry,
  checkDocumentAccess,
  findExpiringDocuments,
  computeVaultMetrics,
  complianceReport,
} = require('../../utils/documentVaultUtils');

describe('documentVaultUtils', () => {
  describe('validateFileUpload', () => {
    const category = {
      allowedExtensions: ['pdf', 'jpg', 'png'],
      maxFileSizeMB: 5,
    };

    test('validates correct file', () => {
      const result = validateFileUpload(
        { originalname: 'doc.pdf', size: 1024 * 1024 },
        category,
      );
      expect(result.valid).toBe(true);
    });

    test('rejects wrong extension', () => {
      const result = validateFileUpload(
        { originalname: 'doc.exe', size: 1024 },
        category,
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('.exe');
    });

    test('rejects oversized file', () => {
      const result = validateFileUpload(
        { originalname: 'big.pdf', size: 10 * 1024 * 1024 },
        category,
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds');
    });

    test('rejects null file', () => {
      expect(validateFileUpload(null, category).valid).toBe(false);
    });
  });

  describe('computeExpiryDate', () => {
    test('computes expiry from validity days', () => {
      const result = computeExpiryDate(new Date('2026-08-25'), 365);
      expect(result.getFullYear()).toBe(2027);
      expect(result.getMonth()).toBe(7); // August
    });

    test('returns null for no validity', () => {
      expect(computeExpiryDate(new Date(), 0)).toBeNull();
      expect(computeExpiryDate(new Date(), null)).toBeNull();
    });
  });

  describe('checkDocumentExpiry', () => {
    test('detects expired document', () => {
      const doc = { expiresAt: new Date('2026-01-01'), status: 'Active' };
      const result = checkDocumentExpiry(doc, new Date('2026-08-25'));
      expect(result.expired).toBe(true);
    });

    test('returns days remaining for valid doc', () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 15);
      const result = checkDocumentExpiry({ expiresAt, status: 'Active' });
      expect(result.expired).toBe(false);
      expect(result.daysRemaining).toBe(15);
    });

    test('returns null days for no expiry', () => {
      const result = checkDocumentExpiry({ expiresAt: null, status: 'Active' });
      expect(result.expired).toBe(false);
      expect(result.daysRemaining).toBeNull();
    });
  });

  describe('checkDocumentAccess', () => {
    const doc = { employeeId: 'emp1', sharedWith: [] };
    const category = { visibility: 'Employee' };

    test('owner always has access', () => {
      const result = checkDocumentAccess(
        { _id: 'emp1' },
        doc,
        category,
        'View',
      );
      expect(result.allowed).toBe(true);
    });

    test('admin has access to admin category', () => {
      const adminCat = { visibility: 'Admin' };
      const result = checkDocumentAccess(
        { _id: 'user2', role: 'ADMIN' },
        { ...doc, employeeId: 'emp1' },
        adminCat,
        'View',
      );
      expect(result.allowed).toBe(true);
    });

    test('non-owner denied without share', () => {
      const result = checkDocumentAccess(
        { _id: 'user3' },
        doc,
        category,
        'View',
      );
      expect(result.allowed).toBe(false);
    });

    test('shared user has access', () => {
      const sharedDoc = {
        ...doc,
        sharedWith: [{ userId: 'user4', permission: 'View' }],
      };
      const result = checkDocumentAccess(
        { _id: 'user4' },
        sharedDoc,
        category,
        'View',
      );
      expect(result.allowed).toBe(true);
    });

    test('shared user denied for wrong action', () => {
      const sharedDoc = {
        ...doc,
        sharedWith: [{ userId: 'user4', permission: 'View' }],
      };
      const result = checkDocumentAccess(
        { _id: 'user4' },
        sharedDoc,
        category,
        'Edit',
      );
      expect(result.allowed).toBe(false);
    });
  });

  describe('findExpiringDocuments', () => {
    test('finds documents expiring within horizon', () => {
      const docs = [
        { _id: '1', expiresAt: new Date('2026-09-01'), status: 'Active' },
        { _id: '2', expiresAt: new Date('2026-12-01'), status: 'Active' },
      ];
      const result = findExpiringDocuments(docs, 30, new Date('2026-08-25'));
      expect(result.length).toBe(1);
      expect(result[0].document._id).toBe('1');
    });

    test('skips archived documents', () => {
      const docs = [
        { _id: '1', expiresAt: new Date('2026-09-01'), status: 'Archived' },
      ];
      const result = findExpiringDocuments(docs, 30, new Date('2026-08-25'));
      expect(result.length).toBe(0);
    });
  });

  describe('computeVaultMetrics', () => {
    test('computes metrics correctly', () => {
      const docs = [
        {
          _id: '1',
          status: 'Active',
          fileSize: 1024,
          categoryId: 'cat1',
          downloadCount: 5,
          uploadedAt: new Date(),
        },
        {
          _id: '2',
          status: 'Expired',
          fileSize: 2048,
          categoryId: 'cat1',
          downloadCount: 2,
          uploadedAt: new Date(),
        },
      ];
      const cats = [{ _id: 'cat1', name: 'ID Proof' }];
      const metrics = computeVaultMetrics(docs, cats);
      expect(metrics.totalDocuments).toBe(2);
      expect(metrics.active).toBe(1);
      expect(metrics.expired).toBe(1);
      expect(metrics.byCategory['ID Proof'].count).toBe(2);
    });
  });

  describe('complianceReport', () => {
    test('finds employees missing required docs', () => {
      const cats = [{ _id: 'cat1', name: 'PAN Card', isRequired: true }];
      const docs = [
        { employeeId: 'emp1', categoryId: 'cat1', status: 'Active' },
      ];
      const employees = [
        { _id: 'emp1', fullName: 'Alice', department: 'Eng' },
        { _id: 'emp2', fullName: 'Bob', department: 'Sales' },
      ];
      const report = complianceReport(docs, cats, employees);
      expect(report.length).toBe(1);
      expect(report[0].employeeName).toBe('Bob');
    });

    test('returns empty when all compliant', () => {
      const cats = [{ _id: 'cat1', name: 'PAN Card', isRequired: true }];
      const docs = [
        { employeeId: 'emp1', categoryId: 'cat1', status: 'Active' },
        { employeeId: 'emp2', categoryId: 'cat1', status: 'Active' },
      ];
      const employees = [
        { _id: 'emp1', fullName: 'Alice' },
        { _id: 'emp2', fullName: 'Bob' },
      ];
      expect(complianceReport(docs, cats, employees)).toHaveLength(0);
    });
  });
});
