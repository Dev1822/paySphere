const crypto = require('crypto');
const mongoose = require('mongoose');

/**
 * Mask a string/numeric value based on the requested masking style.
 */
function maskValue(value, type) {
  if (value === null || value === undefined) return value;
  const str = String(value);

  if (type === 'full') {
    return '[MASKED]';
  } else if (type === 'partial') {
    if (str.length <= 4) {
      return 'X'.repeat(str.length);
    }
    return 'X'.repeat(str.length - 4) + str.slice(-4);
  } else if (type === 'hashing') {
    return crypto.createHash('sha256').update(str).digest('hex');
  }
  return value;
}

/**
 * Mongoose Query Post-Hook Plugin for PII masking.
 */
function piiMaskingPlugin(schema) {
  async function maskDocs(docs, query) {
    if (!docs) return;

    const options = query.getOptions();
    const tenantId = options.tenantId;
    const userRole = options.userRole;

    if (!tenantId || !userRole) {
      return;
    }

    try {
      const DataPrivacyPolicy = mongoose.model('DataPrivacyPolicy');
      const policy = await DataPrivacyPolicy.findOne({ tenantId, isActive: true }).lean();
      if (!policy || !policy.rules || policy.rules.length === 0) {
        return;
      }

      const modelName = query.model.modelName;
      const arrayDocs = Array.isArray(docs) ? docs : [docs];

      for (const doc of arrayDocs) {
        const isMongooseDoc = typeof doc.set === 'function';
        const obj = isMongooseDoc ? doc._doc : doc;

        for (const rule of policy.rules) {
          let fieldPath = rule.path;
          if (fieldPath.startsWith(`${modelName}.`)) {
            fieldPath = fieldPath.substring(modelName.length + 1);
          } else if (fieldPath.includes('.')) {
            // Ignore rules targeting other models
            continue;
          }

          const affectsRole = rule.roles.includes(userRole);
          if (!affectsRole || rule.maskingType === 'cleartext') {
            continue;
          }

          if (obj[fieldPath] !== undefined) {
            obj[fieldPath] = maskValue(obj[fieldPath], rule.maskingType);
          }
        }
      }
    } catch (err) {
      // Fail silently to avoid breaking main application queries
      const logger = require('./logger');
      if (logger && typeof logger.error === 'function') {
        logger.error('PII Masking Plugin Error:', { error: err.message });
      }
    }
  }

  schema.post('find', async function(docs) {
    await maskDocs(docs, this);
  });

  schema.post('findOne', async function(doc) {
    await maskDocs(doc, this);
  });
}

module.exports = piiMaskingPlugin;
