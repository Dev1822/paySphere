/**
 * @fileoverview System Health & Readiness Controller (TypeScript Migration)
 * @description Provides kubernetes/orchestrator liveness probes, database readiness checks,
 * and Prometheus metrics exposition with strict type-safety.
 * Issue: #1396
 */

import { Request, Response } from 'express';

const mongoose = require('mongoose');
const logger = require('../utils/logger');

export interface LivenessResponse {
  status: 'ok';
  uptime: number;
}

export interface ReadinessChecks {
  mongo: boolean;
  redis: boolean;
}

export interface ReadinessResponse {
  status: 'ready' | 'degraded' | 'shutting_down';
  checks: ReadinessChecks;
  errors: string[];
}

/**
 * Liveness probe handler.
 */
export function liveness(req: Request, res: Response): void {
  res.json({ status: 'ok', uptime: process.uptime() });
}

/**
 * Readiness probe handler verifying MongoDB and Redis connectivity.
 */
export async function readiness(req: Request, res: Response): Promise<Response> {
  try {
    const { getIsShuttingDown } = require('../shutdown');
    if (getIsShuttingDown && getIsShuttingDown()) {
      return res.status(503).json({
        status: 'shutting_down',
        checks: { mongo: false, redis: false },
        errors: ['Shutdown in progress'],
      });
    }
  } catch {
    // Optional shutdown hook
  }

  const checks: ReadinessChecks = { mongo: false, redis: false };
  const errors: string[] = [];

  try {
    if (mongoose.connection && mongoose.connection.db && mongoose.connection.db.admin) {
      await mongoose.connection.db.admin().ping();
      checks.mongo = true;
    } else {
      errors.push('MongoDB: Connection not initialized');
    }
  } catch (err: any) {
    errors.push('MongoDB: ' + (err.message || 'Connection error'));
    logger.warn('Readiness: MongoDB ping failed', { error: err.message });
  }

  try {
    const { isRedisAvailable } = require('../config/redis');
    checks.redis = typeof isRedisAvailable === 'function' ? isRedisAvailable() : false;
  } catch (_e) {
    checks.redis = false;
  }

  const ready = checks.mongo;
  return res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'degraded',
    checks,
    errors,
  });
}

/**
 * Prometheus metrics exposition handler.
 */
export async function metrics(req: Request, res: Response): Promise<void> {
  try {
    const c = require('prom-client');
    res.set('Content-Type', c.register.contentType);
    res.end(await c.register.metrics());
  } catch (err: any) {
    logger.error('Failed to serve metrics', { error: err.message });
    res.status(500).end('# metrics unavailable\n');
  }
}
