/**
 * HRMS integration settings (#954).
 *
 * `IntegrationConfig` has had no writer since it was added, so the collection
 * is empty for every tenant and neither adapter's `fetchEmployees()` has ever
 * run. These handlers are the way in.
 *
 * The part that needs care is the credentials. The model's own comment says
 * they "must be encrypted at the application layer before being written here",
 * and since nothing wrote them, nothing has ever had to. The first
 * implementation that forgets stores a BambooHR API key and a Workday password
 * in plaintext and hands them back out on the next GET, so: encrypted on write,
 * decrypted only where an adapter is built, and never returned to a client in
 * either form.
 */

const mongoose = require('mongoose');
const IntegrationConfig = require('../models/integrationConfig.model');
const registry = require('../integrations/registry');
const { syncTenant } = require('../services/integrationSync.service');
const { encrypt, mask } = require('../services/encryption.service');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');

/** Credential keys each provider needs, so a config cannot be saved half-built. */
const REQUIRED_CREDENTIALS = {
  bamboohr: ['apiKey', 'subdomain'],
  workday: ['username', 'password', 'raasUrl'],
  adp: ['clientId', 'clientSecret'],
  sap: ['username', 'password', 'baseUrl'],
};

/** Keys whose value is a secret rather than an address. */
const SECRET_KEYS = ['apiKey', 'password', 'clientSecret', 'token'];

/**
 * What a client is allowed to see of a stored config.
 *
 * Secrets are masked to their last four characters — enough for an admin to
 * recognise which key is installed, not enough to use it. Addresses (subdomain,
 * RAAS URL) are returned whole, because they are not secrets and hiding them
 * makes the screen useless.
 *
 * @param {object} config
 * @returns {object}
 */
