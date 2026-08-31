const { Worker } = require('worker_threads');
const path = require('path');
const ForecastConfiguration = require('../models/forecastConfiguration.model');
const PayrollUpdate = require('../models/payroll.model');
const Employee = require('../models/employee.model');
const eventBus = require('./event.service');
const { emitToUser } = require('../notifications/registry');
const logger = require('../utils/logger');

/**
 * Spawns the forecast worker thread
 */
function runForecastWorker(workerData) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.resolve(__dirname, '../workers/forecast.worker.js'), {
      workerData,
    });

    worker.on('message', (message) => {
      if (message.success) {
        resolve(message.results);
      } else {
        reject(new Error(message.error));
      }
    });

    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
}

/**
 * Executes a forecasting simulation task
 */
async function executeForecastSimulation(forecastId) {
  const config = await ForecastConfiguration.findById(forecastId);
  if (!config) {
    throw new Error('Forecast configuration not found');
  }

  try {
    const { fromYear, fromMonth, toYear, toMonth } = config.historicalRange;
    const startOrdinal = fromYear * 12 + (fromMonth - 1);
    const endOrdinal = toYear * 12 + (toMonth - 1);

    // Query historical payroll updates
    const rawRecords = await PayrollUpdate.find({
      tenantId: config.tenantId,
      year: { $gte: fromYear, $lte: toYear },
    }).populate({
      path: 'employeeId',
      select: 'department',
    }).lean();

    const historicalData = [];
    for (const r of rawRecords) {
      const ord = r.year * 12 + (r.month - 1);
      if (ord >= startOrdinal && ord <= endOrdinal) {
        // Resolve department
        const department = r.employeeId?.department || 'Unassigned';
        historicalData.push({
          department,
          month: r.month,
          year: r.year,
          totalPayrollCost: r.netSalary || 0,
        });
      }
    }

    if (historicalData.length === 0) {
      throw new Error('No historical payroll records found in the specified range');
    }

    // Convert map to plain object for thread passing
    const budgetsObj = {};
    if (config.departmentBudgets instanceof Map) {
      for (const [key, val] of config.departmentBudgets.entries()) {
        budgetsObj[key] = val;
      }
    } else if (config.departmentBudgets) {
      Object.assign(budgetsObj, config.departmentBudgets);
    }

    // Run multi-threaded statistical projections
    const results = await runForecastWorker({
      historicalData,
      adjustmentFactors: {
        inflationRate: config.adjustmentFactors.inflationRate,
        incrementTrend: config.adjustmentFactors.incrementTrend,
      },
      confidenceInterval: config.confidenceInterval,
      departmentBudgets: budgetsObj,
    });

    // Run Alert engine to check for budget violations
    for (const [dept, data] of Object.entries(results)) {
      if (data.isExceeded) {
        // Raise Compliance Alert Log
        eventBus.emit('AUDIT_LOG', {
          userId: config.createdBy.toString(),
          action: 'BUDGET_OVERRUN_WARNING',
          resourceType: 'ForecastConfiguration',
          resourceIds: [config._id],
          details: {
            department: dept,
            projectedCost: data.projectedCost,
            budgetCap: data.budgetCap,
            deficit: data.deficit,
          },
        });

        // Trigger real-time WebSocket alert
        emitToUser(config.createdBy.toString(), 'forecast_alert', {
          message: `Warning: Projected payroll for department "${dept}" exceeds budget limit by ${data.deficit}`,
          forecastId: config._id,
          department: dept,
          deficit: data.deficit,
        });
      }
    }

    // Update session results
    config.status = 'COMPLETED';
    config.results = results;
    await config.save();

    logger.info(`Successfully completed payroll cost forecast run: ${forecastId}`);
    return config;
  } catch (error) {
    config.status = 'FAILED';
    await config.save();
    logger.error(`Forecasting simulation task failed: ${forecastId}`, { error: error.message });
    throw error;
  }
}

module.exports = {
  executeForecastSimulation,
  runForecastWorker,
};
