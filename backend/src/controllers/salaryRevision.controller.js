/**
 * @fileoverview Salary Revision Simulator Controller
 * @description Request handlers for scenarios, simulation, line items,
 *   overrides, approvals, batches, and reporting.
 */

const salaryRevisionService = require('../services/salaryRevision.service');

// ─── Scenario Endpoints ─────────────────────────────────────────────────────

/**
 * POST /api/salary-revisions/scenarios
 * Create a new revision scenario.
 */
exports.createScenario = async (req, res, next) => {
  try {
    const { name, fiscalYear, effectiveDate, scenarioType, globalHikePercent, departmentHikes, performanceBands, maxHikeCapPercent } = req.body;
    if (!name || !fiscalYear || !effectiveDate) {
      return res.status(400).json({
        message: 'name, fiscalYear, and effectiveDate are required',
      });
    }
    const scenario = await salaryRevisionService.createScenario(
      req.tenantId,
      {
        name,
        description: req.body.description,
        fiscalYear,
        effectiveDate,
        scenarioType,
        globalHikePercent,
        departmentHikes,
        performanceBands,
        maxHikeCapPercent,
        includeBonus: req.body.includeBonus,
        includeStatutoryImpact: req.body.includeStatutoryImpact,
      },
      req.userId,
    );
    res.status(201).json({ message: 'Scenario created', scenario });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/salary-revisions/scenarios
 * List all revision scenarios.
 */
exports.getScenarios = async (req, res, next) => {
  try {
    const filters = {};
    if (req.query.fiscalYear) filters.fiscalYear = parseInt(req.query.fiscalYear, 10);
    if (req.query.status) filters.status = req.query.status;
    if (req.query.scenarioType) filters.scenarioType = req.query.scenarioType;

    const scenarios = await salaryRevisionService.getScenarios(req.tenantId, filters);
    res.status(200).json({ scenarios });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/salary-revisions/scenarios/:scenarioId
 * Get a specific scenario with full details.
 */
exports.getScenario = async (req, res, next) => {
  try {
    const scenario = await salaryRevisionService.getScenario(
      req.params.scenarioId,
      req.tenantId,
    );
    res.status(200).json({ scenario });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/salary-revisions/scenarios/:scenarioId
 * Update a scenario (only Draft or Simulated).
 */
exports.updateScenario = async (req, res, next) => {
  try {
    const scenario = await salaryRevisionService.updateScenario(
      req.params.scenarioId,
      req.tenantId,
      req.body,
      req.userId,
    );
    res.status(200).json({ message: 'Scenario updated', scenario });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/salary-revisions/scenarios/:scenarioId/simulate
 * Run the simulation engine on a scenario.
 */
exports.runSimulation = async (req, res, next) => {
  try {
    const result = await salaryRevisionService.runSimulation(
      req.params.scenarioId,
      req.tenantId,
      req.userId,
    );
    res.status(200).json({
      message: 'Simulation complete',
      scenario: result.scenario,
      stats: result.stats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/salary-revisions/scenarios/:scenarioId/submit
 * Submit a scenario for approval.
 */
exports.submitScenario = async (req, res, next) => {
  try {
    const scenario = await salaryRevisionService.transitionScenario(
      req.params.scenarioId,
      req.tenantId,
      'Submitted',
      req.userId,
      req.body.comment,
    );
    res.status(200).json({ message: 'Scenario submitted', scenario });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/salary-revisions/scenarios/:scenarioId/approve
 * Approve a scenario.
 */
exports.approveScenario = async (req, res, next) => {
  try {
    const scenario = await salaryRevisionService.transitionScenario(
      req.params.scenarioId,
      req.tenantId,
      'Approved',
      req.userId,
      req.body.comment,
    );
    res.status(200).json({ message: 'Scenario approved', scenario });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/salary-revisions/scenarios/:scenarioId/reject
 * Reject a scenario.
 */
exports.rejectScenario = async (req, res, next) => {
  try {
    const { reason } = req.body || {};
    if (!reason) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }
    const scenario = await salaryRevisionService.transitionScenario(
      req.params.scenarioId,
      req.tenantId,
      'Rejected',
      req.userId,
      reason,
    );
    res.status(200).json({ message: 'Scenario rejected', scenario });
  } catch (error) {
    next(error);
  }
};

// ─── Line Item Endpoints ────────────────────────────────────────────────────

/**
 * GET /api/salary-revisions/scenarios/:scenarioId/line-items
 * Get all line items for a scenario.
 */
exports.getLineItems = async (req, res, next) => {
  try {
    const filters = {};
    if (req.query.department) filters.department = req.query.department;
    if (req.query.level) filters.level = req.query.level;
    if (req.query.status) filters.status = req.query.status;

    const items = await salaryRevisionService.getLineItems(
      req.params.scenarioId,
      req.tenantId,
      filters,
    );
    res.status(200).json({ lineItems: items });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/salary-revisions/line-items/:lineItemId/override
 * Manually override a revision.
 */
exports.overrideRevision = async (req, res, next) => {
  try {
    const { hikePercent, reason } = req.body;
    if (hikePercent === undefined) {
      return res.status(400).json({ message: 'hikePercent is required' });
    }
    const item = await salaryRevisionService.overrideRevision(
      req.params.lineItemId,
      req.tenantId,
      { hikePercent, reason },
      req.userId,
    );
    res.status(200).json({ message: 'Revision overridden', lineItem: item });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/salary-revisions/line-items/:lineItemId/approve
 * Approve an individual revision.
 */
exports.approveRevision = async (req, res, next) => {
  try {
    const item = await salaryRevisionService.approveRevision(
      req.params.lineItemId,
      req.tenantId,
      req.userId,
    );
    res.status(200).json({ message: 'Revision approved', lineItem: item });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/salary-revisions/line-items/:lineItemId/reject
 * Reject an individual revision.
 */
exports.rejectRevision = async (req, res, next) => {
  try {
    const { reason } = req.body || {};
    if (!reason) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }
    const item = await salaryRevisionService.rejectRevision(
      req.params.lineItemId,
      req.tenantId,
      req.userId,
      reason,
    );
    res.status(200).json({ message: 'Revision rejected', lineItem: item });
  } catch (error) {
    next(error);
  }
};

// ─── Batch Endpoints ────────────────────────────────────────────────────────

/**
 * POST /api/salary-revisions/scenarios/:scenarioId/batch
 * Create a batch of approved revisions for application.
 */
exports.createBatch = async (req, res, next) => {
  try {
    const batch = await salaryRevisionService.createBatch(
      req.params.scenarioId,
      req.tenantId,
      { effectiveDate: req.body.effectiveDate, notes: req.body.notes },
      req.userId,
    );
    res.status(201).json({ message: 'Batch created', batch });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/salary-revisions/batches/:batchId/apply
 * Apply a batch (update employee salaries).
 */
exports.applyBatch = async (req, res, next) => {
  try {
    const batch = await salaryRevisionService.applyBatch(
      req.params.batchId,
      req.tenantId,
      req.userId,
    );
    res.status(200).json({ message: 'Batch applied', batch });
  } catch (error) {
    next(error);
  }
};

// ─── Reports ────────────────────────────────────────────────────────────────

/**
 * GET /api/salary-revisions/dashboard
 * Get simulation dashboard summary.
 */
exports.getDashboard = async (req, res, next) => {
  try {
    const fiscalYear = req.query.fiscalYear
      ? parseInt(req.query.fiscalYear, 10)
      : new Date().getFullYear();

    const dashboard = await salaryRevisionService.getSimulationDashboard(
      req.tenantId,
      fiscalYear,
    );
    res.status(200).json({ dashboard });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/salary-revisions/compare
 * Compare multiple scenarios.
 */
exports.compareScenarios = async (req, res, next) => {
  try {
    const { scenarioIds } = req.body;
    if (!Array.isArray(scenarioIds) || scenarioIds.length < 2) {
      return res.status(400).json({
        message: 'At least 2 scenario IDs are required',
      });
    }
    const comparison = await salaryRevisionService.compareScenarioResults(
      req.tenantId,
      scenarioIds,
    );
    res.status(200).json({ comparison });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/salary-revisions/audit/:scenarioId
 * Get audit log for a scenario.
 */
exports.getAuditLog = async (req, res, next) => {
  try {
    const options = {};
    if (req.query.limit) options.limit = parseInt(req.query.limit, 10);
    if (req.query.skip) options.skip = parseInt(req.query.skip, 10);

    const log = await salaryRevisionService.getAuditLog(
      req.tenantId,
      req.params.scenarioId,
      options,
    );
    res.status(200).json({ auditLog: log });
  } catch (error) {
    next(error);
  }
};
