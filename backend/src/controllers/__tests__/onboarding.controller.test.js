const mongoose = require('mongoose');
const {
  OnboardingPlan,
  OnboardingTask,
  OnboardingDocument,
} = require('../../models/onboarding.model');
const Employee = require('../../models/employee.model');
const {
  createPlan,
  getPlans,
  getPlanById,
  updatePlan,
  addTaskToPlan,
  deletePlan,
  startOnboarding,
  getEmployeeTasks,
  updateTaskStatus,
  getOnboardingProgress,
  getActiveOnboardings,
  uploadDocument,
  verifyDocument,
  getEmployeeDocuments,
} = require('../onboarding.controller');

jest.mock('../../models/onboarding.model');
jest.mock('../../models/employee.model');
jest.mock('../../services/event.service', () => ({ emit: jest.fn() }));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('Onboarding Controller', () => {
  let req, res, next;
  const userId = new mongoose.Types.ObjectId().toString();
  const tenantId = new mongoose.Types.ObjectId().toString();
  const planId = new mongoose.Types.ObjectId().toString();
  const employeeId = new mongoose.Types.ObjectId().toString();
  const taskId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      body: {},
      query: {},
      params: {},
      userId,
      tenantId,
      ip: '127.0.0.1',
      headers: { 'user-agent': 'jest' },
    };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  // ─── createPlan ──────────────────────────────────────────────────────
  describe('createPlan', () => {
    it('should return 400 if name is missing', async () => {
      req.body = {};
      await createPlan(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
    it('should create a plan with tasks', async () => {
      req.body = {
        name: 'Standard Engineering Onboarding',
        tasks: [
          { title: 'Laptop Setup', department: 'IT', dueOffsetDays: -2 },
          { title: 'Offer Letter Signing', department: 'HR', dueOffsetDays: 0 },
        ],
      };
      OnboardingPlan.create.mockResolvedValue({
        _id: planId,
        name: 'Standard Engineering Onboarding',
        tasks: req.body.tasks,
      });
      await createPlan(req, res, next);
      expect(OnboardingPlan.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Standard Engineering Onboarding' }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });
    it('should reject invalid department', async () => {
      req.body = {
        name: 'Plan',
        tasks: [{ title: 'Task', department: 'Invalid', dueOffsetDays: 0 }],
      };
      await createPlan(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ─── getPlans ────────────────────────────────────────────────────────
  describe('getPlans', () => {
    it('should return all plans', async () => {
      OnboardingPlan.find.mockReturnValue({
        populate: jest
          .fn()
          .mockReturnValue({ sort: jest.fn().mockResolvedValue([]) }),
      });
      await getPlans(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ─── getPlanById ─────────────────────────────────────────────────────
  describe('getPlanById', () => {
    it('should return 404 if not found', async () => {
      req.params.id = planId;
      OnboardingPlan.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });
      await getPlanById(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
    });
    it('should return the plan', async () => {
      req.params.id = planId;
      const mock = { _id: planId, name: 'Plan' };
      OnboardingPlan.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mock),
      });
      await getPlanById(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ plan: mock });
    });
  });

  // ─── updatePlan ──────────────────────────────────────────────────────
  describe('updatePlan', () => {
    it('should update name and save', async () => {
      req.params.id = planId;
      req.body = { name: 'Updated Plan' };
      const mock = { _id: planId, name: 'Old', save: jest.fn() };
      OnboardingPlan.findOne.mockResolvedValue(mock);
      await updatePlan(req, res, next);
      expect(mock.name).toBe('Updated Plan');
      expect(mock.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ─── addTaskToPlan ───────────────────────────────────────────────────
  describe('addTaskToPlan', () => {
    it('should add a task to an existing plan', async () => {
      req.params.id = planId;
      req.body = {
        title: 'Background Check',
        department: 'HR',
        dueOffsetDays: 3,
      };
      const mock = { _id: planId, tasks: [], save: jest.fn() };
      OnboardingPlan.findOne.mockResolvedValue(mock);
      await addTaskToPlan(req, res, next);
      expect(mock.tasks).toHaveLength(1);
      expect(mock.tasks[0].title).toBe('Background Check');
      expect(res.status).toHaveBeenCalledWith(201);
    });
    it('should return 400 if title is missing', async () => {
      req.params.id = planId;
      req.body = { department: 'HR', dueOffsetDays: 0 };
      await addTaskToPlan(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ─── deletePlan ──────────────────────────────────────────────────────
  describe('deletePlan', () => {
    it('should return 400 if plan has active tasks', async () => {
      req.params.id = planId;
      OnboardingTask.countDocuments.mockResolvedValue(3);
      await deletePlan(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
    it('should delete the plan if no active tasks', async () => {
      req.params.id = planId;
      OnboardingTask.countDocuments.mockResolvedValue(0);
      OnboardingPlan.findOneAndDelete.mockResolvedValue({ _id: planId });
      await deletePlan(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ─── startOnboarding ─────────────────────────────────────────────────
  describe('startOnboarding', () => {
    it('should return 400 if planId is missing', async () => {
      req.body = { employeeId, joiningDate: '2026-09-01' };
      await startOnboarding(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
    it('should create task instances from plan', async () => {
      req.body = { planId, employeeId, joiningDate: '2026-09-01' };
      OnboardingPlan.findOne.mockResolvedValue({
        _id: planId,
        isActive: true,
        name: 'Standard',
        tasks: [
          {
            _id: 't1',
            title: 'Laptop',
            department: 'IT',
            dueOffsetDays: -2,
            description: '',
            isMandatory: true,
          },
        ],
      });
      Employee.findOne.mockResolvedValue({ _id: employeeId });
      OnboardingTask.countDocuments.mockResolvedValue(0);
      OnboardingTask.insertMany.mockResolvedValue([
        { _id: taskId, title: 'Laptop' },
      ]);
      await startOnboarding(req, res, next);
      expect(OnboardingTask.insertMany).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });
    it('should return 409 if already onboarded', async () => {
      req.body = { planId, employeeId, joiningDate: '2026-09-01' };
      OnboardingPlan.findOne.mockResolvedValue({
        _id: planId,
        isActive: true,
        tasks: [],
      });
      Employee.findOne.mockResolvedValue({ _id: employeeId });
      OnboardingTask.countDocuments.mockResolvedValue(5);
      await startOnboarding(req, res, next);
      expect(res.status).toHaveBeenCalledWith(409);
    });
  });

  // ─── getEmployeeTasks ────────────────────────────────────────────────
  describe('getEmployeeTasks', () => {
    it('should return tasks for an employee', async () => {
      req.params.employeeId = employeeId;
      OnboardingTask.find.mockReturnValue({
        sort: jest
          .fn()
          .mockReturnValue({ populate: jest.fn().mockResolvedValue([]) }),
      });
      await getEmployeeTasks(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ─── updateTaskStatus ────────────────────────────────────────────────
  describe('updateTaskStatus', () => {
    it('should update task status to Completed', async () => {
      req.params.taskId = taskId;
      req.body = { status: 'Completed' };
      const mock = {
        _id: taskId,
        status: 'Pending',
        notes: '',
        completedAt: null,
        completedBy: null,
        save: jest.fn(),
      };
      OnboardingTask.findOne.mockResolvedValue(mock);
      await updateTaskStatus(req, res, next);
      expect(mock.status).toBe('Completed');
      expect(mock.completedAt).toBeInstanceOf(Date);
      expect(mock.completedBy).toBe(userId);
      expect(res.status).toHaveBeenCalledWith(200);
    });
    it('should return 400 for invalid status', async () => {
      req.params.taskId = taskId;
      req.body = { status: 'Invalid' };
      await updateTaskStatus(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ─── getOnboardingProgress ───────────────────────────────────────────
  describe('getOnboardingProgress', () => {
    it('should return progress stats', async () => {
      req.params.employeeId = employeeId;
      OnboardingTask.find.mockResolvedValue([
        { status: 'Completed' },
        { status: 'Completed' },
        { status: 'In Progress' },
        { status: 'Pending' },
      ]);
      await getOnboardingProgress(req, res, next);
      const body = res.json.mock.calls[0][0];
      expect(body.totalTasks).toBe(4);
      expect(body.completed).toBe(2);
      expect(body.progressPercent).toBe(50);
    });
    it('should return 0 progress for no tasks', async () => {
      req.params.employeeId = employeeId;
      OnboardingTask.find.mockResolvedValue([]);
      await getOnboardingProgress(req, res, next);
      expect(res.json.mock.calls[0][0].progressPercent).toBe(0);
    });
  });

  // ─── getActiveOnboardings ────────────────────────────────────────────
  describe('getActiveOnboardings', () => {
    it('should return aggregated active onboardings', async () => {
      OnboardingTask.aggregate.mockResolvedValue([
        {
          employeeId,
          fullName: 'John',
          totalTasks: 5,
          completedTasks: 2,
          progressPercent: 40,
        },
      ]);
      await getActiveOnboardings(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].onboardings).toHaveLength(1);
    });
  });

  // ─── uploadDocument ──────────────────────────────────────────────────
  describe('uploadDocument', () => {
    it('should create an onboarding document', async () => {
      req.body = {
        employeeId,
        documentType: 'PAN Card',
        fileUrl: 'https://s3.example/doc.pdf',
        fileName: 'pan.pdf',
      };
      Employee.findOne.mockResolvedValue({ _id: employeeId });
      OnboardingDocument.create.mockResolvedValue({
        _id: 'doc1',
        documentType: 'PAN Card',
      });
      await uploadDocument(req, res, next);
      expect(OnboardingDocument.create).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });
    it('should return 400 if documentType is missing', async () => {
      req.body = { employeeId, fileUrl: 'url', fileName: 'f.pdf' };
      await uploadDocument(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ─── verifyDocument ──────────────────────────────────────────────────
  describe('verifyDocument', () => {
    it('should verify a document', async () => {
      req.params.documentId = 'doc1';
      req.body = { status: 'Verified' };
      const mock = {
        _id: 'doc1',
        status: 'Pending Verification',
        verifiedBy: null,
        save: jest.fn(),
      };
      OnboardingDocument.findOne.mockResolvedValue(mock);
      await verifyDocument(req, res, next);
      expect(mock.status).toBe('Verified');
      expect(mock.verifiedBy).toBe(userId);
      expect(res.status).toHaveBeenCalledWith(200);
    });
    it('should reject a document with reason', async () => {
      req.params.documentId = 'doc1';
      req.body = { status: 'Rejected', rejectionReason: 'Blurry image' };
      const mock = {
        _id: 'doc1',
        status: 'Pending Verification',
        rejectionReason: '',
        save: jest.fn(),
      };
      OnboardingDocument.findOne.mockResolvedValue(mock);
      await verifyDocument(req, res, next);
      expect(mock.status).toBe('Rejected');
      expect(mock.rejectionReason).toBe('Blurry image');
    });
  });

  // ─── getEmployeeDocuments ────────────────────────────────────────────
  describe('getEmployeeDocuments', () => {
    it('should return documents for an employee', async () => {
      req.params.employeeId = employeeId;
      OnboardingDocument.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      });
      await getEmployeeDocuments(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
