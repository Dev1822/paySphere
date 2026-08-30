/**
 * @fileoverview Worker Thread Pool & S3 Export Streaming Service
 * @description Bounded worker thread pool for high-concurrency PDF/CSV report generation,
 * preventing memory leaks and CPU thrashing under peak load, with S3 upload integration.
 */

'use strict';

const { Worker } = require('worker_threads');
const path = require('path');
const os = require('os');
const logger = require('../utils/logger');
const { getDownloadUrl, putObject } = require('./objectStorage.service');

// Cap maximum concurrent worker threads to CPU core count minus one (minimum 2)
const MAX_WORKERS = Math.max(2, os.cpus().length - 1);

class WorkerThreadPool {
  constructor(maxWorkers = MAX_WORKERS) {
    this.maxWorkers = maxWorkers;
    this.activeWorkers = 0;
    this.queue = [];
  }

  /**
   * Execute a task on a worker thread or queue it if pool is saturated.
   *
   * @param {string} workerScript Absolute path to worker script
   * @param {object} workerData Input payload for worker
   * @returns {Promise<any>}
   */
  runTask(workerScript, workerData) {
    return new Promise((resolve, reject) => {
      const task = { workerScript, workerData, resolve, reject };

      if (this.activeWorkers < this.maxWorkers) {
        this._executeTask(task);
      } else {
        logger.info('Worker thread pool saturated, queueing export task', {
          queueLength: this.queue.length + 1,
          activeWorkers: this.activeWorkers,
          maxWorkers: this.maxWorkers,
        });
        this.queue.push(task);
      }
    });
  }

  _executeTask({ workerScript, workerData, resolve, reject }) {
    this.activeWorkers++;
    const worker = new Worker(workerScript, { workerData });

    const cleanup = () => {
      this.activeWorkers--;
      this._processNext();
    };

    worker.on('message', (msg) => {
      cleanup();
      if (msg.success) {
        resolve(msg);
      } else {
        reject(new Error(msg.error || 'Worker execution failed'));
      }
    });

    worker.on('error', (err) => {
      cleanup();
      logger.error('Worker thread encountered error:', { error: err.message });
      reject(err);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        cleanup();
        reject(new Error(`Worker stopped with non-zero exit code: ${code}`));
      }
    });
  }

  _processNext() {
    if (this.queue.length > 0 && this.activeWorkers < this.maxWorkers) {
      const nextTask = this.queue.shift();
      this._executeTask(nextTask);
    }
  }
}

const pool = new WorkerThreadPool();

class ExportService {
  constructor() {
    this.pool = pool;
  }

  /**
   * Spawns/queues a worker thread to generate a PDF report.
   * @param {object} data
   * @returns {Promise<Buffer>}
   */
  async generatePDF(data) {
    const workerPath = path.resolve(__dirname, '../workers/pdf.worker.js');
    const result = await this.pool.runTask(workerPath, data);
    return Buffer.from(result.buffer);
  }

  /**
   * Spawns/queues a worker thread to generate a CSV export.
   * @param {object} data
   * @returns {Promise<string>}
   */
  async generateCSV(data) {
    const workerPath = path.resolve(__dirname, '../workers/csv.worker.js');
    const result = await this.pool.runTask(workerPath, data);
    return result.csvString;
  }

  /**
   * Stream export file to S3 / Cloud Storage and return a presigned download URL.
   *
   * @param {string} filename File name (e.g. 'payroll-aug-2026.pdf')
   * @param {Buffer|string} content Content buffer or string
   * @param {string} mimeType Content MIME type
   * @returns {Promise<{fileUrl: string, key: string, expiresAt: string}>}
   */
  async uploadToS3(filename, content, mimeType = 'application/pdf') {
    const safeFilename = String(filename || 'export.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `exports/${Date.now()}_${safeFilename}`;
    const stored = await putObject({
      key,
      body: content,
      contentType: mimeType,
    });
    const expiresIn = 3600;
    const fileUrl = await getDownloadUrl(stored.uri, { expiresIn });

    return {
      fileUrl,
      key: stored.key,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      uri: stored.uri,
    };
  }
}

module.exports = new ExportService();
