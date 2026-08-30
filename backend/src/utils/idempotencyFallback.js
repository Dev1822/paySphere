const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const logger = require('./logger');

const FALLBACK_DIR = path.join(__dirname, '../../.idempotency-fallback');

// Ensure directory exists synchronously on startup
if (!fsSync.existsSync(FALLBACK_DIR)) {
  fsSync.mkdirSync(FALLBACK_DIR, { recursive: true });
}

async function acquireFallbackLock(tenantId, idempotencyKey) {
  const filePath = path.join(FALLBACK_DIR, `${tenantId}-${idempotencyKey}.json`);
  const lockData = {
    tenantId,
    idempotencyKey,
    status: 'processing',
    timestamp: Date.now(),
  };

  try {
    // 'wx' flag fails if the file already exists (atomic operation)
    await fs.writeFile(filePath, JSON.stringify(lockData), { flag: 'wx' });
    return true;
  } catch (error) {
    if (error.code === 'EEXIST') {
      return false; // Lock already held
    }
    logger.error('Error acquiring local fallback lock', { error: error.message });
    throw error;
  }
}

async function getFallbackRecord(tenantId, idempotencyKey) {
  const filePath = path.join(FALLBACK_DIR, `${tenantId}-${idempotencyKey}.json`);
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    logger.error('Error reading local fallback record', { error: error.message });
    throw error;
  }
}

async function completeFallbackRecord(tenantId, idempotencyKey, responseStatus, responseBody) {
  const filePath = path.join(FALLBACK_DIR, `${tenantId}-${idempotencyKey}.json`);
  const record = {
    tenantId,
    idempotencyKey,
    status: 'completed',
    responseStatus,
    responseBody,
    timestamp: Date.now(),
  };

  try {
    await fs.writeFile(filePath, JSON.stringify(record));
  } catch (error) {
    logger.error('Error completing local fallback record', { error: error.message });
  }
}

module.exports = {
  acquireFallbackLock,
  getFallbackRecord,
  completeFallbackRecord,
};