function present(config) {
  const credentials = Object.entries(config.credentials || {}).reduce(
    (acc, [key, value]) => {
      acc[key] = SECRET_KEYS.includes(key) ? mask(String(value), 4) : value;
      return acc;
    },
    {},
  );

  return {
    _id: config._id,
    provider: config.provider,
    isActive: config.isActive,
    syncSchedule: config.syncSchedule,
    lastSyncAt: config.lastSyncAt,
    lastSyncStatus: config.lastSyncStatus,
    lastSyncError: config.lastSyncError,
    credentials,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

/**
 * Encrypt the secret half of a credentials blob.
 *
 * Only the secrets: encrypting a subdomain would make it unreadable in the
 * database for no gain, and the point of encrypting at all is that a dump of
 * the collection does not hand somebody a working API key.
 *
 * @param {object} credentials
 * @returns {object}
 */
function protectCredentials(credentials = {}) {
  return Object.entries(credentials).reduce((acc, [key, value]) => {
    acc[key] = SECRET_KEYS.includes(key) ? encrypt(String(value)) : value;
    return acc;
  }, {});
}

/**
 * GET /api/integrations/providers
 *
 * What can be connected, and what each one needs. Served from the registry so
 * a provider registered by a plugin appears here without touching this file.
 */
exports.listProviders = async (req, res, next) => {
  try {
    const providers = registry.listProviders().map((name) => ({
      name,
      requiredCredentials: REQUIRED_CREDENTIALS[name] || [],
    }));

    res.status(200).json({ providers });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/integrations
 */
exports.listIntegrations = async (req, res, next) => {
  try {
    const configs = await IntegrationConfig.find({})
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      count: configs.length,
      integrations: configs.map(present),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/integrations/:provider
 *
 * Upsert, because there is one config per tenant per provider and the client
 * should not have to know whether it exists yet.
 */
exports.upsertIntegration = async (req, res, next) => {
  try {
    const provider = String(req.params.provider || '').toLowerCase();

    // Checked here rather than left to `registry.getAdapter`, which throws:
    // an unknown provider is a 400 the caller can act on, not a 500.
    if (!registry.listProviders().includes(provider)) {
      return res.status(400).json({
        message: `Unknown provider "${provider}". Supported: ${registry.listProviders().join(', ')}`,
      });
    }

    const body = req.body || {};
    const credentials = body.credentials || {};

    const missing = (REQUIRED_CREDENTIALS[provider] || []).filter(
      (key) => !credentials[key],
    );

    if (missing.length > 0) {
      return res.status(400).json({
        message: `Missing credentials for ${provider}: ${missing.join(', ')}`,
      });
    }

    const update = {
      credentials: protectCredentials(credentials),
      isActive: body.isActive !== false,
      updatedBy: req.userId,
    };

    if (body.syncSchedule) update.syncSchedule = String(body.syncSchedule);

    const config = await IntegrationConfig.findOneAndUpdate(
      {
        provider
      },
      {
        $set: update,
        $setOnInsert: {
          provider,
          createdBy: req.userId
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'SETTINGS_UPDATE',
      resourceType: 'IntegrationConfig',
      resourceIds: [config._id],
      details: { provider, isActive: config.isActive },
      req,
    });

    logger.info('HRMS integration configured', {
      tenantId: String(req.tenantId),
      provider,
    });

    // `present` and not the document: the response must not carry the
    // credentials back out, in either form.
    res.status(200).json({
      message: `${provider} integration saved`,
      integration: present(config.toObject ? config.toObject() : config),
    });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return res.status(400).json({
        message: 'Integration config is invalid',
        errors: Object.values(error.errors).map((e) => e.message),
      });
    }
    next(error);
  }
};

/**
 * POST /api/integrations/:provider/sync
 *
 * Run a sync now, rather than waiting for the schedule.
 */
exports.triggerSync = async (req, res, next) => {
  try {
    const provider = String(req.params.provider || '').toLowerCase();

    const config = await IntegrationConfig.findOne({
      provider
    }).lean();

    if (!config) {
      return res.status(404).json({
        message: `No ${provider} integration is configured for this company`,
      });
    }

    if (!config.isActive) {
      return res.status(409).json({
        message: `The ${provider} integration is disabled. Enable it before syncing.`,
      });
    }

    const result = await syncTenant(config);

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'EMPLOYEE_IMPORT',
      resourceType: 'IntegrationConfig',
      resourceIds: [config._id],
      details: {
        provider,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped.length,
      },
      result: result.status === 'success' ? 'success' : 'partial',
      req,
    });

    // 200 for a partial run: some employees really were imported, and the body
    // says which rows were not. A 500 would suggest nothing happened.
    const status = result.status === 'failed' ? 502 : 200;

    res.status(status).json({
      message:
        result.status === 'failed'
          ? `Sync failed: ${result.error}`
          : `Synced ${result.created} new and ${result.updated} existing employees`,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/integrations/:provider
 */
exports.deleteIntegration = async (req, res, next) => {
  try {
    const provider = String(req.params.provider || '').toLowerCase();

    const config = await IntegrationConfig.findOneAndDelete({
      provider
    });

    if (!config) {
      return res.status(404).json({ message: 'Integration not found' });
    }

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'SETTINGS_UPDATE',
      resourceType: 'IntegrationConfig',
      resourceIds: [config._id],
      details: { provider, deleted: true },
      req,
    });

    // The employees it imported are left alone. They are this company's
    // records now, and disconnecting a source is not a decision to delete the
    // people it told us about.
    res.status(200).json({
      message: `${provider} integration removed. Imported employees were kept.`,
    });
  } catch (error) {
    if (!mongoose.Types.ObjectId.isValid(req.tenantId)) {
      return res.status(403).json({ message: 'Invalid tenant scope' });
    }
    next(error);
  }
};

exports.getFieldMapping = async (req, res, next) => {
  try {
    const provider = String(req.params.provider || '').toLowerCase();
    const IntegrationFieldMap = require('../models/integrationFieldMap.model');
    let map = await IntegrationFieldMap.findOne({
      provider
    }).lean();
    if (!map) {
      map = { provider, mapping: { fullName: 'fullName', department: 'department', monthlySalary: 'monthlySalary' } };
    }
    res.status(200).json({ mapping: map.mapping });
  } catch (error) {
    next(error);
  }
};

exports.saveFieldMapping = async (req, res, next) => {
  try {
    const provider = String(req.params.provider || '').toLowerCase();
    const { mapping } = req.body;
    if (!mapping) return res.status(400).json({ message: 'Mapping object is required.' });

    const IntegrationFieldMap = require('../models/integrationFieldMap.model');
    const map = await IntegrationFieldMap.findOneAndUpdate(
      {
        provider
      },
      { $set: { mapping } },
      { new: true, upsert: true }
    );
    res.status(200).json({ message: 'Field mapping saved successfully.', mapping: map.mapping });
  } catch (error) {
    next(error);
  }
};

exports._internals = {
  present,
  protectCredentials,
  REQUIRED_CREDENTIALS,
  SECRET_KEYS,
};
