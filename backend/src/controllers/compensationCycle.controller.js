const compensationCycleService = require('../services/compensationCycle.service');
const CompensationCycle = require('../models/compensationCycle.model');

exports.createProposal = async (req, res) => {
  try {
    const {
      cycleId,
      employeeId,
      proposedSalary,
      performanceRating,
      compaRatio,
      justification,
    } = req.body;
    const tenantId = req.user.tenantId;
    const managerId = req.user._id;

    const proposal = await compensationCycleService.createRevisionProposal(
      tenantId,
      managerId,
      cycleId,
      employeeId,
      proposedSalary,
      performanceRating,
      compaRatio,
      justification,
      req.user,
    );

    res.status(201).json({ success: true, data: proposal });
  } catch (error) {
    if (error.message.includes('422')) {
      return res.status(422).json({ success: false, message: error.message });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.approveProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const { version, status, comment } = req.body;
    const tenantId = req.user.tenantId;
    const userId = req.user._id;

    const proposal = await compensationCycleService.approveProposal(
      tenantId,
      userId,
      id,
      version,
      status,
      comment,
    );
    res.status(200).json({ success: true, data: proposal });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.closeCycle = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;
    const userId = req.user._id;
    const userName = req.user.firstName + ' ' + req.user.lastName;

    const cycle = await compensationCycleService.closeCycle(
      tenantId,
      id,
      userId,
      userName,
    );
    res.status(200).json({ success: true, data: cycle });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
