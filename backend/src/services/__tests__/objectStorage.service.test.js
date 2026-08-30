'use strict';

const send = jest.fn().mockResolvedValue({});

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send })),
  PutObjectCommand: jest.fn((input) => ({ input })),
  GetObjectCommand: jest.fn((input) => ({ input })),
  DeleteObjectCommand: jest.fn((input) => ({ input })),
}), { virtual: true });

jest.mock('@aws-sdk/credential-provider-node', () => ({
  defaultProvider: () => async () => ({
    accessKeyId: 'TESTACCESS',
    secretAccessKey: 'TESTSECRET',
  }),
}), { virtual: true });

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('objectStorage.service', () => {
  let storage;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.AWS_S3_BUCKET = 'test-bucket';
    storage = require('../objectStorage.service');
  });

  afterEach(() => {
    delete process.env.AWS_S3_BUCKET;
  });

  test('creates tenant-scoped object keys without path traversal', () => {
    const key = storage.createObjectKey({
      tenantId: '../tenant',
      area: '../receipts',
      extension: '.pdf',
    });

    expect(key).toMatch(/^tenants\/tenant\/receipts\/.*\.pdf$/);
    expect(key).not.toContain('..');
  });

  test('uploads objects to the configured bucket', async () => {
    const result = await storage.putObject({
      key: 'exports/report.pdf',
      body: Buffer.from('pdf'),
      contentType: 'application/pdf',
    });

    expect(result.uri).toBe('s3://test-bucket/exports/report.pdf');
    expect(send).toHaveBeenCalledTimes(1);
  });

  test('turns storage URIs into signed download URLs', async () => {
    const url = await storage.getDownloadUrl('s3://test-bucket/exports/report.pdf');
    expect(url).toMatch(/^https:\/\/test-bucket\.s3\.us-east-1\.amazonaws\.com\/exports\/report\.pdf\?/);
    expect(url).toContain('X-Amz-Algorithm=AWS4-HMAC-SHA256');
    expect(url).toContain('X-Amz-Signature=');
  });

  test('leaves non-S3 URLs unchanged', async () => {
    await expect(storage.getDownloadUrl('https://example.com/avatar.png')).resolves.toBe(
      'https://example.com/avatar.png',
    );
  });

  test('parses data URLs and rejects unsupported image types', () => {
    const parsed = storage.dataUrlToBuffer(
      `data:image/png;base64,${Buffer.from('png').toString('base64')}`,
    );
    expect(parsed.mimeType).toBe('image/png');
    expect(parsed.buffer.toString()).toBe('png');
    expect(storage.dataUrlToBuffer('not-a-data-url')).toBeNull();
  });

  test('deletes S3 objects using their storage URI', async () => {
    await expect(storage.deleteObject('s3://test-bucket/exports/report.pdf')).resolves.toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
