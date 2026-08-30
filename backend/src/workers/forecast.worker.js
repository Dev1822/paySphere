const { parentPort, workerData } = require('worker_threads');

function calculateProjections({ historicalData, adjustmentFactors, confidenceInterval, departmentBudgets }) {
  const { inflationRate = 0, incrementTrend = 0 } = adjustmentFactors || {};
  const multiplier = 1 + (Number(inflationRate) / 100) + (Number(incrementTrend) / 100);

  // Group historical data by department
  const byDept = {};
  for (const item of historicalData || []) {
    const dept = item.department || 'Unknown';
    if (!byDept[dept]) byDept[dept] = [];
    byDept[dept].push(Number(item.totalPayrollCost || 0));
  }

  const results = {};

  // Map confidence level to standard z-scores
  const zScore = confidenceInterval >= 0.99 ? 2.58 : confidenceInterval >= 0.95 ? 1.96 : 1.645;

  for (const [dept, costs] of Object.entries(byDept)) {
    const count = costs.length;
    if (count === 0) continue;

    const sum = costs.reduce((a, b) => a + b, 0);
    const mean = sum / count;

    // Calculate standard deviation
    const varianceSum = costs.reduce((a, b) => a + Math.pow(b - mean, 2), 0);
    const stdDev = Math.sqrt(varianceSum / count) || 0;

    // Base projected cost
    const projectedCost = mean * multiplier;

    // Confidence bound variance
    const bound = zScore * stdDev * multiplier;
    const highEstimate = projectedCost + bound;
    const lowEstimate = Math.max(0, projectedCost - bound);

    // Retrieve budget cap from map (using case-insensitive comparison or default)
    let budgetCap = Infinity;
    if (departmentBudgets) {
      const keys = Object.keys(departmentBudgets);
      const match = keys.find(k => k.toLowerCase() === dept.toLowerCase());
      if (match) {
        budgetCap = departmentBudgets[match];
      }
    }

    const isExceeded = projectedCost > budgetCap;

    results[dept] = {
      projectedCost: Math.round(projectedCost * 100) / 100,
      highEstimate: Math.round(highEstimate * 100) / 100,
      lowEstimate: Math.round(lowEstimate * 100) / 100,
      budgetCap: budgetCap === Infinity ? null : budgetCap,
      isExceeded,
      deficit: isExceeded ? Math.round((projectedCost - budgetCap) * 100) / 100 : 0,
    };
  }

  return results;
}

// Execute and return result
try {
  const output = calculateProjections(workerData);
  parentPort.postMessage({ success: true, results: output });
} catch (error) {
  parentPort.postMessage({ success: false, error: error.message });
}
