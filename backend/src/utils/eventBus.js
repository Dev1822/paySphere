/**
 * @fileoverview Event Bus Utility
 * @description Centralized Pub/Sub dispatcher for domain events.
 */
const { Queue } = require('bullmq');
const redisConnection = require('../config/redis');
const logger = require('./logger');

class EventDispatcher {
  constructor() {
    this._queues = null;
  }

  get queues() {
    if (!this._queues) {
      this._queues = {
        'integration-sync': new Queue('integration-sync', {
          connection: redisConnection,
        }),
        'email-processing': new Queue('email-processing', {
          connection: redisConnection,
        }),
        'pdf-generation': new Queue('pdf-generation', {
          connection: redisConnection,
        }),
        'webhook-deliveries': new Queue('webhook-deliveries', {
          connection: redisConnection,
        }),
      };
    }
    return this._queues;
  }

  /**
   * Publish a domain event to the message broker.
   * @param {string} eventName - The name of the event (e.g., 'EmployeeOnboarded')
   * @param {Object} payload - The standardized event payload
   */
  async publish(eventName, payload) {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    const jobData = { event: eventName, payload };

    logger.info(`EventDispatcher: Publishing event ${eventName}`);

    try {
      // Fan-out the event to appropriate consumer queues
      switch (eventName) {
        case 'EmployeeOnboarded':
        case 'OffboardingInitiated':
        case 'OffboardingCompleted':
        case 'PayrollFinalized':
          // Broadcast to all side-effect processors
          await Promise.all([
            this.queues['integration-sync'].add(eventName, jobData),
            this.queues['email-processing'].add(eventName, jobData),
            this.queues['pdf-generation'].add(eventName, jobData),
            this.queues['webhook-deliveries'].add(eventName, jobData),
          ]);
          break;

        case 'IntegrationSync':
          await this.queues['integration-sync'].add(eventName, jobData);
          break;

        case 'EmailDispatch':
          await this.queues['email-processing'].add(eventName, jobData);
          break;

        case 'PdfGeneration':
          await this.queues['pdf-generation'].add(eventName, jobData);
          break;

        case 'WebhookDelivery':
          await this.queues['webhook-deliveries'].add(eventName, jobData);
          break;

        default:
          logger.warn(
            `EventDispatcher: Event ${eventName} has no registered handlers.`,
          );
          break;
      }
    } catch (error) {
      logger.error(`EventDispatcher: Failed to publish event ${eventName}`, {
        error: error.message,
      });
      throw error;
    }
  }
}

module.exports = new EventDispatcher();
