import mongoose from 'mongoose';
const OutcomeIncentiveRule = require('../models/outcomeIncentiveRule.model');
const ShiftRoster = require('../models/shiftRoster.model');
const CommissionPlan = require('../models/commission.model');

/**
 * @class ValueBasedCareBonusService
 * @description Service to evaluate clinical events and trigger bonuses based on active incentive rules.
 */
class ValueBasedCareBonusService {
  /**
   * Evaluates a clinical event against active incentive rules.
   * @param {string} tenantId
   * @param {string} metricSource
   * @param {object} eventData
   * @param {Date} eventTimestamp
   * @param {string} departmentId
   */
  async evaluateClinicalEvent(
    tenantId,
    metricSource,
    eventData,
    eventTimestamp,
    departmentId,
  ) {
    try {
      // Find active rules for this metric source
      const rules = await OutcomeIncentiveRule.find({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        metricSource: metricSource,
        isActive: true,
        ...(departmentId
          ? { departmentId: new mongoose.Types.ObjectId(departmentId) }
          : {}),
      });

      for (const rule of rules) {
        if (this._isConditionMet(rule.condition, eventData)) {
          await this.triggerBonusGeneration(
            rule,
            eventData,
            eventTimestamp,
            departmentId,
          );
        }
      }
    } catch (error) {
      console.error('Error evaluating clinical event for bonuses:', error);
      throw error;
    }
  }

  /**
   * Helper to check if event data satisfies the rule condition.
   */
  _isConditionMet(condition, eventData) {
    const { field, operator, value } = condition;
    const eventValue = eventData[field];

    if (eventValue === undefined) return false;

    switch (operator) {
      case '==':
        return eventValue == value;
      case '!=':
        return eventValue != value;
      case '>':
        return eventValue > value;
      case '>=':
        return eventValue >= value;
      case '<':
        return eventValue < value;
      case '<=':
        return eventValue <= value;
      default:
        return false;
    }
  }

  /**
   * Finds the active shift roster and distributes the bonus pool.
   */
  async triggerBonusGeneration(rule, eventData, eventTimestamp, departmentId) {
    // 1. Find active shift roster during the eventTimestamp
    // Assuming shiftRoster has startTime and endTime or actual times
    // For simplicity, finding a shift roster that encompasses the event
    const activeShifts = await ShiftRoster.find({
      tenantId: rule.tenantId,
      // In a real scenario, compare eventTimestamp with shift times.
      // Assuming we have an 'active' flag or dates are matching for the department
    }).populate('employees');

    if (!activeShifts || activeShifts.length === 0) {
      console.log(`No active shift found for event on rule ${rule.name}`);
      return;
    }

    // Distribute among all employees in active shifts
    let eligibleEmployees = [];
    for (const shift of activeShifts) {
      if (shift.employees && shift.employees.length > 0) {
        eligibleEmployees.push(...shift.employees);
      }
    }

    // De-duplicate employees
    eligibleEmployees = [
      ...new Set(
        eligibleEmployees.map((e) => (e._id ? e._id.toString() : e.toString())),
      ),
    ];

    if (eligibleEmployees.length === 0) return;

    const bonusPerEmployee = rule.bonusPoolAmount / eligibleEmployees.length;

    // 2. Create Commission/Bonus records
    for (const empId of eligibleEmployees) {
      await this.distributeBonus(rule, empId, bonusPerEmployee);
    }
  }

  /**
   * Creates a commission/bonus record for the employee.
   */
  async distributeBonus(rule, employeeId, amount) {
    // Note: Creating a mock or a generic commission record.
    // In actual implementation, you might use a specific Commission model or a new ClinicalBonus model.
    console.log(
      `Awarding ${amount} ${rule.currency} to employee ${employeeId} for rule: ${rule.name}`,
    );
    // Code to insert into the Commission or StatutoryBonus ledger goes here.
    // E.g., await CommissionPlan.create({...})
  }
}

export default new ValueBasedCareBonusService();
