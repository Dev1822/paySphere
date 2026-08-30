const LifecycleEvent = require('../models/lifecycleEvent.model');
const Employee = require('../models/employee.model');
const SalaryHistory = require('../models/salaryHistory.model');
const { AppraisalReview } = require('../models/appraisal.model');

class LifecycleEventService {
  /**
   * Record a new lifecycle event for an employee.
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async recordEvent(data) {
    const {
      employeeId,
      tenantId,
      eventType,
      category,
      occurredAt = new Date(),
      recordedBy,
      previousValues,
      newValues,
      sourceId,
      isVisible = true,
      note,
    } = data;

    const event = new LifecycleEvent({
      employeeId,
      tenantId,
      eventType,
      category,
      occurredAt,
      recordedBy,
      previousValues,
      newValues,
      sourceId,
      isVisible,
      note,
    });

    return await event.save();
  }

  /**
   * Get timeline events for an employee.
   */
  async getTimeline(employeeId, tenantId, filters = {}, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const query = { employeeId, tenantId };
    if (filters.category) query.category = filters.category;
    if (filters.isVisible !== undefined) query.isVisible = filters.isVisible;

    const [events, totalCount] = await Promise.all([
      LifecycleEvent.find(query)
        .sort({ occurredAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('recordedBy', 'fullName email')
        .lean(),
      LifecycleEvent.countDocuments(query),
    ]);

    return {
      events,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalRecords: totalCount,
        recordsPerPage: limit,
      },
    };
  }

  /**
   * Reconstruct history from existing SalaryHistory and Appraisal models.
   */
  async backfillFromExisting(tenantId) {
    let processed = 0;

    // 1. Backfill SalaryHistory
    const salaryHistories = await SalaryHistory.find(
      tenantId ? { tenantId } : {},
    ).lean();
    for (const sh of salaryHistories) {
      // Check if already exists to prevent duplicate backfills
      const exists = await LifecycleEvent.findOne({
        sourceId: sh._id,
        eventType: 'SALARY_CHANGED',
      });
      if (!exists) {
        await this.recordEvent({
          employeeId: sh.employeeId,
          tenantId: sh.tenantId,
          eventType: 'SALARY_CHANGED',
          category: 'Compensation',
          occurredAt: sh.createdAt,
          recordedBy: sh.changedBy,
          previousValues: { salary: sh.previousSalary, currency: sh.currency },
          newValues: { salary: sh.newSalary, currency: sh.currency },
          sourceId: sh._id,
          note: sh.reason || 'Backfilled salary change',
        });
        processed++;
      }
    }

    // 2. Backfill Appraisals
    const appraisals = await AppraisalReview.find({
      status: 'Finalized',
      ...(tenantId ? { tenantId } : {}),
    }).lean();

    for (const app of appraisals) {
      const exists = await LifecycleEvent.findOne({
        sourceId: app._id,
        eventType: 'APPRAISAL_COMPLETED',
      });
      if (!exists) {
        await this.recordEvent({
          employeeId: app.employeeId,
          tenantId: app.tenantId,
          eventType: 'APPRAISAL_COMPLETED',
          category: 'Performance',
          occurredAt: app.finalizedAt || app.updatedAt,
          recordedBy: app.managerId,
          newValues: {
            finalScore: app.finalScore,
            managerRating: app.managerOverallRating,
          },
          sourceId: app._id,
          note: 'Backfilled appraisal completion',
        });
        processed++;
      }
    }

    return { processed };
  }
}

module.exports = new LifecycleEventService();
