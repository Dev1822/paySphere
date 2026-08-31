const { SalaryAdjustment } = require('../models/salaryAdjustment.model');
const { calculateRetroactivePay } = require('../utils/retroactiveCalculator');
const Employee = require('../models/employee.model');
const SalaryHistory = require('../models/salaryHistory.model');

/**
 * POST /api/salary-adjustments
 * Creates a retroactive salary adjustment, updates the employee salary, and saves the history.
 */
exports.createAdjustment = async (req, res, next) => {
  try {
    const { employeeId, effectiveMonth, effectiveYear, newSalaryRate } = req.body;

    if (!employeeId || !effectiveMonth || !effectiveYear || !newSalaryRate) {
      return res.status(400).json({ message: 'employeeId, effectiveMonth, effectiveYear, and newSalaryRate are required' });
    }

    const employee = await Employee.findOne({
      _id: employeeId
    });
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const oldSalary = employee.monthlySalary || 0;

    // 1. Calculate the retroactive pay adjustments from past cycles
    const { totalDelta, breakdown } = await calculateRetroactivePay(
      employeeId,
      req.tenantId,
      Number(effectiveMonth),
      Number(effectiveYear),
      Number(newSalaryRate)
    );

    // 2. Create the SalaryAdjustment record for the delta
    const adjustment = await SalaryAdjustment.create({
      employeeId,
      effectiveMonth: Number(effectiveMonth),
      effectiveYear: Number(effectiveYear),
      oldSalaryRate: oldSalary,
      newSalaryRate: Number(newSalaryRate),
      calculatedDelta: totalDelta,
      status: 'Pending'
    });

    // 3. Update the Employee's salary rate
    employee.monthlySalary = Number(newSalaryRate);
    await employee.save();

    // 4. Create SalaryHistory audit log entry
    await SalaryHistory.create({
      employeeId,
      employeeName: employee.fullName,
      previousSalary: oldSalary,
      newSalary: Number(newSalaryRate),
      salaryChange: Number(newSalaryRate) - oldSalary,
      percentageChange: oldSalary > 0 ? ((Number(newSalaryRate) - oldSalary) / oldSalary) * 100 : 100,
      changedBy: req.userId,
      changedByName: req.user ? req.user.fullName : 'HR Administrator',
      reason: 'annual_revision'
    });

    res.status(201).json({
      message: 'Retroactive salary adjustment calculated and configured successfully.',
      adjustment,
      breakdown
    });

  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/salary-adjustments
 * Lists the salary adjustments for a tenant.
 */
exports.getAdjustments = async (req, res, next) => {
  try {
    const adjustments = await SalaryAdjustment.find({})
      .populate('employeeId', 'fullName email')
      .sort({ createdAt: -1 });

    res.status(200).json({ adjustments });
  } catch (error) {
    next(error);
  }
};
