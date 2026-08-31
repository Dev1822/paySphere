/**
 * @fileoverview Event Bus Utility Unit Tests
 */

const { Queue } = require('bullmq');
const redisConnection = require('../../config/redis');
const logger = require('../logger');

// Mock external dependencies
jest.mock('bullmq');
jest.mock('../../config/redis', () => ({
  status: 'ready',
}));
jest.mock('../logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('EventDispatcher', () => {
  let eventDispatcher;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();

    // Clear require cache to get a fresh instance of EventDispatcher per test
    jest.isolateModules(() => {
      // By default in Jest, NODE_ENV is 'test'. We need to override this
      // so we can test the actual publishing logic.
      process.env.NODE_ENV = 'development';
      eventDispatcher = require('../eventBus');
    });

    // Mock BullMQ Queue add method
    Queue.prototype.add = jest.fn().mockResolvedValue(true);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('Initialization', () => {
    it('should lazily initialize queues on first access', () => {
      // Before accessing .queues, it should be null internally
      expect(eventDispatcher._queues).toBeNull();

      // Accessing it should trigger the getter
      const queues = eventDispatcher.queues;

      expect(queues).toBeDefined();
      expect(queues['integration-sync']).toBeInstanceOf(Queue);
      expect(queues['email-processing']).toBeInstanceOf(Queue);
      expect(queues['pdf-generation']).toBeInstanceOf(Queue);
      expect(queues['webhook-deliveries']).toBeInstanceOf(Queue);

      // Check if Queue constructor was called with correct names
      expect(Queue).toHaveBeenCalledWith('integration-sync', {
        connection: redisConnection,
      });
      expect(Queue).toHaveBeenCalledWith('email-processing', {
        connection: redisConnection,
      });
      expect(Queue).toHaveBeenCalledWith('pdf-generation', {
        connection: redisConnection,
      });
      expect(Queue).toHaveBeenCalledWith('webhook-deliveries', {
        connection: redisConnection,
      });
    });

    it('should reuse the same queues instance on subsequent accesses', () => {
      const queues1 = eventDispatcher.queues;
      const queues2 = eventDispatcher.queues;

      expect(queues1).toBe(queues2);
      expect(Queue).toHaveBeenCalledTimes(4); // Should only initialize once (4 queues)
    });
  });

  describe('NODE_ENV test bypass', () => {
    it('should not publish anything when NODE_ENV is test', async () => {
      process.env.NODE_ENV = 'test';

      await eventDispatcher.publish('EmployeeOnboarded', { id: 1 });

      // The queues getter should not even be triggered
      expect(eventDispatcher._queues).toBeNull();
      expect(Queue.prototype.add).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
    });
  });

  describe('Fan-out Broadcast Events', () => {
    const payload = { testData: 'xyz', tenantId: 'tenant_123' };

    it('should broadcast EmployeeOnboarded to all side-effect queues', async () => {
      await eventDispatcher.publish('EmployeeOnboarded', payload);

      const queues = eventDispatcher.queues;
      const expectedJobData = { event: 'EmployeeOnboarded', payload };

      expect(logger.info).toHaveBeenCalledWith(
        'EventDispatcher: Publishing event EmployeeOnboarded',
      );
      expect(queues['integration-sync'].add).toHaveBeenCalledWith(
        'EmployeeOnboarded',
        expectedJobData,
      );
      expect(queues['email-processing'].add).toHaveBeenCalledWith(
        'EmployeeOnboarded',
        expectedJobData,
      );
      expect(queues['pdf-generation'].add).toHaveBeenCalledWith(
        'EmployeeOnboarded',
        expectedJobData,
      );
      expect(queues['webhook-deliveries'].add).toHaveBeenCalledWith(
        'EmployeeOnboarded',
        expectedJobData,
      );
    });

    it('should broadcast OffboardingInitiated to all side-effect queues', async () => {
      await eventDispatcher.publish('OffboardingInitiated', payload);

      const queues = eventDispatcher.queues;
      const expectedJobData = { event: 'OffboardingInitiated', payload };

      expect(queues['integration-sync'].add).toHaveBeenCalledWith(
        'OffboardingInitiated',
        expectedJobData,
      );
      expect(queues['email-processing'].add).toHaveBeenCalledWith(
        'OffboardingInitiated',
        expectedJobData,
      );
      expect(queues['pdf-generation'].add).toHaveBeenCalledWith(
        'OffboardingInitiated',
        expectedJobData,
      );
      expect(queues['webhook-deliveries'].add).toHaveBeenCalledWith(
        'OffboardingInitiated',
        expectedJobData,
      );
    });

    it('should broadcast OffboardingCompleted to all side-effect queues', async () => {
      await eventDispatcher.publish('OffboardingCompleted', payload);

      const queues = eventDispatcher.queues;
      const expectedJobData = { event: 'OffboardingCompleted', payload };

      expect(queues['integration-sync'].add).toHaveBeenCalledWith(
        'OffboardingCompleted',
        expectedJobData,
      );
      expect(queues['email-processing'].add).toHaveBeenCalledWith(
        'OffboardingCompleted',
        expectedJobData,
      );
      expect(queues['pdf-generation'].add).toHaveBeenCalledWith(
        'OffboardingCompleted',
        expectedJobData,
      );
      expect(queues['webhook-deliveries'].add).toHaveBeenCalledWith(
        'OffboardingCompleted',
        expectedJobData,
      );
    });

    it('should broadcast PayrollFinalized to all side-effect queues', async () => {
      await eventDispatcher.publish('PayrollFinalized', payload);

      const queues = eventDispatcher.queues;
      const expectedJobData = { event: 'PayrollFinalized', payload };

      expect(queues['integration-sync'].add).toHaveBeenCalledWith(
        'PayrollFinalized',
        expectedJobData,
      );
      expect(queues['email-processing'].add).toHaveBeenCalledWith(
        'PayrollFinalized',
        expectedJobData,
      );
      expect(queues['pdf-generation'].add).toHaveBeenCalledWith(
        'PayrollFinalized',
        expectedJobData,
      );
      expect(queues['webhook-deliveries'].add).toHaveBeenCalledWith(
        'PayrollFinalized',
        expectedJobData,
      );
    });
  });

  describe('Point-to-Point Events', () => {
    const payload = { targetId: 99 };

    it('should push IntegrationSync event only to integration-sync queue', async () => {
      await eventDispatcher.publish('IntegrationSync', payload);

      const queues = eventDispatcher.queues;
      const expectedJobData = { event: 'IntegrationSync', payload };

      expect(queues['integration-sync'].add).toHaveBeenCalledWith(
        'IntegrationSync',
        expectedJobData,
      );
      expect(queues['email-processing'].add).not.toHaveBeenCalled();
      expect(queues['pdf-generation'].add).not.toHaveBeenCalled();
      expect(queues['webhook-deliveries'].add).not.toHaveBeenCalled();
    });

    it('should push EmailDispatch event only to email-processing queue', async () => {
      await eventDispatcher.publish('EmailDispatch', payload);

      const queues = eventDispatcher.queues;
      const expectedJobData = { event: 'EmailDispatch', payload };

      expect(queues['email-processing'].add).toHaveBeenCalledWith(
        'EmailDispatch',
        expectedJobData,
      );
      expect(queues['integration-sync'].add).not.toHaveBeenCalled();
      expect(queues['pdf-generation'].add).not.toHaveBeenCalled();
      expect(queues['webhook-deliveries'].add).not.toHaveBeenCalled();
    });

    it('should push PdfGeneration event only to pdf-generation queue', async () => {
      await eventDispatcher.publish('PdfGeneration', payload);

      const queues = eventDispatcher.queues;
      const expectedJobData = { event: 'PdfGeneration', payload };

      expect(queues['pdf-generation'].add).toHaveBeenCalledWith(
        'PdfGeneration',
        expectedJobData,
      );
      expect(queues['integration-sync'].add).not.toHaveBeenCalled();
      expect(queues['email-processing'].add).not.toHaveBeenCalled();
      expect(queues['webhook-deliveries'].add).not.toHaveBeenCalled();
    });

    it('should push WebhookDelivery event only to webhook-deliveries queue', async () => {
      await eventDispatcher.publish('WebhookDelivery', payload);

      const queues = eventDispatcher.queues;
      const expectedJobData = { event: 'WebhookDelivery', payload };

      expect(queues['webhook-deliveries'].add).toHaveBeenCalledWith(
        'WebhookDelivery',
        expectedJobData,
      );
      expect(queues['integration-sync'].add).not.toHaveBeenCalled();
      expect(queues['email-processing'].add).not.toHaveBeenCalled();
      expect(queues['pdf-generation'].add).not.toHaveBeenCalled();
    });
  });

  describe('Unknown Events', () => {
    it('should log a warning and not push to any queue for unknown events', async () => {
      const payload = { some: 'data' };
      await eventDispatcher.publish('NonExistentEvent', payload);

      expect(logger.warn).toHaveBeenCalledWith(
        'EventDispatcher: Event NonExistentEvent has no registered handlers.',
      );
      expect(Queue.prototype.add).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should catch, log, and re-throw errors from Queue.add', async () => {
      const payload = { data: 'test' };
      const testError = new Error('Redis connection failed');

      // Make one of the queues throw an error
      Queue.prototype.add.mockRejectedValueOnce(testError);

      await expect(
        eventDispatcher.publish('EmailDispatch', payload),
      ).rejects.toThrow('Redis connection failed');

      expect(logger.error).toHaveBeenCalledWith(
        'EventDispatcher: Failed to publish event EmailDispatch',
        { error: 'Redis connection failed' },
      );
    });

    it('should fail the entire Promise.all if one fan-out queue throws', async () => {
      const payload = { empId: 'emp_123' };
      const testError = new Error('BullMQ failure');

      // In a Promise.all, if one rejects, the whole promise rejects
      Queue.prototype.add.mockImplementation((name) => {
        if (name === 'pdf-generation') {
          return Promise.reject(testError);
        }
        return Promise.resolve();
      });

      await expect(
        eventDispatcher.publish('EmployeeOnboarded', payload),
      ).rejects.toThrow('BullMQ failure');

      expect(logger.error).toHaveBeenCalledWith(
        'EventDispatcher: Failed to publish event EmployeeOnboarded',
        { error: 'BullMQ failure' },
      );
    });
  });

  describe('Edge Cases and Concurrency', () => {
    it('should handle multiple concurrent publish calls correctly', async () => {
      const payload1 = { id: 1 };
      const payload2 = { id: 2 };
      const payload3 = { id: 3 };

      await Promise.all([
        eventDispatcher.publish('EmailDispatch', payload1),
        eventDispatcher.publish('EmailDispatch', payload2),
        eventDispatcher.publish('EmailDispatch', payload3),
      ]);

      const queues = eventDispatcher.queues;
      expect(queues['email-processing'].add).toHaveBeenCalledTimes(3);
      expect(queues['email-processing'].add).toHaveBeenCalledWith(
        'EmailDispatch',
        { event: 'EmailDispatch', payload: payload1 },
      );
      expect(queues['email-processing'].add).toHaveBeenCalledWith(
        'EmailDispatch',
        { event: 'EmailDispatch', payload: payload2 },
      );
      expect(queues['email-processing'].add).toHaveBeenCalledWith(
        'EmailDispatch',
        { event: 'EmailDispatch', payload: payload3 },
      );
    });

    it('should correctly stringify or handle complex nested payloads', async () => {
      const complexPayload = {
        employee: { name: 'Alice', metadata: { roles: ['admin', 'user'] } },
        timestamp: new Date('2026-08-31T12:00:00Z'),
        flags: [true, false, null],
      };

      await eventDispatcher.publish('IntegrationSync', complexPayload);

      const queues = eventDispatcher.queues;
      expect(queues['integration-sync'].add).toHaveBeenCalledWith(
        'IntegrationSync',
        {
          event: 'IntegrationSync',
          payload: complexPayload,
        },
      );
    });
  });
});
