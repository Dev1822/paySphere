const HeadcountPlan = require('../models/headcountPlan.model');
const HeadcountRequisition = require('../models/headcountRequisition.model');
const Position = require('../models/position.model');
const Employee = require('../models/employee.model');

class HeadcountPlanningService {
  /**
   * Validate a headcount requisition against the department plan.
   * Checks if it exceeds budget or headcount limit.
   */
  async validateRequisition(tenantId, requisitionData) {
    const { department, requestedCount, ctcBudget, type, replacedEmployeeId } =
      requisitionData;

    if (type === 'Backfill') {
      if (!replacedEmployeeId) {
        return {
          ok: false,
          error: 'Backfill requisitions require a replacedEmployeeId',
          status: 422,
        };
      }

      const employee = await Employee.findOne({
        _id: replacedEmployeeId,
        tenantId,
      });
      if (
        !employee ||
        !['Exited', 'NoticePeriod'].includes(employee.employmentStatus)
      ) {
        return {
          ok: false,
          error: 'Replaced employee must hold a terminated/resigned status',
          status: 422,
        };
      }
    }

    const currentYear = new Date().getFullYear();
    const plan = await HeadcountPlan.findOne({
      tenantId,
      department,
      fiscalYear: currentYear,
    });

    if (!plan) {
      return {
        ok: false,
        error:
          'No headcount plan found for this department for the current year',
        status: 422,
      };
    }

    const remainingHeadcount = plan.approvedHeadcount - plan.utilizedHeadcount;
    if (requestedCount > remainingHeadcount) {
      return {
        ok: false,
        error: 'Requested headcount exceeds department approved headcount',
        status: 422,
      };
    }

    const remainingBudget = plan.budgetLimit - plan.utilizedBudget;
    const totalRequestedBudget = requestedCount * ctcBudget;
    if (totalRequestedBudget > remainingBudget) {
      return {
        ok: false,
        error: 'Requested budget exceeds department budget limit',
        status: 422,
      };
    }

    return { ok: true, plan };
  }

  /**
   * Analytics: returns planned vs current headcount metrics.
   */
  async getHeadcountAnalytics(tenantId, fiscalYear) {
    const plans = await HeadcountPlan.find({ tenantId, fiscalYear }).lean();

    let totalPlannedHeadcount = 0;
    let totalUtilizedHeadcount = 0;
    let totalBudgetLimit = 0;
    let totalUtilizedBudget = 0;

    const departmentMetrics = plans.map((plan) => {
      totalPlannedHeadcount += plan.approvedHeadcount;
      totalUtilizedHeadcount += plan.utilizedHeadcount;
      totalBudgetLimit += plan.budgetLimit;
      totalUtilizedBudget += plan.utilizedBudget;

      return {
        department: plan.department,
        plannedHeadcount: plan.approvedHeadcount,
        utilizedHeadcount: plan.utilizedHeadcount,
        budgetLimit: plan.budgetLimit,
        utilizedBudget: plan.utilizedBudget,
        budgetUtilizationPercent:
          plan.budgetLimit > 0
            ? ((plan.utilizedBudget / plan.budgetLimit) * 100).toFixed(2)
            : 0,
      };
    });

    return {
      totalPlannedHeadcount,
      totalUtilizedHeadcount,
      totalBudgetLimit,
      totalUtilizedBudget,
      totalBudgetUtilizationPercent:
        totalBudgetLimit > 0
          ? ((totalUtilizedBudget / totalBudgetLimit) * 100).toFixed(2)
          : 0,
      departments: departmentMetrics,
    };
  }
}

module.exports = new HeadcountPlanningService();
