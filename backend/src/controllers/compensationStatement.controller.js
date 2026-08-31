/**
 * @fileoverview Total Compensation Statement Controller
 *
 * Endpoints for generating, retrieving, and managing per-employee
 * total compensation statements with full CTC breakdowns.
 *
 * Mounted at /api/compensation-statements
 */

const compensationStatementService = require('../services/compensationStatement.service');

// ─── Generate ────────────────────────────────────────────────────────────

/**
 * POST /api/compensation-statements/generate
 * Generate a statement for one employee.
 */
exports.generate = async (req, res, next) => {
  try {
    const { employeeId, fiscalYear } = req.body || {};

    if (!employeeId || !fiscalYear) {
      return res.status(400).json({ message: 'employeeId and fiscalYear are required' });
    }

    const year = Number(fiscalYear);
    if (year < 2000 || year > 2100) {
      return res.status(400).json({ message: 'Invalid fiscal year' });
    }

    const statement = await compensationStatementService.generateStatement(
      req.tenantId,
      employeeId,
      year,
      req.userId,
    );

    res.status(201).json({ message: 'Statement generated', statement });
  } catch (error) {
    if (error.name === 'ObjectNotFoundException') {
      return res.status(404).json({ message: error.message });
    }
    next(error);
  }
};

/**
 * POST /api/compensation-statements/generate-bulk
 * Generate statements for all active employees in a fiscal year.
 */
exports.generateBulk = async (req, res, next) => {
  try {
    const { fiscalYear } = req.body || {};

    if (!fiscalYear) {
      return res.status(400).json({ message: 'fiscalYear is required' });
    }

    const year = Number(fiscalYear);
    if (year < 2000 || year > 2100) {
      return res.status(400).json({ message: 'Invalid fiscal year' });
    }

    const result = await compensationStatementService.generateBulk(
      req.tenantId,
      year,
      req.userId,
    );

    res.status(200).json({ message: 'Bulk generation complete', ...result });
  } catch (error) {
    next(error);
  }
};

// ─── Retrieve ────────────────────────────────────────────────────────────

/**
 * GET /api/compensation-statements
 * List statements with filters and pagination.
 */
exports.list = async (req, res, next) => {
  try {
    const { fiscalYear, department, status, page, limit } = req.query;

    if (!fiscalYear) {
      return res.status(400).json({ message: 'fiscalYear query parameter is required' });
    }

    const result = await compensationStatementService.listStatements(
      req.tenantId,
      Number(fiscalYear),
      {
        department,
        status,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 50,
      },
    );

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/compensation-statements/:employeeId
 * Get a specific employee's statement for a fiscal year.
 */
exports.getByEmployee = async (req, res, next) => {
  try {
    const { fiscalYear } = req.query;
    if (!fiscalYear) {
      return res.status(400).json({ message: 'fiscalYear query parameter is required' });
    }

    const statement = await compensationStatementService.getStatement(
      req.tenantId,
      req.params.employeeId,
      Number(fiscalYear),
    );

    if (!statement) {
      return res.status(404).json({ message: 'Statement not found' });
    }

    res.status(200).json(statement);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/compensation-statements/summary
 * Aggregate CTC summary for a fiscal year.
 */
exports.getSummary = async (req, res, next) => {
  try {
    const { fiscalYear } = req.query;
    if (!fiscalYear) {
      return res.status(400).json({ message: 'fiscalYear query parameter is required' });
    }

    const result = await compensationStatementService.getCTCSummary(
      req.tenantId,
      Number(fiscalYear),
    );

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// ─── Actions ─────────────────────────────────────────────────────────────

/**
 * PATCH /api/compensation-statements/:id/share
 * Mark a statement as shared with the employee.
 */
exports.markShared = async (req, res, next) => {
  try {
    const statement = await compensationStatementService.markShared(
      req.tenantId,
      req.params.id,
      req.userId,
    );

    if (!statement) {
      return res.status(404).json({ message: 'Statement not found' });
    }

    res.status(200).json({ message: 'Statement marked as shared', statement });
  } catch (error) {
    next(error);
  }
};
