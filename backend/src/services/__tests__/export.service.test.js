'use strict';

jest.mock('../objectStorage.service', () => ({
  putObject: jest.fn().mockResolvedValue({
    uri: 's3://test-bucket/exports/report.pdf',
    key: 'exports/report.pdf',
  }),
  getDownloadUrl: jest.fn().mockResolvedValue('https://signed.example/report.pdf'),
}));

const exportService = require('../export.service');

describe('ExportService & WorkerThreadPool', () => {
  it('should instantiate WorkerThreadPool with positive maxWorkers count', () => {
    expect(exportService.pool.maxWorkers).toBeGreaterThan(0);
    expect(exportService.pool.activeWorkers).toBe(0);
  });

  it('should queue tasks when pool concurrency limit is reached', async () => {
    const mockWorkerPath = require.resolve('../export.service.js');
    
    // Simulate pool saturation
    exportService.pool.activeWorkers = exportService.pool.maxWorkers;
    
    const taskPromise = exportService.pool.runTask(mockWorkerPath, {});
    expect(exportService.pool.queue.length).toBe(1);

    // Clean up mock state
    exportService.pool.activeWorkers = 0;
    exportService.pool.queue = [];
  });

  it('should upload exports and return a real presigned download URL', async () => {
    const result = await exportService.uploadToS3('report.pdf', Buffer.from('test'), 'application/pdf');
    expect(result.fileUrl).toBe('https://signed.example/report.pdf');
    expect(result.key).toContain('report.pdf');
    expect(result.uri).toBe('s3://test-bucket/exports/report.pdf');
    expect(result.expiresAt).toBeDefined();
  });
});
