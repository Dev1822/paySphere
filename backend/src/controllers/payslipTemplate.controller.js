const PayslipTemplate = require('../models/payslipTemplate.model');
const logger = require('../utils/logger');
const { assemblePayslipData } = require('../utils/payslipDataAssembler');
const { renderPayslipHtml } = require('../utils/payslipRenderer.html');

exports.getTemplate = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    let template = await PayslipTemplate.findOne({ tenantId });
    if (!template) {
      // Return a default template structure without saving if none exists
      template = new PayslipTemplate({ tenantId });
    }
    return res.json(template);
  } catch (error) {
    logger.error('Error fetching payslip template', { error: error.message });
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.previewTemplate = async (req, res) => {
  try {
    const { template, employee, payroll } = req.body;
    if (!template)
      return res.status(400).json({ message: 'Template data is required' });

    // Use dummy data if not fully provided
    const empData = employee || {
      fullName: 'John Doe',
      employeeId: 'EMP-001',
      role: 'Engineer',
      department: 'IT',
    };
    const payData = payroll || {
      monthName: 'August',
      year: 2026,
      baseSalary: 5000,
      netSalary: 4500,
    };

    const assembledData = assemblePayslipData(empData, payData, template);
    const html = renderPayslipHtml(assembledData, 'INR');

    return res.json({ html });
  } catch (error) {
    logger.error('Error previewing payslip template', { error: error.message });
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.updateTemplate = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const updateData = req.body;

    // Ensure tenantId isn't overwritten
    delete updateData.tenantId;

    let template = await PayslipTemplate.findOne({ tenantId });
    if (!template) {
      template = new PayslipTemplate({ tenantId, ...updateData });
      await template.save();
    } else {
      template = await PayslipTemplate.findOneAndUpdate(
        { tenantId },
        { $set: updateData },
        { new: true, runValidators: true },
      );
    }

    return res.json(template);
  } catch (error) {
    logger.error('Error updating payslip template', { error: error.message });
    return res.status(500).json({ message: 'Internal server error' });
  }
};
