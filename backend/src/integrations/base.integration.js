/**
 * BaseIntegration — Abstract base class for all HRMS adapters.
 *
 * Every provider (BambooHR, Workday, ADP, …) must extend this class and
 * implement the three abstract methods.  The registry validates adapters
 * using `instanceof BaseIntegration` at registration time, making it
 * impossible to register a broken adapter silently.
 *
 * Adding a new provider requires only:
 *   1. Create `integrations/<provider>.integration.js` extending this class.
 *   2. Register it via `registry.register('provider', Adapter)`.
 *   No changes to controllers, sync jobs, or any other file.
 */
'use strict';

class BaseIntegration {
  /** @param {object} config  Decrypted per-tenant credentials and settings. */
  constructor(config) {
    if (new.target === BaseIntegration) {
      throw new TypeError(
        'BaseIntegration is abstract — extend it, do not instantiate it directly.',
      );
    }
    this.config = config;
  }

  /** @returns {string} Human-readable provider name for logs and UI. */
  get name() {
    return this.constructor.name;
  }

  /**
   * Fetch all active employees from the external HRMS.
   * Must return objects mapped to PaySphere's Employee schema shape.
   * @returns {Promise<object[]>}
   */
  async fetchEmployees() {
    throw new Error(`${this.name}.fetchEmployees() is not implemented.`);
  }

  /**
   * Push a finalised payslip to the external system (optional).
   * @param {object} _payslip
   * @returns {Promise<void>}
   */

  async pushPayslip(_payslip) {
    throw new Error(`${this.name}.pushPayslip() is not implemented.`);
  }

  /**
   * React to an employee termination event.
   * @param {string} _externalEmployeeId
   * @returns {Promise<void>}
   */

  async onEmployeeTerminated(_externalEmployeeId) {
    throw new Error(`${this.name}.onEmployeeTerminated() is not implemented.`);
  }
}

module.exports = BaseIntegration;
