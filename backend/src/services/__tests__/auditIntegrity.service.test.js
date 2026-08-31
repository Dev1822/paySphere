const mongoose = require('mongoose');
const { verifyTenantChain } = require('../auditIntegrity.service');
const {
  generatePayloadHash,
  signHash,
  verifySignature,
  normalizePayload,
} = require('../../utils/cryptoAudit');
const AuditLog = require('../../models/auditLog.model');

// Mock mongoose model
jest.mock('../../models/auditLog.model');

describe('Cryptographic Audit Logging test suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('cryptoAudit Utils', () => {
    it('should correctly normalize payload by removing internal keys', () => {
      const rawPayload = {
        _id: '123',
        __v: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        currentHash: 'hash1',
        previousHash: 'hash0',
        signature: 'sig',
        recordHash: 'hash1',
        hashChainValid: true,
        action: 'TEST_ACTION',
        userId: 'user1',
        details: { data: 'test' },
      };

      const normalizedStr = normalizePayload(rawPayload);
      const parsed = JSON.parse(normalizedStr);

      expect(parsed).not.toHaveProperty('_id');
      expect(parsed).not.toHaveProperty('__v');
      expect(parsed).not.toHaveProperty('createdAt');
      expect(parsed).not.toHaveProperty('updatedAt');
      expect(parsed).not.toHaveProperty('currentHash');
      expect(parsed).not.toHaveProperty('previousHash');
      expect(parsed).not.toHaveProperty('signature');
      expect(parsed).not.toHaveProperty('recordHash');
      expect(parsed).not.toHaveProperty('hashChainValid');

      expect(parsed).toHaveProperty('action', 'TEST_ACTION');
      expect(parsed).toHaveProperty('userId', 'user1');
      expect(parsed.details).toEqual({ data: 'test' });
    });

    it('should sort keys to ensure deterministic hashing', () => {
      const payload1 = { z: 1, a: 2, b: { y: 1, x: 2 } };
      const payload2 = { a: 2, z: 1, b: { y: 1, x: 2 } }; // Same content, different order

      const norm1 = normalizePayload(payload1);
      const norm2 = normalizePayload(payload2);

      expect(norm1).toBe(norm2);
    });

    it('should handle Mongoose document objects via toObject()', () => {
      const mockDoc = {
        toObject: jest.fn().mockReturnValue({ action: 'TEST', _id: '123' }),
      };

      const norm = normalizePayload(mockDoc);
      expect(mockDoc.toObject).toHaveBeenCalled();
      expect(JSON.parse(norm)).toEqual({ action: 'TEST' });
    });

    it('should generate deterministic hashes for the same payload and previousHash', () => {
      const payload = { action: 'TEST', amount: 100 };
      const previousHash = 'abc123hash';

      const hash1 = generatePayloadHash(payload, previousHash);
      const hash2 = generatePayloadHash(payload, previousHash);

      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('string');
      expect(hash1.length).toBeGreaterThan(0);
    });

    it('should generate different hashes for different payloads', () => {
      const payload1 = { action: 'TEST', amount: 100 };
      const payload2 = { action: 'TEST', amount: 200 };
      const previousHash = 'abc123hash';

      const hash1 = generatePayloadHash(payload1, previousHash);
      const hash2 = generatePayloadHash(payload2, previousHash);

      expect(hash1).not.toBe(hash2);
    });

    it('should generate different hashes for different previousHashes', () => {
      const payload = { action: 'TEST', amount: 100 };

      const hash1 = generatePayloadHash(payload, 'hash1');
      const hash2 = generatePayloadHash(payload, 'hash2');

      expect(hash1).not.toBe(hash2);
    });

    it('should default previousHash to GENESIS if null or undefined', () => {
      const payload = { action: 'TEST' };

      const hash1 = generatePayloadHash(payload);
      const hash2 = generatePayloadHash(payload, 'GENESIS');

      expect(hash1).toBe(hash2);
    });

    it('should sign a hash and produce a valid signature', () => {
      const hash = 'sample_hash_123';
      const signature = signHash(hash);

      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
    });

    it('should successfully verify a valid signature', () => {
      const hash = 'valid_hash_to_sign';
      const signature = signHash(hash);

      const isValid = verifySignature(hash, signature);
      expect(isValid).toBe(true);
    });

    it('should reject an invalid signature', () => {
      const hash = 'valid_hash_to_sign';
      const isValid = verifySignature(hash, 'invalid_signature_string');
      expect(isValid).toBe(false);
    });

    it('should handle null/undefined signature verification safely', () => {
      const hash = 'valid_hash_to_sign';
      expect(verifySignature(hash, null)).toBe(false);
      expect(verifySignature(hash, undefined)).toBe(false);
    });
  });

  describe('auditIntegrity.service - verifyTenantChain', () => {
    const tenantId = 'tenant_xyz';

    it('should return valid true if no logs are found for tenant', async () => {
      AuditLog.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });

      const report = await verifyTenantChain(tenantId);

      expect(report.valid).toBe(true);
      expect(report.totalLogs).toBeUndefined(); // as per implementation returning early
      expect(report.message).toBe('No audit logs found for this tenant.');
    });

    it('should correctly validate an intact audit chain', async () => {
      const log1Payload = { action: 'LOGIN', userId: 'u1' };
      const log1Hash = generatePayloadHash(log1Payload, 'GENESIS');
      const log1Sig = signHash(log1Hash);

      const log2Payload = { action: 'UPDATE', userId: 'u1' };
      const log2Hash = generatePayloadHash(log2Payload, log1Hash);
      const log2Sig = signHash(log2Hash);

      AuditLog.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          {
            _id: '1',
            ...log1Payload,
            previousHash: 'GENESIS',
            currentHash: log1Hash,
            signature: log1Sig,
          },
          {
            _id: '2',
            ...log2Payload,
            previousHash: log1Hash,
            currentHash: log2Hash,
            signature: log2Sig,
          },
        ]),
      });

      const report = await verifyTenantChain(tenantId);

      expect(report.valid).toBe(true);
      expect(report.brokenAt).toBeNull();
      expect(report.totalLogs).toBe(2);
      expect(report.history.length).toBe(2);
      expect(report.history[0].valid).toBe(true);
      expect(report.history[1].valid).toBe(true);
    });

    it('should detect a broken previousHash link in the chain', async () => {
      const log1Payload = { action: 'LOGIN' };
      const log1Hash = generatePayloadHash(log1Payload, 'GENESIS');
      const log1Sig = signHash(log1Hash);

      const log2Payload = { action: 'UPDATE' };
      // Simulate broken link: log2 points to wrong previousHash
      const wrongHash = 'WRONG_HASH';
      const log2Hash = generatePayloadHash(log2Payload, wrongHash);
      const log2Sig = signHash(log2Hash);

      AuditLog.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          {
            _id: '1',
            ...log1Payload,
            previousHash: 'GENESIS',
            currentHash: log1Hash,
            signature: log1Sig,
          },
          {
            _id: '2',
            ...log2Payload,
            previousHash: wrongHash,
            currentHash: log2Hash,
            signature: log2Sig,
          },
        ]),
      });

      const report = await verifyTenantChain(tenantId);

      expect(report.valid).toBe(false);
      expect(report.brokenAt).toBe(1);
      expect(report.history[1].valid).toBe(false);
      expect(report.history[1].details.isPreviousHashValid).toBe(false);
    });

    it('should detect if a payload was altered (currentHash mismatch)', async () => {
      const log1Payload = { action: 'LOGIN', amount: 100 };
      const log1Hash = generatePayloadHash(log1Payload, 'GENESIS');
      const log1Sig = signHash(log1Hash);

      // Simulate tampering: change amount to 5000 directly in DB, but keep hash and sig same
      const tamperedPayload = { action: 'LOGIN', amount: 5000 };

      AuditLog.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest
          .fn()
          .mockResolvedValue([
            {
              _id: '1',
              ...tamperedPayload,
              previousHash: 'GENESIS',
              currentHash: log1Hash,
              signature: log1Sig,
            },
          ]),
      });

      const report = await verifyTenantChain(tenantId);

      expect(report.valid).toBe(false);
      expect(report.brokenAt).toBe(0);
      expect(report.history[0].valid).toBe(false);
      expect(report.history[0].details.isCurrentHashValid).toBe(false);
    });

    it('should detect if the signature is invalid (tampered hash)', async () => {
      const log1Payload = { action: 'LOGIN' };

      // Hacker recalculates hash for tampered payload, but cannot sign it properly
      const hackedPayload = { action: 'HACKED' };
      const hackedHash = generatePayloadHash(hackedPayload, 'GENESIS');
      const fakeSignature = 'fake_signature_12345';

      AuditLog.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest
          .fn()
          .mockResolvedValue([
            {
              _id: '1',
              ...hackedPayload,
              previousHash: 'GENESIS',
              currentHash: hackedHash,
              signature: fakeSignature,
            },
          ]),
      });

      const report = await verifyTenantChain(tenantId);

      expect(report.valid).toBe(false);
      expect(report.brokenAt).toBe(0);
      expect(report.history[0].valid).toBe(false);
      expect(report.history[0].details.isCurrentHashValid).toBe(true); // Hash matches payload
      expect(report.history[0].details.isSignatureValid).toBe(false); // Signature fails
    });
  });
});
