const mongoose = require('mongoose');
const { Queue } = require('bullmq');
const redisConnection = require('../config/redis');
const cacheService = require('./cache.service');
const { acquireLock, releaseLock } = require('../utils/lockManager');
const logger = require('../utils/logger');
const {
  EpfRemittanceRules,
  EpfRemittanceMonth,
  EpfDamagesWaiver,
} = require('../models/epfRemittance.model');
const {
  resolveRules,
  assessEstablishment,
  wageMonthKey,
} = require('../utils/epfBelatedRemittance');

const ordinalOf = (year, month) => year * 12 + (month - 1);

function waiversFor(orders) {
  const map = {};
  for (const order of orders || []) {
    const from = ordinalOf(order.fromYear, order.fromMonth);
    const to = ordinalOf(order.toYear, order.toMonth);
    if (to < from) continue;

    for (let cursor = from; cursor <= to; cursor += 1) {
      const year = Math.floor(cursor / 12);
      const month = (cursor % 12) + 1;
      map[wageMonthKey({ year, month })] = {
        state: order.state,
        waivedPercent: order.waivedPercent,
        orderReference: order.orderReference,
      };
    }
  }
  return map;
}

async function loadRules(tenantId, establishment) {
  const stored = await EpfRemittanceRules.findOne({
    tenantId,
    establishment: establishment || '',
  }).lean();

  if (!stored) return resolveRules();

  return resolveRules({
    dueDayOfNextMonth: stored.dueDayOfNextMonth,
    graceDays: stored.graceDays,
    interestRatePercent: stored.interestRatePercent,
    damagesCapPercentOfArrears: stored.damagesCapPercentOfArrears,
    damageSlabs: stored.damageSlabs?.length ? stored.damageSlabs : undefined,
  });
}

async function computePosition({ tenantId, establishment, range, asAt }) {
  const rules = await loadRules(tenantId, establishment);

  const filter = { tenantId, establishment: establishment || '' };

  const months = await EpfRemittanceMonth.find(filter)
    .sort({ year: 1, month: 1 })
    .lean();

  const from = range?.from
    ? ordinalOf(range.from.year, range.from.month)
    : null;
  const to = range?.to ? ordinalOf(range.to.year, range.to.month) : null;

  const selected = months.filter((month) => {
    const ordinal = ordinalOf(month.year, month.month);
    if (from !== null && ordinal < from) return false;
    if (to !== null && ordinal > to) return false;
    return true;
  });

  const orders = await EpfDamagesWaiver.find({
    tenantId,
    establishment: establishment || '',
  })
    .sort({ decidedOn: 1, createdAt: 1 })
    .lean();

  const result = assessEstablishment({
    months: selected.map((month) => ({
      wageMonth: { year: month.year, month: month.month },
      basis: month.basis,
      dues: (month.amountsDue || []).reduce((acc, row) => {
        acc[row.component] = (acc[row.component] || 0) + row.amount;
        return acc;
      }, {}),
      remittances: (month.remittances || []).reduce((acc, row) => {
        if (!acc[row.component]) acc[row.component] = [];
        acc[row.component].push({
          paidOn: row.paidOn,
          amount: row.amount,
          reference: row.reference,
        });
        return acc;
      }, {}),
    })),
    waivers: waiversFor(orders),
    asAt,
    rules,
  });

  return { rules, result, waivers: orders, monthCount: selected.length };
}

// BullMQ Queue setup
let epfRemittanceQueue;
if (process.env.REDIS_URL) {
  epfRemittanceQueue = new Queue('epf-remittance', {
    connection: redisConnection,
  });
  epfRemittanceQueue.on('error', (err) => {
    logger.warn('BullMQ epfRemittanceQueue error:', err.message);
  });
} else {
  epfRemittanceQueue = {
    add: async () => {
      logger.warn('Redis is not configured. epfRemittanceQueue.add() ignored.');
      return { id: 'mock-job-id' };
    },
    on: () => {},
  };
}

module.exports = {
  computePosition,
  epfRemittanceQueue,
  loadRules,
  ordinalOf,
  waiversFor,
};
