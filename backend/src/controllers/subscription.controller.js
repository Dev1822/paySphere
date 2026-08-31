/**
 * Subscription Controller - Issue #1113
 *
 * Endpoints:
 *   GET  /api/tenant/subscription          — current plan, usage, and features
 *   POST /api/tenant/subscription/upgrade   — upgrade tenant's plan
 *   POST /api/tenant/subscription/cancel    — cancel/downgrade subscription
 *   GET  /api/tenant/subscription/usage     — usage history and current counters
 *   GET  /api/admin/subscriptions           — admin overview of all subscriptions (admin only)
 *   GET  /api/admin/subscriptions/stats     — aggregate subscription metrics (admin only)
 */
'use strict';

const TenantSubscription = require('../models/tenantSubscription.model');
const Plan = require('../models/plan.model');
const usageCounter = require('../services/usageCounter.service');
const logger = require('../utils/logger');

// Allowed plan upgrade paths
const UPGRADE_PATHS = {
  basic: ['pro', 'enterprise'],
  pro: ['enterprise'],
  enterprise: [], // already highest
};

// Valid plan slugs
const VALID_PLAN_SLUGS = ['basic', 'pro', 'enterprise'];

// ---------------------------------------------------------------------------
// GET /api/tenant/subscription
// ---------------------------------------------------------------------------

/**
 * Get the current subscription for the requesting tenant.
 * Auto-creates a basic trial subscription on first access.
 */
async function getSubscription(req, res) {
  try {
    let sub = await TenantSubscription.findOne({}).lean();

    // Auto-create a basic trial on first access
    if (!sub) {
      sub = await TenantSubscription.create({
        planSlug: 'basic',
        status: 'trialing'
      });
      sub = sub.toObject();
    }

    const plan = await Plan.findOne({ slug: sub.planSlug, isActive: true }).lean();

    // Fetch live usage from Redis
    const liveUsage = await usageCounter.getMonthlyUsage(String(req.tenantId));

    return res.json({
      plan: sub.planSlug,
      status: sub.status,
      features: (plan && plan.features) || [],
      limits: (plan && plan.limits) || {},
      usage: {
        employees: Math.max(liveUsage.employees || 0, sub.usage?.employees || 0),
        reportSchedules: Math.max(liveUsage.reportSchedules || 0, sub.usage?.reportSchedules || 0),
      },
      currentPeriodEnd: sub.currentPeriodEnd,
      createdAt: sub.createdAt,
    });
  } catch (err) {
    logger.error('getSubscription error', { error: err.message });
    return res.status(500).json({ message: 'Could not fetch subscription details.' });
  }
}

// ---------------------------------------------------------------------------
// POST /api/tenant/subscription/upgrade
// ---------------------------------------------------------------------------

/**
 * Upgrade the tenant's subscription to a higher plan.
 *
 * Body: { planSlug: 'pro' | 'enterprise' }
 *
 * This is a stub that immediately activates the new plan.
 * In production, this would create a Stripe Checkout session and return a
 * session URL. For now, it directly updates the subscription.
 */
