const ForecastConfiguration = require('../models/forecastConfiguration.model');
const { executeForecastSimulation } = require('../services/forecast.service');
const logger = require('../utils/logger');

exports.triggerForecast = async (req, res, next) => {
  try {
    const {
      name,
      historicalRange,
      targetPeriod,
      adjustmentFactors,
      confidenceInterval,
      departmentBudgets,
    } = req.body;

    const tenantId = req.tenantId;
    const userId = req.userId;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (!historicalRange || !historicalRange.fromYear || !historicalRange.fromMonth || !historicalRange.toYear || !historicalRange.toMonth) {
      return res.status(400).json({ error: 'historicalRange containing fromYear/fromMonth/toYear/toMonth is required' });
    }
    if (!targetPeriod || !targetPeriod.targetYear || !targetPeriod.targetMonth) {
      return res.status(400).json({ error: 'targetPeriod containing targetYear/targetMonth is required' });
    }

    const config = new ForecastConfiguration({
      tenantId,
      name,
      historicalRange,
      targetPeriod,
      adjustmentFactors: adjustmentFactors || { inflationRate: 0, incrementTrend: 0 },
      confidenceInterval: confidenceInterval !== undefined ? confidenceInterval : 0.95,
      departmentBudgets: departmentBudgets || {},
      status: 'PENDING',
      createdBy: userId,
    });

    await config.save();

    // Execute asynchronously to avoid event-loop blocking
    executeForecastSimulation(config._id).catch((err) => {
      logger.error(`Asynchronous forecast simulation failed for config ${config._id}`, { error: err.message });
    });

    res.status(202).json({
      message: 'Forecasting simulation triggered successfully',
      forecastId: config._id,
      status: config.status,
    });
  } catch (error) {
    next(error);
  }
};

exports.getForecastResults = async (req, res, next) => {
  try {
    const { forecastId } = req.params;
    const tenantId = req.tenantId;

    const config = await ForecastConfiguration.findOne({ _id: forecastId, tenantId });
    if (!config) {
      return res.status(404).json({ error: 'Forecast configuration not found' });
    }

    res.json({
      forecastId: config._id,
      name: config.name,
      status: config.status,
      historicalRange: config.historicalRange,
      targetPeriod: config.targetPeriod,
      adjustmentFactors: config.adjustmentFactors,
      confidenceInterval: config.confidenceInterval,
      results: config.results,
    });
  } catch (error) {
    next(error);
  }
};
