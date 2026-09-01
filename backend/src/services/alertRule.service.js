/**
 * @fileoverview Payroll Anomaly Alert Service
 *
 * Evaluates active AlertRules against payroll data and persists
 * AlertRecords for every anomaly detected. Supports:
 *   - Full-scan evaluation across an entire payroll run
 *   - Per-employee targeted evaluation
 *   - Scan history and statistics
 *   - Disposition management (acknowledge, dismiss)
 */

'use strict';

const mongoose = require('mongoose');
const AlertRule = require('../models/alertRule.model');
const AlertRecord = require('../models/alertRecord.model');
const Employee = require('../models/employee.model');
const Payroll = require('../models/payroll.model');
const { tenantFilter } = require('../utils/tenantScope');
const logger = require('../utils/logger');

/**
 * Evaluate a single alert rule against one payroll entry.
 *
 * @param {object} rule  An AlertRule document
 * @param {object} entry A payroll row with employee context
 * @returns {object|null} A detected anomaly or null
 */
function evaluateRule(rule, entry) {
  const { alertType, threshold, secondaryThreshold } = rule;
  const salary = Number(entry.baseSalary) || Number(entry.netSalary) || 0;
  const netSalary = Number(entry.netSalary) || 0;
  const bonus = Number(entry.bonus) || 0;
  const overtimeHours = Number(entry.overtimeHours) || 0;
  const leaveDays = Number(entry.leaveDays) || 0;
  const deductions = Number(entry.deductions) || 0;

  switch (alertType) {
    case 'SALARY_SPIKE': {
      if (!entry._historicalAvg || entry._historicalAvg <= 0) return null;
      const pctChange = ((netSalary - entry._historicalAvg) / entry._historicalAvg) * 100;
      if (pctChange >= threshold) {
        return {
          score: Math.min(1, pctChange / 100),
          message: `Net salary ₹${netSalary.toLocaleString()} is ${pctChange.toFixed(1)}% above the historical average ₹${entry._historicalAvg.toLocaleString()}.`,
          details: { netSalary, historicalAvg: entry._historicalAvg, percentChange: Number(pctChange.toFixed(1)) },
        };
      }
      return null;
    }

    case 'EXCESSIVE_OVERTIME': {
      const limit = secondaryThreshold || 60;
      if (overtimeHours >= threshold && overtimeHours > limit) {
        return {
          score: Math.min(1, overtimeHours / (limit * 2)),
          message: `${overtimeHours} overtime hours exceed the threshold of ${threshold}h (limit: ${limit}h).`,
          details: { overtimeHours, threshold, limit },
        };
      }
      return null;
    }

    case 'EXCESSIVE_BONUS_RATIO': {
      if (salary <= 0 || bonus <= 0) return null;
      const ratio = (bonus / salary) * 100;
      if (ratio >= threshold) {
        return {
          score: Math.min(1, ratio / 100),
          message: `Bonus ₹${bonus.toLocaleString()} is ${ratio.toFixed(1)}% of base salary ₹${salary.toLocaleString()} (threshold: ${threshold}%).`,
          details: { bonus, baseSalary: salary, ratio: Number(ratio.toFixed(1)) },
        };
      }
      return null;
    }

    case 'DUPLICATE_BANK_ACCOUNT': {
      if (!entry._duplicateBankAccounts || entry._duplicateBankAccounts.length < 2) return null;
      return {
        score: 1.0,
        message: `Bank account shared across ${entry._duplicateBankAccounts.length} employees.`,
        details: { sharedWith: entry._duplicateBankAccounts },
      };
    }

    case 'NET_SALARY_OUTLIER': {
      if (!entry._batchMean || !entry._batchStdDev || entry._batchStdDev === 0) return null;
      const zScore = Math.abs((netSalary - entry._batchMean) / entry._batchStdDev);
      if (zScore >= threshold) {
        return {
          score: Math.min(1, zScore / 6),
          message: `Net salary ₹${netSalary.toLocaleString()} has a Z-score of ${zScore.toFixed(2)} (threshold: ${threshold}).`,
          details: { netSalary, zScore: Number(zScore.toFixed(2)), mean: entry._batchMean, stdDev: entry._batchStdDev },
        };
      }
      return null;
    }

    case 'ABNORMAL_DEDUCTION': {
      if (salary <= 0 || deductions <= 0) return null;
      const deductionPct = (deductions / salary) * 100;
      if (deductionPct >= threshold) {
        return {
          score: Math.min(1, deductionPct / 100),
          message: `Deductions ₹${deductions.toLocaleString()} are ${deductionPct.toFixed(1)}% of base salary (threshold: ${threshold}%).`,
          details: { deductions, baseSalary: salary, deductionPct: Number(deductionPct.toFixed(1)) },
        };
      }
      return null;
    }

    case 'HIGH_LEAVE_WITH_PAY': {
      if (leaveDays >= threshold) {
        return {
          score: Math.min(1, leaveDays / (threshold * 2)),
          message: `${leaveDays} leave days this period (threshold: ${threshold}).`,
          details: { leaveDays, threshold },
        };
      }
      return null;
    }

    default:
      return null;
  }
}

