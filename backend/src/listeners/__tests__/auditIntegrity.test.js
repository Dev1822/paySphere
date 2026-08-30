/**
 * Tests for Audit Integrity in Listener
 * Issue #1905
 */
'use strict';

const auditIntegrity = require('../../services/auditIntegrity.service');
const AuditLog = require('../../models/auditLog.model');

describe('Audit Listener with Integrity', () => {
  const tenantId = 'test-tenant-456';
  const userId = 'user-456';
  const resourceType = 'Employee';
  const resourceId = 'emp-456';

  beforeEach(async () => {
    await AuditLog.deleteMany({});
  });

  test('should create audit record with integrity metadata', async () => {
    const auditData = {
      event: 'CREATE',
      action: 'employee.created',
      userId,
      resourceType,
      resourceId,
      tenantId,
      details: { name: 'John Doe', email: 'john@example.com' }
    };

    const withIntegrity = await auditIntegrity.addIntegrityMetadata(auditData);
    const record = await AuditLog.create(withIntegrity);

    expect(record.recordHash).toBeDefined();
    expect(record.previousHash).toBeNull();
  });

  test('should link consecutive records', async () => {
    // Create first record
    const data1 = {
      event: 'CREATE',
      action: 'employee.created',
      userId,
      resourceType,
      resourceId,
      tenantId
    };
    const withIntegrity1 = await auditIntegrity.addIntegrityMetadata(data1);
    const record1 = await AuditLog.create(withIntegrity1);

    // Create second record
    const data2 = {
      event: 'UPDATE',
      action: 'employee.updated',
      userId,
      resourceType,
      resourceId,
      tenantId
    };
    const withIntegrity2 = await auditIntegrity.addIntegrityMetadata(data2);
    const record2 = await AuditLog.create(withIntegrity2);

    expect(record2.previousHash).toBe(record1.recordHash);
  });

  test('should verify chain validity', async () => {
    // Create multiple records
    for (let i = 0; i < 3; i++) {
      const data = {
        event: 'UPDATE',
        action: `employee.updated.${i}`,
        userId,
        resourceType,
        resourceId,
        tenantId
      };
      const withIntegrity = await auditIntegrity.addIntegrityMetadata(data);
      await AuditLog.create(withIntegrity);
    }

    const verification = await auditIntegrity.verifyChain(tenantId, resourceType, resourceId);

    expect(verification.valid).toBe(true);
    expect(verification.totalRecords).toBe(3);
  });
});