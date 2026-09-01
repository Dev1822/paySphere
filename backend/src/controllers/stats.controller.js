const Employee = require('../models/employee.model');
const cacheService = require('../services/cache.service');
const logger = require('../utils/logger');

const STATS_CACHE_TTL = 300;
const DEPARTMENTS_CACHE_TTL = 600;

const getTenantCacheKey = (prefix, tenantId) => `${prefix}:${tenantId}`;

function requireTenantId(req, res) {
  if (!req.tenantId) {
    res.status(400).json({ message: 'Tenant context is required' });
    return false;
  }
  return true;
}

exports.getDepartments = async (req, res, next) => {
  if (!requireTenantId(req, res)) return;

  const tenantId = req.tenantId;
  const cacheKey = getTenantCacheKey('departments', tenantId);

  try {
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.status(200).json({ ...cached, _cached: true });
    }

    const rows = await Employee.aggregate([
      { $match: { tenantId, isDeleted: { $ne: true } } },
      {
        $project: {
          department: {
            $cond: [
              { $gt: [{ $strLenCP: { $ifNull: ['$department', ''] } }, 0] },
              '$department',
              '$role',
            ],
          },
        },
      },
      { $match: { department: { $type: 'string', $ne: '' } } },
      { $group: { _id: '$department', employeeCount: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    const departments = rows.map(({ _id, employeeCount }) => ({
      name: _id,
      employeeCount,
    }));
    const payload = { departments, count: departments.length };

    await cacheService.setEx(cacheKey, DEPARTMENTS_CACHE_TTL, payload, [
      `departments:${tenantId}`,
    ]);

    return res.status(200).json({ ...payload, _cached: false });
  } catch (error) {
    logger.error('Failed to fetch departments', {
      tenantId,
      error: error.message,
    });
    return next(error);
  }
};

exports.getStats = async (req, res, next) => {
  if (!requireTenantId(req, res)) return;

  const tenantId = req.tenantId;
  const cacheKey = getTenantCacheKey('stats', tenantId);

  try {
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.status(200).json({ ...cached, _cached: true });
    }

    const [employeeStats] = await Employee.aggregate([
      { $match: { tenantId, isDeleted: { $ne: true } } },
      {
        $group: {
          _id: null,
          totalEmployees: { $sum: 1 },
          activeEmployees: {
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] },
          },
          totalMonthlySalary: { $sum: { $ifNull: ['$monthlySalary', 0] } },
          departments: { $addToSet: '$department' },
        },
      },
    ]);

    const stats = employeeStats || {
      totalEmployees: 0,
      activeEmployees: 0,
      totalMonthlySalary: 0,
      departments: [],
    };

    const payload = {
      stats: {
        totalEmployees: stats.totalEmployees || 0,
        activeEmployees: stats.activeEmployees || 0,
        inactiveEmployees: Math.max(
          (stats.totalEmployees || 0) - (stats.activeEmployees || 0),
          0,
        ),
        totalDepartments: (stats.departments || []).filter(
          (department) => typeof department === 'string' && department.trim(),
        ).length,
        totalMonthlySalary: stats.totalMonthlySalary || 0,
      },
    };

    await cacheService.setEx(cacheKey, STATS_CACHE_TTL, payload, [
      `stats:${tenantId}`,
    ]);

    return res.status(200).json({ ...payload, _cached: false });
  } catch (error) {
    logger.error('Failed to fetch employee stats', {
      tenantId,
      error: error.message,
    });
    return next(error);
  }
};

exports.invalidateStatsCaches = async (tenantId) => {
  if (!tenantId) return;
  await Promise.all([
    cacheService.del(getTenantCacheKey('stats', tenantId)),
    cacheService.del(getTenantCacheKey('departments', tenantId)),
  ]);
};

exports.STATS_CACHE_TTL = STATS_CACHE_TTL;
exports.DEPARTMENTS_CACHE_TTL = DEPARTMENTS_CACHE_TTL;