/**
 * Run a full anomaly scan for a tenant's payroll in a given month/year.
 *
 * @param {object} req   Express request with tenantId
 * @param {object} params
 * @param {number} params.year
 * @param {number} params.month
 * @param {string} [params.employeeId] — targeted scan
 * @returns {object} { scanId, records[], summary }
 */
async function runScan(req, { year, month, employeeId = null }) {
  const tenantId = req.tenantId;

  // 1. Fetch active rules
  const ruleFilter = { tenantId, enabled: true, deletedAt: null };
  if (employeeId) {
    // Rules still apply but we only scan one employee's payroll
  }
  const rules = await AlertRule.find(ruleFilter).lean();
  if (rules.length === 0) {
    logger.info('No active alert rules found — skipping scan', { tenantId: String(tenantId) });
    return { scanId: null, records: [], summary: { totalRules: 0, totalAlerts: 0, bySeverity: {} } };
  }

  // 2. Fetch payroll entries for the period
  const payrollFilter = { tenantId, year, month };
  if (employeeId) {
    payrollFilter.employeeId = employeeId;
  }
  const payrolls = await Payroll.find(payrollFilter)
    .populate('employeeId', 'fullName department role')
    .lean();

  if (payrolls.length === 0) {
    return { scanId: null, records: [], summary: { totalRules: rules.length, totalAlerts: 0, bySeverity: {} } };
  }

  // 3. Enrich payroll entries with context the rules need
  const enriched = enrichPayrollEntries(payrolls, rules);

  // 4. Build duplicate-bank-account map for DUPLICATE_BANK_ACCOUNT rule
  const bankMap = new Map();
  for (const p of enriched) {
    const acct = p.employee?.bankDetails?.accountNumber || p.bankAccountNumber || '';
    if (acct && acct.trim()) {
      const key = acct.trim();
      if (!bankMap.has(key)) bankMap.set(key, []);
      bankMap.get(key).push(String(p.employeeId?._id || p.employeeId));
    }
  }

  // 5. Evaluate rules against each payroll entry
  const detected = [];
  const scanId = new mongoose.Types.ObjectId();

  for (const rule of rules) {
    // Filter payroll by department/role scope
    let scoped = enriched;
    if (rule.departmentScope && rule.departmentScope.length > 0) {
      scoped = enriched.filter((e) =>
        rule.departmentScope.includes(e.employee?.department),
      );
    }
    if (rule.roleScope && rule.roleScope.length > 0) {
      scoped = scoped.filter((e) =>
        rule.roleScope.includes(e.employee?.role),
      );
    }

    for (const entry of scoped) {
      // Attach duplicate bank info for DUPLICATE_BANK_ACCOUNT rule
      if (rule.alertType === 'DUPLICATE_BANK_ACCOUNT') {
        const acct = entry.employee?.bankDetails?.accountNumber || entry.bankAccountNumber || '';
        const shared = bankMap.get(acct?.trim()) || [];
        if (shared.length > 1) {
          entry._duplicateBankAccounts = shared;
        }
      }

      const result = evaluateRule(rule, entry);
      if (result) {
        detected.push({
          ruleId: rule._id,
          ruleName: rule.name,
          alertType: rule.alertType,
          severity: rule.severity,
          employeeId: entry.employeeId?._id || entry.employeeId,
          employeeName: entry.employeeId?.fullName || entry.employeeName || '',
          payrollId: entry._id,
          score: result.score,
          message: result.message,
          details: result.details,
          scanRunId: scanId,
          year,
          month,
          createdBy: tenantId, // system-created
          tenantId,
        });
      }
    }
  }

  // 6. Persist records in bulk
  let savedRecords = [];
  if (detected.length > 0) {
    savedRecords = await AlertRecord.insertMany(detected, { ordered: false });

    // Update fire counts on rules
    const ruleFireCounts = new Map();
    for (const d of detected) {
      const rid = String(d.ruleId);
      ruleFireCounts.set(rid, (ruleFireCounts.get(rid) || 0) + 1);
    }
    for (const [rid, count] of ruleFireCounts.entries()) {
      await AlertRule.findByIdAndUpdate(rid, {
        $inc: { fireCount: count },
        $set: { lastFiredAt: new Date() },
      });
    }
  }

  // 7. Build summary
  const bySeverity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const r of detected) {
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
  }

  logger.info('Alert scan complete', {
    tenantId: String(tenantId),
    scanId: String(scanId),
    rules: rules.length,
    alerts: detected.length,
    bySeverity,
  });

  return {
    scanId,
    records: savedRecords,
    summary: {
      totalRules: rules.length,
      totalAlerts: detected.length,
      payrollEntriesScanned: payrolls.length,
      bySeverity,
    },
  };
}

