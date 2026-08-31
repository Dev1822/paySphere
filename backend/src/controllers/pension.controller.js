const { PensionPolicy, EmployeePensionSetting } = require('../models/pensionPolicy.model');
const Employee = require('../models/employee.model');

/**
 * POST /api/pension/policies
 * Registers a new regional pension policy (e.g. 401k or PF).
 */
exports.createPolicy = async (req, res, next) => {
  try {
    const { region, planName, employeeContributionRate, employerContributionRate, monthlySalaryCap } = req.body;

    if (!region || !planName || employeeContributionRate === undefined || employerContributionRate === undefined) {
      return res.status(400).json({ message: 'region, planName, employeeContributionRate, and employerContributionRate are required' });
    }

    const policy = await PensionPolicy.create({
      region: region.toUpperCase(),
      planName,
      employeeContributionRate,
      employerContributionRate,
      monthlySalaryCap: monthlySalaryCap || null
    });

    res.status(201).json({ message: 'Pension policy created successfully', policy });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/pension/policies
 * Returns active pension policies for a tenant.
 */
exports.getPolicies = async (req, res, next) => {
  try {
    const policies = await PensionPolicy.find({
      isActive: true
    });
    res.status(200).json({ success: true, data: policies });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/pension/settings/:employeeId
 * Returns the pension enrolment settings for an employee.
 */
exports.getEmployeePensionSetting = async (req, res, next) => {
  try {
    const { employeeId } = req.params;

    let setting = await EmployeePensionSetting.findOne({
      employeeId
    }).populate('pensionPolicyId');
    if (!setting) {
      // If no setting, check if employee exists
      const employee = await Employee.findOne({
        _id: employeeId
      });
      if (!employee) {
        return res.status(404).json({ message: 'Employee not found' });
      }

      // Return a blank default setting
      return res.status(200).json({
        success: true,
        data: {
          employeeId,
          isEnrolled: false,
          customEmployeeContributionRate: null,
          customEmployerContributionRate: null
        }
      });
    }

    res.status(200).json({ success: true, data: setting });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/pension/settings/:employeeId
 * Updates or registers the pension settings for an employee.
 */
exports.updateEmployeePensionSetting = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const { pensionPolicyId, isEnrolled, customEmployeeContributionRate, customEmployerContributionRate } = req.body;

    if (!pensionPolicyId) {
      return res.status(400).json({ message: 'pensionPolicyId is required' });
    }

    const employee = await Employee.findOne({
      _id: employeeId
    });
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const policy = await PensionPolicy.findOne({
      _id: pensionPolicyId
    });
    if (!policy) {
      return res.status(404).json({ message: 'Pension policy not found' });
    }

    const setting = await EmployeePensionSetting.findOneAndUpdate(
      {
        employeeId
      },
      {
        $set: {
          pensionPolicyId,
          isEnrolled: isEnrolled ?? true,
          customEmployeeContributionRate: customEmployeeContributionRate ?? null,
          customEmployerContributionRate: customEmployerContributionRate ?? null
        }
      },
      { upsert: true, new: true }
    );

    res.status(200).json({ message: 'Employee pension settings updated successfully', data: setting });
  } catch (error) {
    next(error);
  }
};
