const fs = require('fs');
const path = require('path');
const { runDatabaseArchivalJob } = require('../archival.job');
const PayrollUpdate = require('../../models/payroll.model');
const AuditLog = require('../../models/auditLog.model');
const Attendance = require('../../models/attendance.model');
const s3Archiver = require('../../utils/s3Archiver');

// Mock Mongoose models
jest.mock('../../models/payroll.model', () => {
  return {
    find: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([{ _id: 'pay-old', amount: 1000 }]),
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 1 }),
  };
});

jest.mock('../../models/auditLog.model', () => {
  return {
    find: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([{ _id: 'audit-old', action: 'LOGIN' }]),
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 1 }),
  };
});

jest.mock('../../models/attendance.model', () => {
  return {
    find: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([{ _id: 'att-old', year: 2018 }]),
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 1 }),
  };
});

// Mock S3 Glacier uploader
jest.mock('../../utils/s3Archiver', () => ({
  uploadToGlacier: jest.fn().mockResolvedValue({ ETag: '"mock-etag"' }),
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('Database Archival and Purge Job (#1095)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    // Clean up local archives if created in test
    const archiveDir = path.join(__dirname, '../../../archives');
    if (fs.existsSync(archiveDir)) {
      const files = fs.readdirSync(archiveDir);
      for (const file of files) {
        try {
          fs.unlinkSync(path.join(archiveDir, file));
        } catch (err) {}
      }
    }
  });

  test('should run database archival and retain archive locally if S3 unconfigured', async () => {
    delete process.env.ARCHIVAL_S3_BUCKET;
    delete process.env.BACKUP_S3_BUCKET;

    const result = await runDatabaseArchivalJob();

    expect(result.success).toBe(true);
    expect(result.archivedCount).toBe(3); // 1 payroll + 1 audit + 1 attendance
    expect(result.uploadedToS3).toBe(false);
    expect(result.purged).toEqual({
      payrolls: 0,
      auditLogs: 0,
      attendances: 1,
    });

    expect(result.retained).toEqual({
      payrolls: 1,
      auditLogs: 1,
    });
    // Local zip file should exist
    const archiveDir = path.join(__dirname, '../../../archives');
    const files = fs.readdirSync(archiveDir);
    expect(files.length).toBe(1);

    // Mongoose deletes should have been called
    expect(PayrollUpdate.deleteMany).not.toHaveBeenCalled();
    expect(AuditLog.deleteMany).not.toHaveBeenCalled();
    expect(Attendance.deleteMany).toHaveBeenCalled();  });

  test('should upload to S3 Glacier and delete local zip when S3 is configured', async () => {
    process.env.ARCHIVAL_S3_BUCKET = 'my-glacier-bucket';
    process.env.AWS_ACCESS_KEY_ID = 'key-id';
    process.env.AWS_SECRET_ACCESS_KEY = 'secret-key';

    const result = await runDatabaseArchivalJob();

    expect(result.success).toBe(true);
    expect(result.uploadedToS3).toBe(true);

    // uploadToGlacier should be called
    expect(s3Archiver.uploadToGlacier).toHaveBeenCalled();

    // Local file should be cleaned up after S3 upload
    const archiveDir = path.join(__dirname, '../../../archives');
    const files = fs.readdirSync(archiveDir);
    expect(files.length).toBe(0);
  });
});
