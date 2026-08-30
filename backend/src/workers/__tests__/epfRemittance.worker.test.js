const { processEpfRemittanceJob, getSimulationCacheKey } = require('../epfRemittance.worker');
const { computePosition } = require('../../services/epfRemittance.service');
const { acquireLock, releaseLock } = require('../../utils/lockManager');
const cacheService = require('../../services/cache.service');

jest.mock('../../services/epfRemittance.service');
jest.mock('../../utils/lockManager');
jest.mock('../../services/cache.service');

describe('epfRemittance.worker', () => {
  let job;

  beforeEach(() => {
    jest.clearAllMocks();

    job = {
      id: 'job-123',
      data: {
        tenantId: 'tenant-abc',
        establishment: 'est-123',
        range: {
          from: { year: 2024, month: 4 },
          to: { year: 2024, month: 6 },
        },
        asAt: '2026-08-01T00:00:00.000Z',
      },
      updateProgress: jest.fn().mockResolvedValue(true),
    };
  });

  it('successfully computes belated EPF remittance and caches result', async () => {
    acquireLock.mockResolvedValue(true);
    releaseLock.mockResolvedValue(true);

    const mockOutput = {
      rules: { dueDayOfNextMonth: 15 },
      result: { interest: 120, damages: 50 },
      monthCount: 3,
    };
    computePosition.mockResolvedValue(mockOutput);

    const result = await processEpfRemittanceJob(job);

    expect(acquireLock).toHaveBeenCalledWith('epf_lock:tenant-abc:2024', 300000);
    expect(computePosition).toHaveBeenCalledWith({
      tenantId: 'tenant-abc',
      establishment: 'est-123',
      range: {
        from: { year: 2024, month: 4 },
        to: { year: 2024, month: 6 },
      },
      asAt: '2026-08-01T00:00:00.000Z',
    });

    const cacheKey = getSimulationCacheKey(
      'tenant-abc',
      'est-123',
      { from: { year: 2024, month: 4 }, to: { year: 2024, month: 6 } },
      '2026-08-01T00:00:00.000Z'
    );
    expect(cacheService.setEx).toHaveBeenCalledWith(cacheKey, 300, JSON.stringify(mockOutput));
    expect(releaseLock).toHaveBeenCalledWith('epf_lock:tenant-abc:2024');
    expect(job.updateProgress).toHaveBeenCalledWith(50);
    expect(job.updateProgress).toHaveBeenCalledWith(100);
    expect(result).toEqual(mockOutput);
  });

  it('fails immediately and does not process if lock cannot be acquired', async () => {
    acquireLock.mockResolvedValue(false); // Lock held by another job

    await expect(processEpfRemittanceJob(job)).rejects.toThrow(
      'Simulation or computation is already in progress for financial year 2024'
    );

    expect(acquireLock).toHaveBeenCalledWith('epf_lock:tenant-abc:2024', 300000);
    expect(computePosition).not.toHaveBeenCalled();
    expect(cacheService.setEx).not.toHaveBeenCalled();
    expect(releaseLock).not.toHaveBeenCalled();
  });
});
