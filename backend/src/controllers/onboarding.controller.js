/**
 * @fileoverview Employee Onboarding Controller
 * @description Manages onboarding plans (templates), task instances per employee,
 * and onboarding document verification.  HR creates plans; when a new hire joins,
 * their tasks are instantiated from the plan.  Managers and the employee track
 * progress through the checklist.
 */

const mongoose = require('mongoose');
const {
  OnboardingPlan,
  OnboardingTask,
  OnboardingDocument,
} = require('../models/onboarding.model');
const Employee = require('../models/employee.model');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');
const { sanitizeText } = require('../utils/validators');
const ProbationTrackerService = require('../services/probationTracker.service');
const { EMPLOYMENT_STATUS } = require('../config/employment');

// ─── Admin: Create Onboarding Plan ────────────────────────────────────────

exports.createPlan = async (req, res, next) => {
  try {
    const { name, description, tasks } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Plan name is required' });
    }

    const validDepts = ['HR', 'IT', 'Finance', 'Manager', 'Employee'];
    const sanitisedTasks = [];
    if (tasks && Array.isArray(tasks)) {
      for (const t of tasks) {
        if (!t.title || !t.title.trim()) {
          return res
            .status(400)
            .json({ message: 'Each task must have a title' });
        }
        if (!t.department || !validDepts.includes(t.department)) {
          return res.status(400).json({
            message: `Invalid department "${t.department}". Must be one of: ${validDepts.join(', ')}`,
          });
        }
        if (
          t.dueOffsetDays === undefined ||
          typeof t.dueOffsetDays !== 'number'
        ) {
          return res
            .status(400)
            .json({ message: 'dueOffsetDays must be a number' });
        }
        sanitisedTasks.push({
          title: sanitizeText(t.title),
          description: t.description ? sanitizeText(t.description) : '',
          department: t.department,
          dueOffsetDays: t.dueOffsetDays,
          isMandatory: t.isMandatory !== false,
        });
      }
    }

    const plan = await OnboardingPlan.create({
      tenantId: req.tenantId,
      name: sanitizeText(name),
      description: description ? sanitizeText(description) : '',
      tasks: sanitisedTasks,
      createdBy: req.userId,
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'ONBOARDING_PLAN_CREATE',
      resourceType: 'OnboardingPlan',
      resourceIds: [plan._id],
      details: { name: plan.name, taskCount: sanitisedTasks.length },
      req,
    });

    logger.info('Onboarding plan created', {
      userId: req.userId,
      planId: plan._id,
    });
    return res.status(201).json({ message: 'Onboarding plan created', plan });
  } catch (error) {
    logger.error('Failed to create onboarding plan', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Admin: List Plans ────────────────────────────────────────────────────

exports.getPlans = async (req, res, next) => {
  try {
    const { isActive } = req.query;
    const filter = { tenantId: req.tenantId };
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const plans = await OnboardingPlan.find(filter)
      .populate('createdBy', 'fullName email')
      .sort({ createdAt: -1 });

    return res.status(200).json({ plans });
  } catch (error) {
    logger.error('Failed to fetch plans', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Admin: Get Plan by ID ────────────────────────────────────────────────

exports.getPlanById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const plan = await OnboardingPlan.findOne({
      _id: id,
      tenantId: req.tenantId,
    }).populate('createdBy', 'fullName email');

    if (!plan)
      return res.status(404).json({ message: 'Onboarding plan not found' });
    return res.status(200).json({ plan });
  } catch (error) {
    logger.error('Failed to fetch plan', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Admin: Update Plan Metadata ──────────────────────────────────────────

exports.updatePlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    const plan = await OnboardingPlan.findOne({
      _id: id,
      tenantId: req.tenantId,
    });
    if (!plan)
      return res.status(404).json({ message: 'Onboarding plan not found' });

    if (name !== undefined) plan.name = sanitizeText(name);
    if (description !== undefined) plan.description = sanitizeText(description);
    if (isActive !== undefined) plan.isActive = isActive;

    await plan.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'ONBOARDING_PLAN_UPDATE',
      resourceType: 'OnboardingPlan',
      resourceIds: [plan._id],
      details: { name: plan.name, changes: Object.keys(req.body) },
      req,
    });

    logger.info('Onboarding plan updated', {
      userId: req.userId,
      planId: plan._id,
    });
    return res.status(200).json({ message: 'Plan updated', plan });
  } catch (error) {
    logger.error('Failed to update plan', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Admin: Add Task to Plan ──────────────────────────────────────────────

exports.addTaskToPlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, department, dueOffsetDays, isMandatory } =
      req.body;

    if (!title || !title.trim())
      return res.status(400).json({ message: 'Task title is required' });
    if (!department)
      return res.status(400).json({ message: 'Department is required' });
    if (dueOffsetDays === undefined || typeof dueOffsetDays !== 'number') {
      return res
        .status(400)
        .json({ message: 'dueOffsetDays must be a number' });
    }

    const validDepts = ['HR', 'IT', 'Finance', 'Manager', 'Employee'];
    if (!validDepts.includes(department)) {
      return res.status(400).json({
        message: `Invalid department. Must be one of: ${validDepts.join(', ')}`,
      });
    }

    const plan = await OnboardingPlan.findOne({
      _id: id,
      tenantId: req.tenantId,
    });
    if (!plan)
      return res.status(404).json({ message: 'Onboarding plan not found' });

    plan.tasks.push({
      title: sanitizeText(title),
      description: description ? sanitizeText(description) : '',
      department,
      dueOffsetDays,
      isMandatory: isMandatory !== false,
    });
    await plan.save();

    const addedTask = plan.tasks[plan.tasks.length - 1];

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'ONBOARDING_TASK_ADD',
      resourceType: 'OnboardingPlan',
      resourceIds: [plan._id],
      details: { taskTitle: title, department },
      req,
    });

    logger.info('Task added to onboarding plan', {
      userId: req.userId,
      planId: plan._id,
    });
    return res.status(201).json({ message: 'Task added', task: addedTask });
  } catch (error) {
    logger.error('Failed to add task', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Admin: Delete Plan ───────────────────────────────────────────────────

exports.deletePlan = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if any tasks reference this plan
    const activeTasks = await OnboardingTask.countDocuments({
      planId: id,
      tenantId: req.tenantId,
    });
    if (activeTasks > 0) {
      return res.status(400).json({
        message: `Cannot delete plan with ${activeTasks} active task instance(s). Deactivate it instead.`,
      });
    }

    const plan = await OnboardingPlan.findOneAndDelete({
      _id: id,
      tenantId: req.tenantId,
    });
    if (!plan)
      return res.status(404).json({ message: 'Onboarding plan not found' });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'ONBOARDING_PLAN_DELETE',
      resourceType: 'OnboardingPlan',
      resourceIds: [plan._id],
      details: { name: plan.name },
      req,
    });

    logger.info('Onboarding plan deleted', {
      userId: req.userId,
      planId: plan._id,
    });
    return res.status(200).json({ message: 'Plan deleted' });
  } catch (error) {
    logger.error('Failed to delete plan', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Admin: Start Onboarding for Employee ─────────────────────────────────

exports.startOnboarding = async (req, res, next) => {
  try {
    const { planId, employeeId, joiningDate } = req.body;

    if (!planId) return res.status(400).json({ message: 'planId is required' });
    if (!employeeId)
      return res.status(400).json({ message: 'employeeId is required' });
    if (!joiningDate)
      return res.status(400).json({ message: 'joiningDate is required' });

    const plan = await OnboardingPlan.findOne({
      _id: planId,
      tenantId: req.tenantId,
      isActive: true,
    });
    if (!plan)
      return res
        .status(404)
        .json({ message: 'Active onboarding plan not found' });

    const employee = await Employee.findOne({
      _id: employeeId,
      tenantId: req.tenantId,
    });
    if (!employee)
      return res.status(404).json({ message: 'Employee not found' });

    // Check for existing onboarding
    const existingTasks = await OnboardingTask.countDocuments({
      employeeId,
      planId,
      tenantId: req.tenantId,
    });
    if (existingTasks > 0) {
      return res
        .status(409)
        .json({ message: 'Employee already has tasks from this plan' });
    }

    const joinDate = new Date(joiningDate);
    const taskInstances = plan.tasks.map((t) => ({
      tenantId: req.tenantId,
      employeeId,
      planId: plan._id,
      templateTaskId: t._id,
      title: t.title,
      description: t.description,
      department: t.department,
      dueDate: new Date(
        joinDate.getTime() + t.dueOffsetDays * 24 * 60 * 60 * 1000,
      ),
      status: 'Pending',
    }));

    const created = await OnboardingTask.insertMany(taskInstances);

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'ONBOARDING_START',
      resourceType: 'OnboardingTask',
      resourceIds: created.map((t) => t._id),
      details: { employeeId, planName: plan.name, taskCount: created.length },
      req,
    });

    logger.info('Onboarding started', {
      userId: req.userId,
      employeeId,
      planName: plan.name,
      taskCount: created.length,
    });

    if (employee.employmentStatus === EMPLOYMENT_STATUS.PROBATION) {
      try {
        await ProbationTrackerService.initiateProbation({
          tenantId: req.tenantId,
          employeeId: employee._id,
          createdBy: req.userId,
        });
      } catch (probationErr) {
        logger.error('Failed to auto-initiate probation during onboarding', {
          employeeId,
          error: probationErr.message,
        });
        // We do not fail the onboarding start if probation fails, but log it.
      }
    }

    return res.status(201).json({
      message: `Onboarding started with ${created.length} tasks`,
      tasks: created,
    });
  } catch (error) {
    logger.error('Failed to start onboarding', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Employee/Manager: Get Employee's Onboarding Tasks ────────────────────

exports.getEmployeeTasks = async (req, res, next) => {
  try {
    const { employeeId } = req.params;

    const tasks = await OnboardingTask.find({
      employeeId,
      tenantId: req.tenantId,
    })
      .sort({ dueDate: 1 })
      .populate('assigneeId', 'fullName email');

    return res.status(200).json({ tasks });
  } catch (error) {
    logger.error('Failed to fetch employee tasks', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Employee/Manager: Update Task Status ─────────────────────────────────

exports.updateTaskStatus = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { status, notes } = req.body;

    const validStatuses = ['Pending', 'In Progress', 'Completed', 'Blocked'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const task = await OnboardingTask.findOne({
      _id: taskId,
      tenantId: req.tenantId,
    });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    task.status = status;
    if (notes !== undefined) task.notes = sanitizeText(notes);
    if (status === 'Completed') {
      task.completedAt = new Date();
      task.completedBy = req.userId;
    } else {
      task.completedAt = null;
      task.completedBy = null;
    }

    await task.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'ONBOARDING_TASK_UPDATE',
      resourceType: 'OnboardingTask',
      resourceIds: [task._id],
      details: { title: task.title, newStatus: status },
      req,
    });

    logger.info('Onboarding task status updated', {
      userId: req.userId,
      taskId: task._id,
      status,
    });
    return res.status(200).json({ message: 'Task updated', task });
  } catch (error) {
    logger.error('Failed to update task', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Admin/Manager: Onboarding Progress Overview ──────────────────────────

exports.getOnboardingProgress = async (req, res, next) => {
  try {
    const { employeeId } = req.params;

    const tasks = await OnboardingTask.find({
      employeeId,
      tenantId: req.tenantId,
    });

    if (tasks.length === 0) {
      return res.status(200).json({
        totalTasks: 0,
        completed: 0,
        inProgress: 0,
        pending: 0,
        blocked: 0,
        progressPercent: 0,
      });
    }

    const completed = tasks.filter((t) => t.status === 'Completed').length;
    const inProgress = tasks.filter((t) => t.status === 'In Progress').length;
    const pending = tasks.filter((t) => t.status === 'Pending').length;
    const blocked = tasks.filter((t) => t.status === 'Blocked').length;
    const progressPercent = Math.round((completed / tasks.length) * 100);

    return res.status(200).json({
      totalTasks: tasks.length,
      completed,
      inProgress,
      pending,
      blocked,
      progressPercent,
    });
  } catch (error) {
    logger.error('Failed to fetch onboarding progress', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Admin: List All Employees In Onboarding ──────────────────────────────

exports.getActiveOnboardings = async (req, res, next) => {
  try {
    // Find employees with at least one incomplete task
    const pipeline = [
      {
        $match: {
          tenantId: new mongoose.Types.ObjectId(req.tenantId),
          status: { $ne: 'Completed' },
        },
      },
      {
        $group: {
          _id: '$employeeId',
          totalTasks: { $sum: 1 },
          completedTasks: {
            $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] },
          },
        },
      },
      {
        $lookup: {
          from: 'employees',
          localField: '_id',
          foreignField: '_id',
          as: 'employee',
        },
      },
      { $unwind: '$employee' },
      {
        $project: {
          employeeId: '$_id',
          fullName: '$employee.fullName',
          role: '$employee.role',
          department: '$employee.department',
          totalTasks: 1,
          completedTasks: 1,
          progressPercent: {
            $round: [
              {
                $multiply: [
                  { $divide: ['$completedTasks', '$totalTasks'] },
                  100,
                ],
              },
              0,
            ],
          },
        },
      },
      { $sort: { progressPercent: 1 } },
    ];

    const activeBoardings = await OnboardingTask.aggregate(pipeline);

    return res.status(200).json({ onboardings: activeBoardings });
  } catch (error) {
    logger.error('Failed to fetch active onboardings', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Admin: Upload Onboarding Document ────────────────────────────────────

exports.uploadDocument = async (req, res, next) => {
  try {
    const { employeeId, documentType, fileUrl, fileName } = req.body;

    if (!employeeId)
      return res.status(400).json({ message: 'employeeId is required' });
    if (!documentType || !documentType.trim())
      return res.status(400).json({ message: 'documentType is required' });
    if (!fileUrl)
      return res.status(400).json({ message: 'fileUrl is required' });
    if (!fileName)
      return res.status(400).json({ message: 'fileName is required' });

    const employee = await Employee.findOne({
      _id: employeeId,
      tenantId: req.tenantId,
    });
    if (!employee)
      return res.status(404).json({ message: 'Employee not found' });

    const doc = await OnboardingDocument.create({
      tenantId: req.tenantId,
      employeeId,
      documentType: sanitizeText(documentType),
      fileUrl,
      fileName: sanitizeText(fileName),
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'ONBOARDING_DOC_UPLOAD',
      resourceType: 'OnboardingDocument',
      resourceIds: [doc._id],
      details: { employeeId, documentType, fileName },
      req,
    });

    logger.info('Onboarding document uploaded', {
      userId: req.userId,
      employeeId,
      documentType,
    });
    return res
      .status(201)
      .json({ message: 'Document uploaded', document: doc });
  } catch (error) {
    logger.error('Failed to upload document', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Admin: Verify/Reject Onboarding Document ─────────────────────────────

exports.verifyDocument = async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const { status, rejectionReason } = req.body;

    const validStatuses = ['Pending Verification', 'Verified', 'Rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const doc = await OnboardingDocument.findOne({
      _id: documentId,
      tenantId: req.tenantId,
    });
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    doc.status = status;
    doc.verifiedBy = req.userId;
    if (status === 'Rejected' && rejectionReason) {
      doc.rejectionReason = sanitizeText(rejectionReason);
    }

    await doc.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'ONBOARDING_DOC_VERIFY',
      resourceType: 'OnboardingDocument',
      resourceIds: [doc._id],
      details: { documentType: doc.documentType, status },
      req,
    });

    logger.info('Onboarding document verified', {
      userId: req.userId,
      documentId: doc._id,
      status,
    });
    return res
      .status(200)
      .json({ message: `Document ${status.toLowerCase()}`, document: doc });
  } catch (error) {
    logger.error('Failed to verify document', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Employee/Manager: Get Employee's Onboarding Documents ────────────────

exports.getEmployeeDocuments = async (req, res, next) => {
  try {
    const { employeeId } = req.params;

    const documents = await OnboardingDocument.find({
      employeeId,
      tenantId: req.tenantId,
    }).sort({ createdAt: -1 });

    return res.status(200).json({ documents });
  } catch (error) {
    logger.error('Failed to fetch employee documents', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};