async function upgradeSubscription(req, res) {
  try {
    const { planSlug } = req.body;

    // Validate input
    if (!planSlug) {
      return res.status(422).json({ message: 'planSlug is required.' });
    }

    if (!VALID_PLAN_SLUGS.includes(planSlug)) {
      return res.status(422).json({
        message: `Invalid plan slug. Must be one of: ${VALID_PLAN_SLUGS.join(', ')}`,
      });
    }

    // Get current subscription
    let sub = await TenantSubscription.findOne({});
    if (!sub) {
      sub = await TenantSubscription.create({
        planSlug: 'basic',
        status: 'trialing'
      });
    }

    // Check if upgrade is valid
    const allowedUpgrades = UPGRADE_PATHS[sub.planSlug] || [];
    if (sub.planSlug === planSlug) {
      return res.status(422).json({ message: `Already on the ${planSlug} plan.` });
    }

    if (!allowedUpgrades.includes(planSlug)) {
      return res.status(422).json({
        message: `Cannot upgrade from ${sub.planSlug} to ${planSlug}. Allowed: ${allowedUpgrades.join(', ') || 'none'}`,
      });
    }

    // Verify target plan exists and is active
    const targetPlan = await Plan.findOne({ slug: planSlug, isActive: true });
    if (!targetPlan) {
      return res.status(404).json({ message: `Plan '${planSlug}' not found or inactive.` });
    }

    // Check employee limit before allowing upgrade
    const currentUsage = await usageCounter.getMonthlyUsage(String(req.tenantId));
    if (currentUsage.employees > targetPlan.limits.employeeCount) {
      return res.status(422).json({
        message: `Current employee count (${currentUsage.employees}) exceeds the ${planSlug} plan limit (${targetPlan.limits.employeeCount}).`,
      });
    }

    // Perform upgrade
    const previousPlan = sub.planSlug;
    sub.planSlug = planSlug;
    sub.status = 'active';
    sub.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    await sub.save();

    logger.info('Subscription upgraded', {
      tenantId: String(req.tenantId),
      from: previousPlan,
      to: planSlug,
      upgradedBy: String(req.userId),
    });

    return res.json({
      message: `Successfully upgraded from ${previousPlan} to ${planSlug}.`,
      plan: planSlug,
      status: sub.status,
      features: targetPlan.features,
      limits: targetPlan.limits,
      currentPeriodEnd: sub.currentPeriodEnd,
    });
  } catch (err) {
    logger.error('upgradeSubscription error', { error: err.message });
    return res.status(500).json({ message: 'Could not upgrade subscription.' });
  }
}

// ---------------------------------------------------------------------------
// POST /api/tenant/subscription/cancel
// ---------------------------------------------------------------------------

/**
 * Cancel or downgrade the tenant's subscription.
 *
 * Body: { downgrade?: boolean } — if true, downgrades to basic; otherwise cancels
 *
 * Cancellation sets status to 'cancelled' but preserves read access so tenants
 * can export their data. Downgrade reverts to basic plan with trial status.
 */
async function cancelSubscription(req, res) {
  try {
    const { downgrade } = req.body;

    let sub = await TenantSubscription.findOne({});
    if (!sub) {
      return res.status(404).json({ message: 'No active subscription found.' });
    }

    if (sub.status === 'cancelled') {
      return res.status(422).json({ message: 'Subscription is already cancelled.' });
    }

    if (downgrade) {
      // Downgrade to basic plan
      sub.planSlug = 'basic';
      sub.status = 'active';
      sub.currentPeriodEnd = null;

      await sub.save();

      logger.info('Subscription downgraded', {
        tenantId: String(req.tenantId),
        from: 'higher',
        to: 'basic',
      });

      return res.json({
        message: 'Subscription downgraded to Basic plan.',
        plan: 'basic',
        status: 'active',
      });
    }

    // Cancel subscription — read access preserved, writes blocked
    sub.status = 'cancelled';
    sub.currentPeriodEnd = new Date(); // ends now
    await sub.save();

    logger.info('Subscription cancelled', {
      tenantId: String(req.tenantId),
      cancelledBy: String(req.userId),
    });

    return res.json({
      message: 'Subscription cancelled. You can still export your data.',
      status: 'cancelled',
    });
  } catch (err) {
    logger.error('cancelSubscription error', { error: err.message });
    return res.status(500).json({ message: 'Could not cancel subscription.' });
  }
}

// ---------------------------------------------------------------------------
// GET /api/tenant/subscription/usage
// ---------------------------------------------------------------------------

/**
 * Get detailed usage information including history.
 */
async function getUsageInfo(req, res) {
  try {
    const tenantId = String(req.tenantId);
    const currentMonth = usageCounter.formatMonth();

    // Current usage
    const usage = await usageCounter.getMonthlyUsage(tenantId);

    // Check limits
    const employeeLimit = await usageCounter.checkLimit(tenantId, 'employees');
    const reportLimit = await usageCounter.checkLimit(tenantId, 'reportSchedules');

    // Usage history
    const history = await usageCounter.getUsageHistory(tenantId, 6);

    // Subscription info
    const sub = await TenantSubscription.findOne({}).lean();
    const plan = sub
      ? await Plan.findOne({ slug: sub.planSlug, isActive: true }).lean()
      : null;

    return res.json({
      currentMonth,
      usage,
      limits: {
        employees: employeeLimit,
        reportSchedules: reportLimit,
      },
      history,
      plan: sub ? sub.planSlug : 'basic',
      planLimits: plan ? plan.limits : {},
    });
  } catch (err) {
    logger.error('getUsageInfo error', { error: err.message });
    return res.status(500).json({ message: 'Could not fetch usage information.' });
  }
}

