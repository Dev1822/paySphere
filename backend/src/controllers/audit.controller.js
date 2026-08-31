const auditLogRepository = require('../repositories/auditLog.repository');
const {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
} = require('../models/auditLog.model');
const cacheService = require('../services/cache.service');
const mongoose = require('mongoose');
const crypto = require('crypto');

function generateHash(payload, previousHash) {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(payload));
  if (previousHash) {
    hash.update(previousHash);
  }
  return hash.digest('hex');
}

function extractPayload(doc) {
  const obj = doc.toObject();
  delete obj.cryptoSeals;
  delete obj.updatedAt;
  delete obj.__v;
  const sortedObj = {};
  Object.keys(obj)
    .sort()
    .forEach((key) => {
      sortedObj[key] = obj[key];
    });
  return sortedObj;
}

/**
 * Reading the audit trail (#664).
 *
 * Both handlers filtered on `{ userId: req.userId }` and nothing else, so what
 * came back was the caller's own actions — a personal diary rather than a
 * company audit trail. An owner reviewing a payroll run saw only the half they
 * performed themselves; the HR manager who submitted it and the second approver
 * who signed it off were both invisible to them.
 *
 * The filter is the tenant now. `?actor=<userId>` narrows it back to one person
 * for the cases where that is genuinely what you want.
 */

/** The most rows one page may return. */
const MAX_PAGE_SIZE = 100;

/** The default page size, unchanged. */
const DEFAULT_PAGE_SIZE = 50;

/**
 * The most rows one CSV export may contain.
 *
 * The export had no bound at all: `AuditLog.find(query)` with no `limit`, every
 * document hydrated into a mongoose model and held in memory while the CSV
 * string is built. On a busy tenant a year of payroll activity is a lot of
 * documents to load to answer one request.
 */
const MAX_EXPORT_ROWS = 10000;

/**
 * The `{ $gte, $lte }` clause for an optional date range, or null.
 *
 * An unparseable date used to fall through to `new Date("nonsense")`, which is
 * an Invalid Date — mongoose then casts it and throws, so a typo in a query
 * string was a 500.
 *
 * @param {object} query the request query string
 * @returns {{ok: true, range: object|null} | {ok: false, message: string}}
 */
function parseDateRange({ startDate, endDate, days }) {
  if (startDate || endDate) {
    const range = {};

    if (startDate) {
      const from = new Date(startDate);
      if (isNaN(from.getTime())) {
        return { ok: false, message: 'Invalid startDate format' };
      }
      range.$gte = from;
    }

    if (endDate) {
      const to = new Date(endDate);
      if (isNaN(to.getTime())) {
        return { ok: false, message: 'Invalid endDate format' };
      }
      range.$lte = to;
    }

    if (range.$gte && range.$lte && range.$gte > range.$lte) {
      return { ok: false, message: 'startDate must be on or before endDate' };
    }

    return { ok: true, range };
  }

  if (days) {
    const daysNum = parseInt(days, 10);

    if (isNaN(daysNum) || daysNum <= 0) {
      return { ok: false, message: 'days must be a positive integer' };
    }

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - daysNum);

    return { ok: true, range: { $gte: pastDate } };
  }

  return { ok: true, range: null };
}

/**
 * Build the scoped query for both handlers.
 *
 * @param {object} req
 * @returns {{ok: true, query: object} | {ok: false, message: string}}
 */
function buildQuery(req) {
  // Throws MissingTenantError rather than handing back `{}` — see
  // utils/tenantScope.js for why an unscoped audit query is the dangerous case.
  const query = {};

  const parsed = parseDateRange(req.query);
  if (!parsed.ok) return parsed;
  if (parsed.range) query.createdAt = parsed.range;

  // Narrow to one actor. `?actor=me` is the old behaviour, kept because the
  // Settings page's "my recent activity" panel wants exactly that.
  if (req.query.actor) {
    query.userId = req.query.actor === 'me' ? req.userId : req.query.actor;
  }

  if (req.query.action) {
    if (!AUDIT_ACTIONS.includes(req.query.action)) {
      return { ok: false, message: `Unknown action: ${req.query.action}` };
    }
    query.action = req.query.action;
  }

  if (req.query.resourceType) {
    if (!AUDIT_RESOURCE_TYPES.includes(req.query.resourceType)) {
      return {
        ok: false,
        message: `Unknown resourceType: ${req.query.resourceType}`,
      };
    }
    query.resourceType = req.query.resourceType;
  }

  if (req.query.result) {
    if (!['success', 'failure', 'partial'].includes(req.query.result)) {
      return {
        ok: false,
        message: `Invalid result filter: ${req.query.result}`,
      };
    }
    query.result = req.query.result;
  }

  if (
    req.query.search &&
    typeof req.query.search === 'string' &&
    req.query.search.trim() !== ''
  ) {
    const searchRegex = new RegExp(req.query.search.trim(), 'i');
    query.$or = [
      { action: searchRegex },
      { resourceType: searchRegex },
      { ipAddress: searchRegex },
      { userAgent: searchRegex },
    ];
  }

  return { ok: true, query };
}