/**
 * Enrich payroll entries with pre-computed context for rule evaluation.
 */
function enrichPayrollEntries(payrolls, rules) {
  const needsAvg = rules.some((r) => r.alertType === 'SALARY_SPIKE');
  const needsStats = rules.some((r) => r.alertType === 'NET_SALARY_OUTLIER');

  // Pre-compute batch statistics
  const netSalaries = payrolls.map((p) => Number(p.netSalary) || 0);
  const batchMean = needsStats ? netSalaries.reduce((s, v) => s + v, 0) / (netSalaries.length || 1) : 0;
  const batchStdDev = needsStats
    ? Math.sqrt(
        netSalaries.reduce((s, v) => s + Math.pow(v - batchMean, 2), 0) /
          Math.max(1, netSalaries.length - 1),
      )
    : 0;

  return payrolls.map((p) => {
    const entry = { ...p };
    if (needsStats) {
      entry._batchMean = batchMean;
      entry._batchStdDev = batchStdDev;
    }
    // Historical average placeholder — in a real implementation this
    // would query the last 6 months of payroll per employee. For now
    // we use baseSalary as the baseline.
    if (needsAvg) {
      entry._historicalAvg = Number(p.baseSalary) || Number(p.netSalary) || 0;
    }
    return entry;
  });
}

/**
 * Get paginated alert records for a tenant.
 */
async function getAlertRecords(req, { year, month, disposition, severity, page = 1, limit = 50 }) {
  const filter = { tenantId: req.tenantId };
  if (year) filter.year = year;
  if (month) filter.month = month;
  if (disposition) filter.disposition = disposition;
  if (severity) filter.severity = severity;

  const skip = (Math.max(1, page) - 1) * limit;
  const [records, total] = await Promise.all([
    AlertRecord.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AlertRecord.countDocuments(filter),
  ]);

  return {
    records,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get scan statistics for a tenant.
 */
async function getScanStats(req) {
  const tenantId = req.tenantId;

  const [totalAlerts, openAlerts, bySeverity, byType, recentAlerts] = await Promise.all([
    AlertRecord.countDocuments({ tenantId }),
    AlertRecord.countDocuments({ tenantId, disposition: 'OPEN' }),
    AlertRecord.aggregate([
      { $match: { tenantId } },
      { $group: { _id: '$severity', count: { $sum: 1 } } },
    ]),
    AlertRecord.aggregate([
      { $match: { tenantId } },
      { $group: { _id: '$alertType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    AlertRecord.find({ tenantId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('ruleName alertType severity employeeName message disposition createdAt')
      .lean(),
  ]);

  return {
    totalAlerts,
    openAlerts,
    acknowledgedAlerts: totalAlerts - openAlerts,
    bySeverity: Object.fromEntries(bySeverity.map((s) => [s._id, s.count])),
    byType: Object.fromEntries(byType.map((t) => [t._id, t.count])),
    recentAlerts,
  };
}

module.exports = {
  evaluateRule,
  runScan,
  getAlertRecords,
  getScanStats,
  enrichPayrollEntries,
};
