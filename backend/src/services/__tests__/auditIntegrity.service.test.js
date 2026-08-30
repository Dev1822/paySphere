/**
 * Tests for Audit Integrity Service
 * Issue #1905
 */
'use strict';

const {
  calculateRecordHash,
  addIntegrityMetadata,
  verifyRecordIntegrity,
  verifyChain
} = require('../auditIntegrity.service');
const AuditLog = require('../../models/auditLog.model');

describe('Audit Integrity Service', () => {
  const tenantId = 'test-tenant-123';
  const resourceType = 'Employee';
  const resourceId = 'emp-001';

  beforeEach(async () => {
    await AuditLog.deleteMany({});
  });

  test('should calculate consistent hash for same data', async () => {
    const recordData = {
      event: 'CREATE',
      action: 'employee.created',
      userId: 'user-123',
      resourceType: 'Employee',
      resourceId: 'emp-001',
      tenantId: 'tenant-123',
      timestamp: '2026-08-29T10:00:00Z'
    };

    const hash1 = calculateRecordHash(recordData, null);
    const hash2 = calculateRecordHash(recordData, null);

    expect(hash1).toBe(hash2);
  });

  test('should produce different hash with different previousHash', async () => {
    const recordData = {
      event: 'CREATE',
      action: 'employee.created',
      userId: 'user-123',
      resourceType: 'Employee',
      resourceId: 'emp-001',
      tenantId: 'tenant-123'
    };

    const hash1 = calculateRecordHash(recordData, null);
    const hash2 = calculateRecordHash(recordData, 'some-previous-hash');

    expect(hash1).not.toBe(hash2);
  });

  test('should verify valid record integrity', async () => {
    const recordData = {
      event: 'CREATE',
      action: 'employee.created',
      userId: 'user-123',
      resourceType,
      resourceId,
      tenantId
    };

    const withIntegrity = await addIntegrityMetadata(recordData);
    const record = await AuditLog.create(withIntegrity);

    const verification = verifyRecordIntegrity(record);

    expect(verification.valid).toBe(true);
  });

  test('should detect modified record', async () => {
    const recordData = {
      event: 'CREATE',
      action: 'employee.created',
      userId: 'user-123',
      resourceType,
      resourceId,
      tenantId
    };

    const withIntegrity = await addIntegrityMetadata(recordData);
    let record = await AuditLog.create(withIntegrity);

    // Simulate modification
    record.event = 'DELETE';
    record.markModified('event');

    const verification = verifyRecordIntegrity(record);

    expect(verification.valid).toBe(false);
  });

  test('should verify chain with multiple records', async () => {
    const createRecord = await addIntegrityMetadata({
      event: 'CREATE',
      action: 'employee.created',
      userId: 'user-123',
      resourceType,
      resourceId,
      tenantId
    });
    await AuditLog.create(createRecord);

    const updateRecord = await addIntegrityMetadata({
      event: 'UPDATE',
      action: 'employee.updated',
      userId: 'user-123',
      resourceType,
      resourceId,
      tenantId
    });
    await AuditLog.create(updateRecord);

    const verification = await verifyChain(tenantId, resourceType, resourceId);

    expect(verification.valid).toBe(true);
    expect(verification.totalRecords).toBe(2);
  });

  test('should detect broken chain from deletion', async () => {
    // Create 3 records
    const record1 = await addIntegrityMetadata({
      event: 'CREATE',
      action: 'employee.created',
      userId: 'user-123',
      resourceType,
      resourceId,
      tenantId
    });
    await AuditLog.create(record1);

    const record2 = await addIntegrityMetadata({
      event: 'UPDATE',
      action: 'employee.updated',
      userId: 'user-123',
      resourceType,
      resourceId,
      tenantId
    });
    const saved2 = await AuditLog.create(record2);

    const record3 = await addIntegrityMetadata({
      event: 'UPDATE',
      action: 'employee.updated',
      userId: 'user-123',
      resourceType,
      resourceId,
      tenantId
    });
    await AuditLog.create(record3);

    // Delete middle record
    await AuditLog.deleteOne({ _id: saved2._id });

    const verification = await verifyChain(tenantId, resourceType, resourceId);

    expect(verification.valid).toBe(false);
    expect(verification.issues.length).toBeGreaterThan(0);
  });

  test('should detect inserted record', async () => {
    // Create 2 valid records
    const record1 = await addIntegrityMetadata({
      event: 'CREATE',
      action: 'employee.created',
      userId: 'user-123',
      resourceType,
      resourceId,
      tenantId
    });
    await AuditLog.create(record1);

    const record2 = await addIntegrityMetadata({
      event: 'UPDATE',
      action: 'employee.updated',
      userId: 'user-123',
      resourceType,
      resourceId,
      tenantId
    });
    const saved2 = await AuditLog.create(record2);

    // Insert fake record in middle
    const fakeRecord = new AuditLog({
      event: 'FAKE',
      action: 'fake.action',
      userId: 'user-999',
      resourceType,
      resourceId,
      tenantId,
      recordHash: 'fake-hash-123',
      previousHash: record1.recordHash,
      createdAt: new Date(saved2.createdAt.getTime() - 1000)
    });
    await fakeRecord.save();

    const verification = await verifyChain(tenantId, resourceType, resourceId);

    expect(verification.valid).toBe(false);
  });
});