exports.getAuditLogs = async (req, res, next) => {
  try {
    const built = buildQuery(req);
    if (!built.ok) return res.error(built.message, null, 'bad_request', 400);

    let page = parseInt(req.query.page, 10);
    if (isNaN(page) || page < 1) page = 1;

    let limit = parseInt(req.query.limit, 10);
    if (isNaN(limit) || limit < 1) limit = 50;

    if (typeof MAX_PAGE_SIZE !== 'undefined' && limit > MAX_PAGE_SIZE) {
      limit = MAX_PAGE_SIZE;
    }

    const cacheKey = `audit:logs:${req.tenantId || 'unscoped'}:${cacheService.generateHash(JSON.stringify(built.query))}:p${page}:l${limit}`;
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      return res.success(cachedData);
    }

    const skip = (page - 1) * limit;

    // The count and the page in parallel: they are independent
    const [logs, totalLogs] = await Promise.all([
      auditLogRepository.findPaginatedLogs(built.query, skip, limit),
      auditLogRepository.countDocuments(built.query),
    ]);

    const processedLogs = logs.map((log) => ({
      ...log,
      userId: log.userId || { fullName: 'Deleted User', email: '' },
    }));

    const responsePayload = {
      logs: processedLogs,
      metadata: {
        totalRecords: totalLogs,
        totalPages: Math.ceil(totalLogs / limit) || 1,
        currentPage: page,
        pageSize: limit,
      },
    };

    // Cache the response payload with a 1-minute TTL (60 seconds)
    await cacheService.setEx(cacheKey, 60, responsePayload);

    // Return the response payload
    res.success(responsePayload);
  } catch (error) {
    next(error);
  }
};

// EXPORT AUDIT LOGS TO CSV
exports.exportAuditLogsCSV = async (req, res, next) => {
  try {
    const built = buildQuery(req);
    if (!built.ok) return res.error(built.message, null, 'bad_request', 400);

    const logs = await auditLogRepository.findExportLogs(
      built.query,
      MAX_EXPORT_ROWS,
    );

    const header = [
      'Timestamp',
      'Actor',
      'Actor Email',
      'Action',
      'Resource Type',
      'Resource IDs',
      'Result',
      'Details',
      'IP Address',
      'User Agent',
    ];

    const escapeCsvField = (value) => {
      if (value === undefined || value === null) return '';
      let str =
        typeof value === 'object' ? JSON.stringify(value) : String(value);
      if (/^[=+\-@\t\r]/.test(str)) {
        str = "'" + str;
      }
      if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = logs.map((log) => {
      const actor = log.userId || { fullName: 'Deleted User', email: '' };
      return [
        escapeCsvField(
          log.createdAt ? new Date(log.createdAt).toISOString() : '',
        ),
        escapeCsvField(actor.fullName),
        escapeCsvField(actor.email),
        escapeCsvField(log.action || ''),
        escapeCsvField(log.resourceType || ''),
        escapeCsvField(
          Array.isArray(log.resourceIds)
            ? log.resourceIds.join('; ')
            : log.resourceIds || '',
        ),
        escapeCsvField(log.result || 'success'),
        escapeCsvField(log.details || {}),
        escapeCsvField(log.ipAddress || log.ip || ''),
        escapeCsvField(log.userAgent || ''),
      ];
    });

    const csvContent = [
      header.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=audit_logs_${new Date().toISOString().split('T')[0]}.csv`,
    );

    return res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};

exports.MAX_PAGE_SIZE = MAX_PAGE_SIZE;
exports.DEFAULT_PAGE_SIZE = DEFAULT_PAGE_SIZE;
exports.MAX_EXPORT_ROWS = MAX_EXPORT_ROWS;
exports.parseDateRange = parseDateRange;

exports.verifyCryptographicChain = async (req, res, next) => {
  try {
    const { modelName, id } = req.params;

    // Validate model is supported for crypto sealing
    const supportedModels = ['PayrollUpdate', 'EmployeeTaxDeclaration'];
    if (!supportedModels.includes(modelName)) {
      return res.error(
        `Model ${modelName} not supported for verification`,
        null,
        'bad_request',
        400,
      );
    }

    const Model = mongoose.model(modelName);
    const doc = await Model.findOne({
      _id: id
    });

    if (!doc) {
      return res.error('Document not found', null, 'not_found', 404);
    }

    const seals = doc.cryptoSeals || [];
    if (seals.length === 0) {
      return res.success({
        valid: false,
        message: 'No cryptographic seals found on this document',
        history: [],
      });
    }

    const history = [];
    let valid = true;
    let brokenAt = null;
    let expectedPreviousHash = 'GENESIS';

    for (let i = 0; i < seals.length; i++) {
      const seal = seals[i];
      const payloadObj = JSON.parse(seal.payloadSnapshot);
      const computedHash = generateHash(payloadObj, expectedPreviousHash);

      const isBlockValid =
        computedHash === seal.hash &&
        seal.previousHash === expectedPreviousHash;

      history.push({
        index: i,
        timestamp: seal.timestamp,
        hash: seal.hash,
        previousHash: seal.previousHash,
        valid: isBlockValid,
      });

      if (!isBlockValid && valid) {
        valid = false;
        brokenAt = i;
      }

      expectedPreviousHash = seal.hash;
    }

    // Finally verify current document matches the last seal
    // This catches direct database tampering after the last valid save
    if (valid) {
      const currentPayload = extractPayload(doc);
      const lastSeal = seals[seals.length - 1];
      const currentPayloadSnapshot = JSON.stringify(currentPayload);

      if (currentPayloadSnapshot !== lastSeal.payloadSnapshot) {
        valid = false;
        brokenAt = seals.length; // Indicates failure after the last block
        history.push({
          index: seals.length,
          timestamp: new Date(),
          hash: 'TAMPERED_DB_STATE',
          previousHash: expectedPreviousHash,
          valid: false,
          note: 'Current database document payload does not match the last cryptographic seal.',
        });
      }
    }

    return res.success({
      valid,
      brokenAt,
      history,
    });
  } catch (error) {
    next(error);
  }
};
