const mongoose = require('mongoose');
const HeadcountRequisition = require('../models/headcountRequisition.model');
const HeadcountPlan = require('../models/headcountPlan.model');
const Position = require('../models/position.model');
const headcountPlanningService = require('../services/headcountPlanning.service');
const eventBus = require('../services/event.service');

exports.createRequisition = async (req, res, next) => {
  try {
    const {
      requisitionCode,
      type,
      replacedEmployeeId,
      department,
      title,
      requestedCount,
      ctcBudget,
      currency,
      justification,
      managerId,
    } = req.body;

    const validation = await headcountPlanningService.validateRequisition(
      req.tenantId,
      req.body,
    );

    if (!validation.ok) {
      return res.status(validation.status).json({ message: validation.error });
    }

    const requisition = await HeadcountRequisition.create({
      requisitionCode,
      type,
      replacedEmployeeId: replacedEmployeeId || null,
      department,
      title,
      requestedCount,
      ctcBudget,
      currency,
      justification,
      managerId: managerId || null,
      createdBy: req.userId
    });

    return res
      .status(201)
      .json({ message: 'Requisition created', requisition });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: 'That requisition code is already in use' });
    }
    return next(error);
  }
};

exports.approveRequisition = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { level } = req.body; // 'HR' or 'Finance'

    const requisition = await HeadcountRequisition.findOne({
      _id: id
    });

    if (!requisition) {
      return res.status(404).json({ message: 'Requisition not found' });
    }

    if (level === 'HR' && requisition.status === 'Draft') {
      requisition.status = 'HR_Approval';
      requisition.approvedByHR = req.userId;
    } else if (level === 'Finance' && requisition.status === 'HR_Approval') {
      requisition.status = 'Finance_Approval';
      requisition.approvedByFinance = req.userId;

      // Perform validation again before final approval
      const validation = await headcountPlanningService.validateRequisition(
        req.tenantId,
        requisition,
      );
      if (!validation.ok) {
        return res
          .status(validation.status)
          .json({ message: validation.error });
      }

      requisition.status = 'Approved';

      // Update plan utilized budget/headcount
      const currentYear = new Date().getFullYear();
      await HeadcountPlan.updateOne(
        {
          department: requisition.department,
          fiscalYear: currentYear
        },
        {
          $inc: {
            utilizedHeadcount: requisition.requestedCount,
            utilizedBudget: requisition.requestedCount * requisition.ctcBudget,
          },
        },
      );
    } else {
      return res.status(400).json({ message: 'Invalid approval transition' });
    }

    await requisition.save();
    return res
      .status(200)
      .json({ message: `Requisition approved by ${level}`, requisition });
  } catch (error) {
    return next(error);
  }
};

exports.getAnalytics = async (req, res, next) => {
  try {
    const fiscalYear = req.query.fiscalYear
      ? parseInt(req.query.fiscalYear)
      : new Date().getFullYear();
    const analytics = await headcountPlanningService.getHeadcountAnalytics(
      req.tenantId,
      fiscalYear,
    );
    return res.status(200).json(analytics);
  } catch (error) {
    return next(error);
  }
};
