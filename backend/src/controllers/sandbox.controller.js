const { SandboxSession } = require('../models/sandboxSession.model');
const {
  runSandboxSimulation,
  getComparisonReport,
  commitSandboxSession,
  rollbackSandboxSession,
} = require('../services/sandboxEngine.service');

exports.createSession = async (req, res, next) => {
  try {
    const { name, targets, draftComponents } = req.body;
    const tenantId = req.tenantId;
    const userId = req.userId;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const session = new SandboxSession({
      tenantId,
      name,
      targets: targets || { departments: [], employeeIds: [] },
      draftComponents: draftComponents || [],
      isActive: true,
      createdBy: userId,
    });

    await session.save();

    res.status(201).json({
      message: 'Sandbox session created successfully',
      session,
    });
  } catch (error) {
    next(error);
  }
};

exports.runSimulation = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const tenantId = req.tenantId;

    const records = await runSandboxSimulation(tenantId, sessionId);
    res.json({
      message: 'Simulation executed successfully',
      count: records.length,
      records,
    });
  } catch (error) {
    next(error);
  }
};

exports.getCompare = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const tenantId = req.tenantId;

    const report = await getComparisonReport(tenantId, sessionId);
    res.json({
      sessionId,
      report,
    });
  } catch (error) {
    next(error);
  }
};

exports.commitSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const tenantId = req.tenantId;
    const userId = req.userId;

    const session = await commitSandboxSession(tenantId, sessionId, userId);
    res.json({
      message: 'Sandbox session committed successfully to live records',
      session,
    });
  } catch (error) {
    next(error);
  }
};

exports.rollbackSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const tenantId = req.tenantId;

    const session = await rollbackSandboxSession(tenantId, sessionId);
    res.json({
      message: 'Sandbox session rolled back successfully',
      session,
    });
  } catch (error) {
    next(error);
  }
};
