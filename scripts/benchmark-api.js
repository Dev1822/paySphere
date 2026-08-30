#!/usr/bin/env node
'use strict';

/**
 * PaySphere API performance benchmark runner (#748).
 *
 * Runs one or more HTTP benchmarks with autocannon and writes a local Markdown
 * report. The runner is intentionally environment-driven so it never embeds
 * credentials or tenant data in the repository.
 *
 * Required for authenticated endpoints:
 *   BENCHMARK_TOKEN=<bearer token>
 *
 * Optional:
 *   BENCHMARK_BASE_URL=http://localhost:5000
 *   BENCHMARK_CONNECTIONS=10
 *   BENCHMARK_DURATION=10
 *   BENCHMARK_PIPELINING=1
 *   BENCHMARK_REPORT=benchmarks/results/latest.md
 *   BENCHMARK_CONFIG=benchmarks/config.json
 *
 * POST/PUT/PATCH targets may define a JSON body in the config. Destructive
 * endpoints are opt-in through the config file and are never included in the
 * default target set.
 */

const fs = require('fs');
const path = require('path');
const autocannon = require('autocannon');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_BASE_URL = process.env.BENCHMARK_BASE_URL || 'http://localhost:5000';
const DEFAULT_REPORT = process.env.BENCHMARK_REPORT || path.join('benchmarks', 'results', 'latest.md');

const DEFAULT_TARGETS = [
  {
    name: 'Payroll Summary',
    method: 'GET',
    path: '/api/payroll/summary?month=7&year=2026&page=1&limit=50',
    auth: true,
  },
  {
    name: 'Payroll Comparison',
    method: 'GET',
    path: '/api/payroll-comparison/compare?month=7&year=2026',
    auth: true,
  },
  {
    name: 'Dashboard Summary',
    method: 'GET',
    path: '/api/dashboard/summary',
    auth: true,
  },
];

function positiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function loadConfig() {
  const configPath = process.env.BENCHMARK_CONFIG;
  if (!configPath) return { targets: DEFAULT_TARGETS };

  const absolute = path.resolve(ROOT, configPath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`Benchmark config not found: ${absolute}`);
  }

  const config = JSON.parse(fs.readFileSync(absolute, 'utf8'));
  if (!Array.isArray(config.targets) || config.targets.length === 0) {
    throw new Error('Benchmark config must contain a non-empty "targets" array.');
  }
  return config;
}

function validateTarget(target) {
  if (!target || typeof target !== 'object') throw new Error('Each benchmark target must be an object.');
  if (!target.name || !target.path) throw new Error('Each target requires "name" and "path".');
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(String(target.method || 'GET').toUpperCase())) {
    throw new Error(`Unsupported HTTP method for ${target.name}.`);
  }
  if (target.body !== undefined && typeof target.body !== 'object') {
    throw new Error(`Body for ${target.name} must be a JSON object or array.`);
  }
}

function buildOptions(target, config) {
  validateTarget(target);
  const method = String(target.method || 'GET').toUpperCase();
  const token = process.env.BENCHMARK_TOKEN || target.token;
  const headers = { ...(target.headers || {}) };

  if (target.auth && !token) {
    throw new Error(`Target "${target.name}" requires BENCHMARK_TOKEN.`);
  }
  if (token) headers.authorization = `Bearer ${token.replace(/^Bearer\s+/i, '')}`;

  let body;
  if (target.body !== undefined) {
    body = JSON.stringify(target.body);
    headers['content-type'] = 'application/json';
  }

  return {
    url: new URL(target.path, config.baseUrl || DEFAULT_BASE_URL).toString(),
    method,
    headers,
    body,
    connections: positiveInt(config.connections || process.env.BENCHMARK_CONNECTIONS, 10),
    duration: positiveInt(config.duration || process.env.BENCHMARK_DURATION, 10),
    pipelining: positiveInt(config.pipelining || process.env.BENCHMARK_PIPELINING, 1),
    timeout: positiveInt(config.timeout || process.env.BENCHMARK_TIMEOUT, 30),
    amount: target.amount,
  };
}

function percentile(stats, key) {
  const value = stats && stats.latency && stats.latency[key];
  return Number.isFinite(value) ? value : null;
}

function fmt(value, suffix = '') {
  return Number.isFinite(value) ? `${value.toFixed(2)}${suffix}` : 'n/a';
}

function runBenchmark(target, config) {
  const options = buildOptions(target, config);
  process.stdout.write(`Benchmarking ${target.name} ${options.method} ${options.url} ...\n`);

  return new Promise((resolve, reject) => {
    autocannon(options, (error, result) => {
      if (error) return reject(error);
      resolve({ target, options, result });
    });
  });
}

function markdownReport(results, config) {
  const generatedAt = new Date().toISOString();
  const rows = results.map(({ target, result }) => {
    const requests = result.requests && result.requests.total;
    const errors = result.errors || 0;
    const non2xx = result.non2xx || 0;
    const throughput = result.throughput && result.throughput.average;
    return `| ${target.name} | ${target.method || 'GET'} | ${target.path} | ${fmt(requests, '')} | ${fmt(result.requests && result.requests.average, ' req/s')} | ${fmt(throughput, ' bytes/s')} | ${fmt(percentile(result, 'p50'), ' ms')} | ${fmt(percentile(result, 'p90'), ' ms')} | ${fmt(percentile(result, 'p99'), ' ms')} | ${errors} | ${non2xx} |`;
  }).join('\n');

  const failed = results.filter(({ result }) => (result.errors || 0) > 0 || (result.non2xx || 0) > 0);

  return `# PaySphere API Performance Benchmark\n\n` +
    `Generated: ${generatedAt}\n\n` +
    `## Configuration\n\n` +
    `- Base URL: \`${config.baseUrl || DEFAULT_BASE_URL}\`\n` +
    `- Connections: ${config.connections || process.env.BENCHMARK_CONNECTIONS || 10}\n` +
    `- Duration: ${config.duration || process.env.BENCHMARK_DURATION || 10}s\n` +
    `- Pipelining: ${config.pipelining || process.env.BENCHMARK_PIPELINING || 1}\n` +
    `- Runner: [autocannon](https://github.com/mcollina/autocannon)\n\n` +
    `## Results\n\n` +
    `| Endpoint | Method | Path | Requests | Avg req/s | Avg throughput | p50 | p90 | p99 | Errors | Non-2xx |\n` +
    `|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|\n` +
    rows + '\n\n' +
    `## Interpretation\n\n` +
    (failed.length === 0
      ? '- No transport errors or non-2xx responses were observed during the run.\n'
      : `- ${failed.length} target(s) produced errors or non-2xx responses; investigate before comparing performance across runs.\n`) +
    `- Latency values are milliseconds. Throughput is reported by autocannon.\n` +
    `- Compare reports from the same environment, database size, connection count, duration, and application build.\n` +
    `- Benchmarks are not substitutes for production capacity tests.\n`;
}

async function main() {
  const config = loadConfig();
  const results = [];

  for (const target of config.targets) {
    results.push(await runBenchmark(target, config));
  }

  const reportPath = path.resolve(ROOT, process.env.BENCHMARK_REPORT || config.report || DEFAULT_REPORT);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, markdownReport(results, config));

  console.log(`\nBenchmark report written to ${path.relative(ROOT, reportPath)}`);

  if (results.some(({ result }) => (result.errors || 0) > 0 || (result.non2xx || 0) > 0)) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(`Benchmark failed: ${error.message}`);
  process.exitCode = 1;
});