// ---------------------------------------------------------------------------
// GET /api/admin/subscriptions
// ---------------------------------------------------------------------------

/**
 * Admin-only endpoint: list all subscriptions with plan, status, and usage.
 * Requires admin role — enforced by auth middleware and role check upstream.
 */
async function getAdminSubscriptions(req, res) {
  try {
    const { status, plan, page = 1, limit = 50 } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (plan) filter.planSlug = plan;

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const cap = Math.min(Math.max(1, parseInt(limit, 10)), 200);

    const [subscriptions, total] = await Promise.all([
      TenantSubscription.find(filter)
        .populate('tenantId', 'name domain ownerId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(cap)
        .lean(),
      TenantSubscription.countDocuments(filter),
    ]);

    // Enrich with plan details
    const enriched = await Promise.all(
      subscriptions.map(async (sub) => {
        const planDoc = await Plan.findOne({ slug: sub.planSlug, isActive: true }).lean();
        return {
          tenantId: sub.tenantId?._id || sub.tenantId,
          tenantName: sub.tenantId?.name || 'Unknown',
          domain: sub.tenantId?.domain || '',
          plan: sub.planSlug,
          planName: planDoc?.name || sub.planSlug,
          status: sub.status,
          usage: sub.usage || {},
          limits: planDoc?.limits || {},
          currentPeriodEnd: sub.currentPeriodEnd,
          createdAt: sub.createdAt,
        };
      }),
    );

    return res.json({
      subscriptions: enriched,
      pagination: {
        page: parseInt(page, 10),
        limit: cap,
        total,
        pages: Math.ceil(total / cap),
      },
    });
  } catch (err) {
    logger.error('getAdminSubscriptions error', { error: err.message });
    return res.status(500).json({ message: 'Could not fetch subscriptions.' });
  }
}

// ---------------------------------------------------------------------------
// GET /api/admin/subscriptions/stats
// ---------------------------------------------------------------------------

/**
 * Admin-only endpoint: aggregate subscription metrics.
 * Returns breakdown by plan, by status, and total active tenants.
 */
async function getSubscriptionStats(req, res) {
  try {
    // Aggregate by plan
    const byPlan = await TenantSubscription.aggregate([
      { $group: { _id: '$planSlug', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    // Aggregate by status
    const byStatus = await TenantSubscription.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    // Total active (active + trialing)
    const activeCount = await TenantSubscription.countDocuments({
      status: { $in: ['active', 'trialing'] },
    });

    // Total tenants
    const totalCount = await TenantSubscription.countDocuments();

    // Revenue potential (sum of plan prices × active tenants)
    const plans = await Plan.find({ isActive: true }).lean();
    const planPriceMap = {};
    // Note: plans don't have monthlyPrice yet — this is a placeholder
    // for when pricing is added to the Plan model
    for (const plan of plans) {
      planPriceMap[plan.slug] = plan.monthlyPrice || 0;
    }

    let mrr = 0; // Monthly Recurring Revenue
    for (const entry of byPlan) {
      const price = planPriceMap[entry._id] || 0;
      mrr += price * entry.count;
    }

    return res.json({
      total: totalCount,
      active: activeCount,
      byPlan: byPlan.map((p) => ({ plan: p._id, count: p.count })),
      byStatus: byStatus.map((s) => ({ status: s._id, count: s.count })),
      mrr,
    });
  } catch (err) {
    logger.error('getSubscriptionStats error', { error: err.message });
    return res.status(500).json({ message: 'Could not fetch subscription stats.' });
  }
}

module.exports = {
  getSubscription,
  upgradeSubscription,
  cancelSubscription,
  getUsageInfo,
  getAdminSubscriptions,
  getSubscriptionStats,
};
